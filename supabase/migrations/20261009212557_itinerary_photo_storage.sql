-- Private itinerary photo storage is separate from PDF-only document storage.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('itinerary-images','itinerary-images',false,5242880,array['image/jpeg','image/png'])
on conflict(id) do nothing;
create policy itinerary_photo_read on storage.objects for select to authenticated
using(bucket_id='itinerary-images' and (select private.current_role()) in ('admin','agent'));
create policy itinerary_photo_insert on storage.objects for insert to authenticated
with check(bucket_id='itinerary-images' and (select private.current_role()) in ('admin','agent'));
-- Immutable UUID names: replacements create new objects; update/upsert is not exposed.
