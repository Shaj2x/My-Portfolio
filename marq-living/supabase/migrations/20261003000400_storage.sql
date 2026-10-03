-- Marq Living — private storage for ticket photos and attachments.
-- Files live at ticket-photos/<uploader user id>/<filename>. Tenants can
-- upload to and read their own folder; staff can read everything and upload
-- to their own folder (replies with attachments).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-photos', 'ticket-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy ticket_photos_upload_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and public.is_approved()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ticket_photos_read_own on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ticket_photos_read_staff on storage.objects for select to authenticated
  using (bucket_id = 'ticket-photos' and public.is_staff());
