revoke all on all tables in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

drop policy if exists "Allow private household uploads" on storage.objects;
drop policy if exists "Allow private household photo updates" on storage.objects;
drop policy if exists "Allow private household photo deletes" on storage.objects;

drop policy if exists "Allow private household photo reads" on storage.objects;
create policy "Allow private household photo reads"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'room-photos');
