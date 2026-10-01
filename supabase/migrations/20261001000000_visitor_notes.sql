-- Notes visitors leave in the 3D room, by typing on the desk keyboard. Public guestbook:
-- anyone can read and add notes; nobody can edit or delete them from the site.
CREATE TABLE public.visitor_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'A visitor' CHECK (char_length(name) BETWEEN 1 AND 40),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.visitor_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can leave a note"
  ON public.visitor_notes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read the notes"
  ON public.visitor_notes
  FOR SELECT
  USING (true);
