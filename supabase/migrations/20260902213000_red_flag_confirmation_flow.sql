begin;

create type public.red_flag_priority as enum ('home_guidance', 'contact_surgeon', 'immediate_emergency');
create type public.red_flag_confirmation_status as enum ('pending', 'confirmed', 'rejected', 'superseded');

alter table public.red_flag_rules
  add column category text,
  add column signal text,
  add column priority public.red_flag_priority,
  add column recommended_action text;

update public.red_flag_rules
set category = coalesce(configuration->>'category', description, 'Sem categoria'),
    signal = name,
    priority = coalesce(
      (configuration->>'priority')::public.red_flag_priority,
      case severity when 'critical' then 'immediate_emergency'::public.red_flag_priority when 'high' then 'contact_surgeon'::public.red_flag_priority else 'home_guidance'::public.red_flag_priority end
    ),
    recommended_action = coalesce(configuration->>'recommended_action', 'Contatar a equipe responsável');

alter table public.red_flag_rules
  alter column category set not null,
  alter column signal set not null,
  alter column priority set not null,
  alter column recommended_action set not null;

create or replace function private.sync_red_flag_rule_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.category := coalesce(new.configuration->>'category', new.description, new.category, 'Sem categoria');
  new.signal := coalesce(new.configuration->>'signal', new.name, new.signal);
  new.priority := coalesce(
    (new.configuration->>'priority')::public.red_flag_priority,
    new.priority,
    case new.severity when 'critical' then 'immediate_emergency'::public.red_flag_priority when 'high' then 'contact_surgeon'::public.red_flag_priority else 'home_guidance'::public.red_flag_priority end
  );
  new.recommended_action := coalesce(new.configuration->>'recommended_action', new.recommended_action, 'Contatar a equipe responsável');
  return new;
end;
$$;

create trigger red_flag_rules_sync_fields
before insert or update of name, description, severity, configuration, category, signal, priority, recommended_action
on public.red_flag_rules
for each row execute function private.sync_red_flag_rule_fields();

alter table public.red_flag_rules
  add constraint red_flag_rules_canonical_fields_check check (
    configuration->>'source' <> 'public/redflags.csv'
    or (
      nullif(trim(category), '') is not null
      and nullif(trim(signal), '') is not null
      and priority is not null
      and nullif(trim(recommended_action), '') is not null
    )
  );

create table public.red_flag_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null,
  conversation_id uuid not null,
  patient_id uuid not null,
  source_message_id uuid not null,
  prompt_message_id uuid,
  response_message_id uuid,
  status public.red_flag_confirmation_status not null default 'pending',
  detected_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (rule_id, organization_id) references public.red_flag_rules(id, organization_id) on delete cascade,
  foreign key (conversation_id, organization_id) references public.conversations(id, organization_id) on delete cascade,
  foreign key (patient_id, organization_id) references public.patients(id, organization_id) on delete cascade,
  foreign key (source_message_id, organization_id) references public.messages(id, organization_id) on delete cascade,
  foreign key (prompt_message_id, organization_id) references public.messages(id, organization_id) on delete set null,
  foreign key (response_message_id, organization_id) references public.messages(id, organization_id) on delete set null,
  check ((status = 'pending' and responded_at is null) or status <> 'pending')
);

create unique index red_flag_confirmations_one_pending_per_conversation
  on public.red_flag_confirmations(conversation_id)
  where status = 'pending';
create index red_flag_confirmations_org_status_idx
  on public.red_flag_confirmations(organization_id, status, detected_at desc);

create trigger red_flag_confirmations_set_updated_at
before update on public.red_flag_confirmations
for each row execute function private.set_updated_at();

alter table public.red_flag_confirmations enable row level security;
alter table public.red_flag_confirmations force row level security;

create policy red_flag_confirmations_select on public.red_flag_confirmations
for select to authenticated using (private.is_platform_admin() or private.is_organization_member(organization_id));

create policy red_flag_confirmations_patient_select on public.red_flag_confirmations
for select to authenticated using (
  exists (
    select 1 from public.patients p
    where p.id = patient_id
      and p.organization_id = organization_id
      and p.auth_user_id = (select auth.uid())
      and p.status = 'active'
  )
);

grant select on public.red_flag_confirmations to authenticated;

commit;
