-- Digital Dash: one-time database setup.
-- Paste all of this into Supabase, SQL Editor, New query, and click Run.
-- It is the same as the files in supabase/migrations/, in order, and it records them as applied
-- so the GitHub integration doesn't try to run them again.

BEGIN;

-- ===== 20260226013640_bcec28c4-2608-42ac-ac04-608ef57e5dc7.sql =====
-- Create contact submissions table (public, no auth needed)
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public contact form)
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions
  FOR INSERT
  WITH CHECK (true);

-- ===== 20261001120000_digital_dash_accounts.sql =====
-- Digital Dash accounts: one saved state per user, plus private image storage.
-- Every row and file is readable and writable only by its owner (row level security).

CREATE TABLE IF NOT EXISTS public.dash_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  rev BIGINT NOT NULL DEFAULT 1,          -- bumps on every save; used to spot edits from another device
  device TEXT,                            -- e.g. "Chrome on Mac", shown as "last saved on"
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dash_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own dashboard"
  ON public.dash_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own dashboard"
  ON public.dash_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own dashboard"
  ON public.dash_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own dashboard"
  ON public.dash_state FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Background, clock and widget photos. Files live under "<user id>/<image key>".
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dash-images', 'dash-images', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read their own dash images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dash-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users upload their own dash images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dash-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users replace their own dash images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dash-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete their own dash images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dash-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- "Delete my account": removes the signed-in user (their dash_state row goes with it via the
-- foreign key). The app deletes the user's images through the storage API first.
CREATE OR REPLACE FUNCTION public.delete_my_dash_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_dash_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_dash_account() TO authenticated;

-- ===== 20261001130000_digital_dash_ai.sql =====
-- Digital Dash AI helper: a per-user daily request counter so the shared API key can't be drained.
CREATE TABLE IF NOT EXISTS public.dash_ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT current_date,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.dash_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own AI usage"
  ON public.dash_ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- No insert/update policies: only dash_ai_take() below writes, so users can't reset their own count.

-- Counts one request for the signed-in user and returns false once today's limit is reached.
CREATE OR REPLACE FUNCTION public.dash_ai_take(p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.dash_ai_usage (user_id, day, count)
  VALUES (auth.uid(), current_date, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET count = public.dash_ai_usage.count + 1
  RETURNING count INTO used;
  RETURN used <= LEAST(GREATEST(p_limit, 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.dash_ai_take(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dash_ai_take(INTEGER) TO authenticated;

-- ===== 20261001140000_digital_dash_push.sql =====
-- Digital Dash reminders: push subscriptions per device, and the reminders each account has scheduled.
-- The app writes reminders ahead of time; the dash-push Edge Function (run every minute by pg_cron)
-- sends the ones that are due as Web Push notifications.

CREATE TABLE IF NOT EXISTS public.dash_push_subs (
  endpoint TEXT PRIMARY KEY,                 -- one row per browser/device subscription
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.dash_push_subs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own push subscriptions"
  ON public.dash_push_subs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users remove their own push subscriptions"
  ON public.dash_push_subs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Registers (or moves) this device's subscription to the signed-in user. A device that someone else
-- used before is reassigned, which a plain upsert can't do under row level security.
CREATE OR REPLACE FUNCTION public.dash_push_register(p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_device TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_endpoint !~ '^https://' THEN RAISE EXCEPTION 'Bad endpoint'; END IF;
  INSERT INTO public.dash_push_subs (endpoint, user_id, p256dh, auth, device)
  VALUES (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_device, 60))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, created_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.dash_push_register(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dash_push_register(TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.dash_reminders (
  id TEXT NOT NULL,                          -- "<user id>:<tag>:<time>", so every device writes the same ids
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind TEXT NOT NULL,                        -- due | event | morning | timer | test
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tag TEXT,
  url TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, id)                  -- keyed per user, so nobody can claim another account's ids
);
CREATE INDEX IF NOT EXISTS dash_reminders_pending ON public.dash_reminders (at) WHERE sent_at IS NULL;
ALTER TABLE public.dash_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own reminders"
  ON public.dash_reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users schedule their own reminders"
  ON public.dash_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users change their own reminders"
  ON public.dash_reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel their own reminders"
  ON public.dash_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Record the migrations as applied (same format the Supabase CLI uses).
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20260226013640', 'bcec28c4-2608-42ac-ac04-608ef57e5dc7') ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261001120000', 'digital_dash_accounts') ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261001130000', 'digital_dash_ai') ON CONFLICT (version) DO NOTHING;
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261001140000', 'digital_dash_push') ON CONFLICT (version) DO NOTHING;

COMMIT;
