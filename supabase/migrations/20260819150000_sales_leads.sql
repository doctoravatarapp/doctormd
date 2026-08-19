create table public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(phone) between 8 and 30),
  organization_name text check (organization_name is null or char_length(organization_name) <= 160),
  team_size text check (team_size is null or team_size in ('solo', '2-5', '6-15', '16-50', '51+')),
  primary_goal text check (primary_goal is null or primary_goal in ('productivity', 'follow-up', 'patient-experience', 'automation', 'other')),
  consent_at timestamptz not null,
  source text not null default 'landing_page',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  metadata jsonb not null default '{}'::jsonb
);

create index sales_leads_status_created_at_idx on public.sales_leads (status, created_at desc);
create index sales_leads_email_created_at_idx on public.sales_leads (lower(email), created_at desc);

alter table public.sales_leads enable row level security;
revoke all on table public.sales_leads from anon, authenticated;

comment on table public.sales_leads is 'Commercial leads submitted through the public APolloMD landing page; no clinical data.';
