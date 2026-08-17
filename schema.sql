
create table if not exists periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  starting_amount numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references periods(id) on delete cascade,
  item text not null,
  price numeric not null,
  created_at timestamptz not null default now()
);

alter table periods enable row level security;
alter table purchases enable row level security;

create policy "authenticated can read periods"
  on periods for select
  using (auth.role() = 'authenticated');

create policy "authenticated can insert periods"
  on periods for insert
  with check (auth.role() = 'authenticated');

create policy "authenticated can read purchases"
  on purchases for select
  using (auth.role() = 'authenticated');

create policy "authenticated can insert purchases"
  on purchases for insert
  with check (auth.role() = 'authenticated');

create policy "authenticated can delete purchases"
  on purchases for delete
  using (auth.role() = 'authenticated');
