-- Auto-imported entries from bank SMS and payment-app notifications.
alter type public.txn_source add value if not exists 'sms';
alter type public.txn_source add value if not exists 'notification';

-- The SMS or notification an entry came from, so the same message is never imported twice.
alter table public.transactions add column if not exists external_ref text;
create unique index if not exists transactions_external_ref
  on public.transactions (user_id, external_ref) where external_ref is not null;
