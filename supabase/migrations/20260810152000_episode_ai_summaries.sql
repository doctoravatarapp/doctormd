begin;

create table public.episode_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  care_episode_id uuid not null,
  summary_version integer not null,
  status text not null default 'generating' check (status in ('generating','completed','failed')),
  source_updated_at timestamptz not null,
  overview text,
  structured_content jsonb,
  model text not null,
  prompt_version text not null,
  usage jsonb,
  latency_ms integer,
  error_code text,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (care_episode_id, organization_id) references public.care_episodes(id, organization_id) on delete cascade,
  unique (care_episode_id, summary_version)
);

create unique index episode_ai_summaries_one_generating
  on public.episode_ai_summaries(care_episode_id) where status = 'generating';
create index episode_ai_summaries_latest
  on public.episode_ai_summaries(care_episode_id, summary_version desc);
create trigger episode_ai_summaries_updated before update on public.episode_ai_summaries
  for each row execute function private.set_updated_at();

alter table public.episode_ai_summaries enable row level security;
alter table public.episode_ai_summaries force row level security;
create policy episode_ai_summaries_select on public.episode_ai_summaries
  for select to authenticated
  using (private.can_access_episode(organization_id, care_episode_id));
grant select on public.episode_ai_summaries to authenticated;

commit;
