-- Ginti: initial schema.
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Every table is scoped to its owner through row level security.

create type public.account_kind as enum ('bank', 'cash', 'credit', 'wallet');
create type public.txn_kind as enum ('expense', 'income', 'transfer');
create type public.txn_source as enum ('manual', 'ai', 'receipt', 'recurring');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency text not null default 'INR',
  monthly_budget numeric(14, 2),
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind public.account_kind not null,
  last4 text check (last4 ~ '^[0-9]{4}$'),
  color text not null default '#C8FF4D',
  opening_balance numeric(14, 2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null default 'dot',
  kind public.txn_kind not null default 'expense',
  monthly_budget numeric(14, 2),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  kind public.txn_kind not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  source public.txn_source not null default 'manual',
  created_at timestamptz not null default now(),
  check ((kind = 'transfer') = (to_account_id is not null))
);

create index transactions_user_time on public.transactions (user_id, occurred_at desc);
create index transactions_account on public.transactions (account_id);

create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own accounts" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own categories" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own recurring" on public.recurring
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Transactions may only point at accounts the user owns.
create policy "own transactions" on public.transactions
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
    and (to_account_id is null
         or exists (select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid()))
  );

-- Live balance per account: opening balance, plus income and transfers in,
-- minus expenses and transfers out.
create view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.opening_balance
    + coalesce(sum(case
        when t.kind = 'income' and t.account_id = a.id then t.amount
        when t.kind = 'expense' and t.account_id = a.id then -t.amount
        when t.kind = 'transfer' and t.account_id = a.id then -t.amount
        when t.kind = 'transfer' and t.to_account_id = a.id then t.amount
      end), 0) as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id or t.to_account_id = a.id
group by a.id;

-- New users get a profile, a cash wallet and the default categories.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into public.accounts (user_id, name, kind, color)
  values (new.id, 'Cash wallet', 'cash', '#C8FF4D');

  insert into public.categories (user_id, name, color, icon, kind, sort) values
    (new.id, 'Food', '#FF8A4C', 'food', 'expense', 1),
    (new.id, 'Home', '#5B8CFF', 'home', 'expense', 2),
    (new.id, 'Shopping', '#FF5FA2', 'bag', 'expense', 3),
    (new.id, 'Travel', '#4CC9FF', 'bus', 'expense', 4),
    (new.id, 'Bills', '#FFD23F', 'bolt', 'expense', 5),
    (new.id, 'Health', '#3DDC97', 'heart', 'expense', 6),
    (new.id, 'Fun', '#9B8CFF', 'game', 'expense', 7),
    (new.id, 'Other', '#8A90A2', 'dot', 'expense', 8),
    (new.id, 'Salary', '#C8FF4D', 'wallet', 'income', 1),
    (new.id, 'Other income', '#3DDC97', 'dot', 'income', 2);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who signed up before this script ran (the app also seeds itself if empty).
do $$
declare u record;
begin
  for u in select * from auth.users au
           where not exists (select 1 from public.profiles p where p.id = au.id)
  loop
    insert into public.profiles (id, display_name) values (u.id, split_part(u.email, '@', 1));
    if not exists (select 1 from public.accounts a where a.user_id = u.id) then
      insert into public.accounts (user_id, name, kind, color) values (u.id, 'Cash wallet', 'cash', '#C8FF4D');
    end if;
    insert into public.categories (user_id, name, color, icon, kind, sort) values
      (u.id, 'Food', '#FF8A4C', 'food', 'expense', 1),
      (u.id, 'Home', '#5B8CFF', 'home', 'expense', 2),
      (u.id, 'Shopping', '#FF5FA2', 'bag', 'expense', 3),
      (u.id, 'Travel', '#4CC9FF', 'bus', 'expense', 4),
      (u.id, 'Bills', '#FFD23F', 'bolt', 'expense', 5),
      (u.id, 'Health', '#3DDC97', 'heart', 'expense', 6),
      (u.id, 'Fun', '#9B8CFF', 'game', 'expense', 7),
      (u.id, 'Other', '#8A90A2', 'dot', 'expense', 8),
      (u.id, 'Salary', '#C8FF4D', 'wallet', 'income', 1),
      (u.id, 'Other income', '#3DDC97', 'dot', 'income', 2)
    on conflict (user_id, name, kind) do nothing;
  end loop;
end $$;
