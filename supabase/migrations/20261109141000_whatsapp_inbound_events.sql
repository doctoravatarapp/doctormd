-- Durable, private inbound transport inbox. No automatic patient matching.
create table if not exists public.whatsapp_inbound_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  provider_phone_number_id text not null,
  sender_wa_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text
);
create index if not exists whatsapp_inbound_events_status_received_idx
  on public.whatsapp_inbound_events(status, received_at);
alter table public.whatsapp_inbound_events enable row level security;
revoke all on public.whatsapp_inbound_events from anon, authenticated;
comment on table public.whatsapp_inbound_events is 'Private WhatsApp Cloud API transport inbox; clinical routing requires verified identity and consent.';
