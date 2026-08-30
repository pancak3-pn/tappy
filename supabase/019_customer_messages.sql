create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) <= 100),
  customer_email text not null check (char_length(customer_email) <= 160),
  subject text not null check (char_length(subject) <= 180),
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0 check (unread_count >= 0),
  created_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  sender_email text not null check (char_length(sender_email) <= 160),
  recipient_email text not null check (char_length(recipient_email) <= 160),
  subject text not null check (char_length(subject) <= 180),
  body_text text not null check (char_length(body_text) <= 10000),
  provider_email_id text,
  provider_message_id text,
  delivery_status text not null default 'sent' check (delivery_status in ('queued', 'sent', 'failed', 'received')),
  created_at timestamptz not null default now()
);

create index if not exists email_threads_last_message_idx on public.email_threads (last_message_at desc);
create index if not exists email_messages_thread_created_idx on public.email_messages (thread_id, created_at);

alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
