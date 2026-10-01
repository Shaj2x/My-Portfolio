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
