begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.organization_status as enum ('active', 'suspended', 'inactive');
create type public.app_role as enum ('platform_admin', 'organization_admin', 'doctor', 'staff');
create type public.member_status as enum ('active', 'invited', 'inactive');
create type public.doctor_status as enum ('active', 'inactive');
create type public.patient_status as enum ('active', 'inactive');
create type public.care_episode_status as enum ('planned', 'preoperative', 'postoperative', 'completed', 'cancelled');
create type public.conversation_status as enum ('open', 'closed', 'archived');
create type public.conversation_mode as enum ('ai', 'waiting_doctor', 'doctor');
create type public.message_sender_type as enum ('patient', 'ai', 'doctor', 'staff', 'system');
create type public.red_flag_rule_status as enum ('active', 'inactive');
create type public.red_flag_event_status as enum ('new', 'acknowledged', 'resolved', 'dismissed');
create type public.alert_severity as enum ('low', 'medium', 'high', 'critical');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.organization_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null check (role <> 'platform_admin'),
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 2 and 160),
  specialty text,
  professional_registration text,
  status public.doctor_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, user_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 160),
  preferred_name text,
  email text,
  phone text,
  birth_date date,
  status public.patient_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.care_episodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid not null,
  procedure_name text not null check (char_length(trim(procedure_name)) between 2 and 200),
  procedure_date date,
  status public.care_episode_status not null default 'planned',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients(id, organization_id) on delete cascade,
  foreign key (doctor_id, organization_id) references public.doctors(id, organization_id) on delete restrict,
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null,
  care_episode_id uuid,
  status public.conversation_status not null default 'open',
  mode public.conversation_mode not null default 'ai',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients(id, organization_id) on delete cascade,
  foreign key (care_episode_id, organization_id) references public.care_episodes(id, organization_id) on delete set null
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null,
  sender_type public.message_sender_type not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  content text not null check (char_length(trim(content)) > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (conversation_id, organization_id) references public.conversations(id, organization_id) on delete cascade
);

create table public.red_flag_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  severity public.alert_severity not null default 'medium',
  status public.red_flag_rule_status not null default 'active',
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.red_flag_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid,
  conversation_id uuid not null,
  message_id uuid,
  severity public.alert_severity not null,
  status public.red_flag_event_status not null default 'new',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (rule_id, organization_id) references public.red_flag_rules(id, organization_id) on delete set null,
  foreign key (conversation_id, organization_id) references public.conversations(id, organization_id) on delete cascade,
  foreign key (message_id, organization_id) references public.messages(id, organization_id) on delete set null
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(trim(action)) between 2 and 120),
  entity_type text not null check (char_length(trim(entity_type)) between 2 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index organization_memberships_user_idx on public.organization_memberships(user_id, status);
create index doctors_org_idx on public.doctors(organization_id, status);
create index patients_org_name_idx on public.patients(organization_id, full_name);
create index care_episodes_org_patient_idx on public.care_episodes(organization_id, patient_id, status);
create index conversations_org_recent_idx on public.conversations(organization_id, last_message_at desc nulls last);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index red_flag_events_org_status_idx on public.red_flag_events(organization_id, status, created_at desc);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and o.status = 'active'
  );
$$;

create or replace function private.has_organization_role(target_organization_id uuid, allowed_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and o.status = 'active'
      and om.role = any(allowed_roles)
  );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger memberships_set_updated_at before update on public.organization_memberships for each row execute function private.set_updated_at();
create trigger doctors_set_updated_at before update on public.doctors for each row execute function private.set_updated_at();
create trigger patients_set_updated_at before update on public.patients for each row execute function private.set_updated_at();
create trigger care_episodes_set_updated_at before update on public.care_episodes for each row execute function private.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations for each row execute function private.set_updated_at();
create trigger red_flag_rules_set_updated_at before update on public.red_flag_rules for each row execute function private.set_updated_at();
create trigger red_flag_events_set_updated_at before update on public.red_flag_events for each row execute function private.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.care_episodes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.red_flag_rules enable row level security;
alter table public.red_flag_events enable row level security;
alter table public.audit_logs enable row level security;

alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.organization_memberships force row level security;
alter table public.doctors force row level security;
alter table public.patients force row level security;
alter table public.care_episodes force row level security;
alter table public.conversations force row level security;
alter table public.messages force row level security;
alter table public.red_flag_rules force row level security;
alter table public.red_flag_events force row level security;
alter table public.audit_logs force row level security;

create policy organizations_select on public.organizations for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(id));
create policy organizations_insert on public.organizations for insert to authenticated
with check (private.is_platform_admin());
create policy organizations_update on public.organizations for update to authenticated
using (private.is_platform_admin() or private.has_organization_role(id, array['organization_admin']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(id, array['organization_admin']::public.app_role[]));

create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.is_platform_admin()
  or exists (
    select 1 from public.organization_memberships viewer
    join public.organization_memberships subject on subject.organization_id = viewer.organization_id
    where viewer.user_id = (select auth.uid()) and viewer.status = 'active' and subject.user_id = profiles.id
  )
);
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid()) or private.is_platform_admin())
with check (id = (select auth.uid()) or private.is_platform_admin());

create policy platform_admins_select_self on public.platform_admins for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_admin());

create policy memberships_select on public.organization_memberships for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy memberships_insert on public.organization_memberships for insert to authenticated
with check (role <> 'platform_admin' and (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[])));
create policy memberships_update on public.organization_memberships for update to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[]))
with check (role <> 'platform_admin' and (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[])));
create policy memberships_delete on public.organization_memberships for delete to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[]));

create policy doctors_select on public.doctors for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy doctors_write on public.doctors for all to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[]));

create policy patients_select on public.patients for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy patients_insert on public.patients for insert to authenticated
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]));
create policy patients_update on public.patients for update to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]));

create policy care_episodes_select on public.care_episodes for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy care_episodes_write on public.care_episodes for all to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]));

create policy conversations_select on public.conversations for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy conversations_write on public.conversations for all to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]));

create policy messages_select on public.messages for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy messages_insert on public.messages for insert to authenticated
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]));

create policy red_flag_rules_select on public.red_flag_rules for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy red_flag_rules_write on public.red_flag_rules for all to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor']::public.app_role[]));

create policy red_flag_events_select on public.red_flag_events for select to authenticated
using (private.is_platform_admin() or private.is_organization_member(organization_id));
create policy red_flag_events_write on public.red_flag_events for all to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]))
with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin','doctor','staff']::public.app_role[]));

create policy audit_logs_select on public.audit_logs for select to authenticated
using (private.is_platform_admin() or private.has_organization_role(organization_id, array['organization_admin']::public.app_role[]));
create policy audit_logs_insert on public.audit_logs for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (private.is_platform_admin() or private.is_organization_member(organization_id))
);

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, public.app_role[]) to authenticated;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.organizations, public.profiles, public.organization_memberships,
  public.doctors, public.patients, public.care_episodes, public.conversations, public.messages,
  public.red_flag_rules, public.red_flag_events, public.audit_logs to authenticated;
grant select on public.platform_admins to authenticated;

commit;
