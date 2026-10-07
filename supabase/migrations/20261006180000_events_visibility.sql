alter table public.events
  add column if not exists visibility text not null default 'private';

alter table public.events
  drop constraint if exists events_visibility_check;

alter table public.events
  add constraint events_visibility_check
  check (visibility in ('public', 'private'));

create index if not exists events_public_board_idx
  on public.events (event_date, id)
  where visibility = 'public';

drop policy if exists "events public board read" on public.events;

create policy "events public board read"
  on public.events
  for select
  to anon
  using (visibility = 'public');

comment on column public.events.visibility is
  'Controls public event board visibility. public is shown on /eventos/; private is internal only.';
