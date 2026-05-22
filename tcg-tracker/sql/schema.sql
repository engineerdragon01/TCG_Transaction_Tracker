-- TCG Tracker schema
-- Run this in Supabase SQL Editor after creating a new project.
-- Auth is handled by Supabase's built-in auth.users table.

-- ============================================================
-- Tables
-- ============================================================

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  location      text,
  start_date    date,
  end_date      date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index events_user_id_idx on public.events(user_id);
create index events_start_date_idx on public.events(start_date desc);

create type interaction_type as enum ('trade', 'sale', 'buy');

create table public.interactions (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            interaction_type not null,
  occurred_at     timestamptz not null default now(),
  cash_in         numeric(10,2) not null default 0,   -- cash you received
  cash_out        numeric(10,2) not null default 0,   -- cash you paid
  payment_method  text,                                -- 'cash' | 'venmo' | 'zelle' | etc.
  counterparty    text,                                -- optional name/handle
  notes           text,
  created_at      timestamptz not null default now()
);

create index interactions_event_id_idx on public.interactions(event_id);
create index interactions_user_id_idx on public.interactions(user_id);

create type card_direction as enum ('in', 'out');  -- in = you received, out = you gave

create table public.interaction_cards (
  id                uuid primary key default gen_random_uuid(),
  interaction_id    uuid not null references public.interactions(id) on delete cascade,
  direction         card_direction not null,
  tcg_card_id       text,           -- pokemontcg.io card id, e.g. "sv1-152"
  card_name         text not null,
  set_name          text,
  card_number       text,           -- e.g. "152/198"
  rarity            text,
  image_url         text,           -- canonical image from pokemontcg.io
  scan_image_url    text,           -- the user's own scan in supabase storage
  estimated_value   numeric(10,2),
  quantity          integer not null default 1,
  created_at        timestamptz not null default now()
);

create index interaction_cards_interaction_id_idx on public.interaction_cards(interaction_id);

create type image_kind as enum ('card', 'cash', 'screenshot', 'other');

create table public.interaction_images (
  id              uuid primary key default gen_random_uuid(),
  interaction_id  uuid not null references public.interactions(id) on delete cascade,
  storage_path    text not null,    -- path in supabase storage bucket
  kind            image_kind not null default 'other',
  created_at      timestamptz not null default now()
);

create index interaction_images_interaction_id_idx on public.interaction_images(interaction_id);

-- ============================================================
-- Net-value view (so the app doesn't have to recompute)
-- ============================================================
-- Positive net_value = you made money on this interaction.
-- (cash_in + value of cards received) - (cash_out + value of cards given)

create or replace view public.interaction_summary with (security_invoker = true) as
select
  i.id,
  i.event_id,
  i.user_id,
  i.type,
  i.occurred_at,
  i.cash_in,
  i.cash_out,
  coalesce((select sum(estimated_value * quantity)
            from public.interaction_cards
            where interaction_id = i.id and direction = 'in'), 0) as cards_in_value,
  coalesce((select sum(estimated_value * quantity)
            from public.interaction_cards
            where interaction_id = i.id and direction = 'out'), 0) as cards_out_value,
  (i.cash_in + coalesce((select sum(estimated_value * quantity)
                         from public.interaction_cards
                         where interaction_id = i.id and direction = 'in'), 0))
  -
  (i.cash_out + coalesce((select sum(estimated_value * quantity)
                          from public.interaction_cards
                          where interaction_id = i.id and direction = 'out'), 0)) as net_value
from public.interactions i;

-- ============================================================
-- PostgREST grants (required for Supabase Data API / JS client)
-- ============================================================
-- Tables created via raw SQL don't get these automatically.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.events             to authenticated;
grant select, insert, update, delete on public.interactions       to authenticated;
grant select, insert, update, delete on public.interaction_cards  to authenticated;
grant select, insert, update, delete on public.interaction_images to authenticated;
grant select                         on public.interaction_summary to authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.events             enable row level security;
alter table public.interactions       enable row level security;
alter table public.interaction_cards  enable row level security;
alter table public.interaction_images enable row level security;

create policy "own events"        on public.events            for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own interactions"  on public.interactions      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own interaction cards" on public.interaction_cards for all
  using (exists (select 1 from public.interactions where id = interaction_id and user_id = auth.uid()))
  with check (exists (select 1 from public.interactions where id = interaction_id and user_id = auth.uid()));

create policy "own interaction images" on public.interaction_images for all
  using (exists (select 1 from public.interactions where id = interaction_id and user_id = auth.uid()))
  with check (exists (select 1 from public.interactions where id = interaction_id and user_id = auth.uid()));

-- ============================================================
-- Storage bucket
-- ============================================================
-- After running this, manually create a Storage bucket named 'transaction-images'
-- in the Supabase dashboard, set it to PRIVATE, then run the policies below.

-- Policies for storage.objects (only run after the bucket exists):
-- create policy "own uploads read"   on storage.objects for select using (bucket_id = 'transaction-images' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "own uploads write"  on storage.objects for insert with check (bucket_id = 'transaction-images' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "own uploads delete" on storage.objects for delete using (bucket_id = 'transaction-images' and (storage.foldername(name))[1] = auth.uid()::text);
