set statement_timeout = '60s';

-- Producers may open their own published cards for editing. Saving through the
-- Producer Ready form must return the beat to draft/inactive so it cannot keep
-- selling while its metadata or files are being changed.
drop policy if exists "store products producer edit published" on public.store_products;
create policy "store products producer edit published"
on public.store_products for update
to authenticated
using (
  category = 'beats'
  and producer_user_id = auth.uid()
  and public.is_approved_producer(auth.uid())
  and publication_status in ('pending_review', 'published', 'inactive')
)
with check (
  category = 'beats'
  and producer_user_id = auth.uid()
  and publication_status = 'draft'
  and is_active = false
  and (
    producer_profile_id is null
    or exists (
      select 1
      from public.producer_profiles profiles
      where profiles.id = producer_profile_id
        and profiles.user_id = auth.uid()
    )
  )
);
