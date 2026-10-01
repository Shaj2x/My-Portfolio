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
