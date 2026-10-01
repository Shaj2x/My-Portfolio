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
