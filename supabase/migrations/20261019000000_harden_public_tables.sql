-- Hardening the two tables the public can write to.
--
-- contact_submissions had no size limits, and visitor_notes had no protection against spam
-- links or a flood of notes. These constraints only check new rows (NOT VALID), so anything
-- already saved stays as it is.

-- contact form: sensible sizes, and an email that looks like one
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_name_len CHECK (char_length(name) BETWEEN 1 AND 80) NOT VALID,
  ADD CONSTRAINT contact_email_len CHECK (char_length(email) BETWEEN 3 AND 200) NOT VALID,
  ADD CONSTRAINT contact_email_shape CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$') NOT VALID,
  ADD CONSTRAINT contact_message_len CHECK (char_length(message) BETWEEN 1 AND 4000) NOT VALID;

-- guestbook: no links (that's how spam gets in)
ALTER TABLE public.visitor_notes
  ADD CONSTRAINT notes_no_links CHECK (
    message !~* '(https?://|www\.|\.(com|net|org|io|xyz|ru|cn|top|link|click)(/|\s|$))'
    AND name !~* '(https?://|www\.)'
  ) NOT VALID;

-- guestbook and contact form: a flood guard. If a burst of rows arrives (more than 15 notes or 5
-- contact messages in a minute, from anyone), further ones are turned away until it calms down.
CREATE OR REPLACE FUNCTION public.flood_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recent integer;
  cap integer := CASE TG_TABLE_NAME WHEN 'visitor_notes' THEN 15 ELSE 5 END;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at > now() - interval ''1 minute''', TG_TABLE_NAME) INTO recent;
  IF recent >= cap THEN
    RAISE EXCEPTION 'Too many messages right now. Try again in a minute.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visitor_notes_flood_guard ON public.visitor_notes;
CREATE TRIGGER visitor_notes_flood_guard BEFORE INSERT ON public.visitor_notes
  FOR EACH ROW EXECUTE FUNCTION public.flood_guard();

DROP TRIGGER IF EXISTS contact_submissions_flood_guard ON public.contact_submissions;
CREATE TRIGGER contact_submissions_flood_guard BEFORE INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.flood_guard();

-- the anonymous role can't call the guard directly
REVOKE ALL ON FUNCTION public.flood_guard() FROM PUBLIC, anon, authenticated;
