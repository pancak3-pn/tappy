alter table public.orders
  add column if not exists payment_approved_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz;

