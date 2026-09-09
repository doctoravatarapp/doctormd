begin;

alter table public.doctors
  add column email text;

update public.doctors d
set email = lower(u.email)
from auth.users u
where d.user_id = u.id
  and u.email is not null;

alter table public.doctors
  add constraint doctors_email_format_check check (
    email is null
    or (
      char_length(email) between 3 and 254
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

create unique index doctors_organization_email_key
  on public.doctors (organization_id, lower(email))
  where email is not null;

create or replace function private.current_doctor_id(target_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id
  from public.doctors d
  join public.organization_memberships om
    on om.organization_id = d.organization_id
   and om.user_id = d.user_id
   and om.role = 'doctor'
   and om.status = 'active'
  where d.organization_id = target_organization_id
    and d.user_id = (select auth.uid())
    and d.status = 'active'
  limit 1;
$$;

create or replace function private.can_access_patient(target_organization_id uuid, target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or private.has_organization_role(
      target_organization_id,
      array['organization_admin', 'staff']::public.app_role[]
    )
    or exists (
      select 1
      from public.care_episodes ce
      where ce.organization_id = target_organization_id
        and ce.patient_id = target_patient_id
        and ce.doctor_id = private.current_doctor_id(target_organization_id)
    );
$$;

create or replace function private.can_access_episode(target_organization_id uuid, target_episode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or private.has_organization_role(
      target_organization_id,
      array['organization_admin', 'staff']::public.app_role[]
    )
    or exists (
      select 1
      from public.care_episodes ce
      where ce.organization_id = target_organization_id
        and ce.id = target_episode_id
        and ce.doctor_id = private.current_doctor_id(target_organization_id)
    );
$$;

drop policy red_flag_events_select on public.red_flag_events;
create policy red_flag_events_select on public.red_flag_events
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or exists (
    select 1
    from public.conversations c
    where c.id = red_flag_events.conversation_id
      and c.organization_id = red_flag_events.organization_id
      and c.care_episode_id is not null
      and private.can_access_episode(c.organization_id, c.care_episode_id)
  )
);

drop policy red_flag_confirmations_select on public.red_flag_confirmations;
create policy red_flag_confirmations_select on public.red_flag_confirmations
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or exists (
    select 1
    from public.conversations c
    where c.id = red_flag_confirmations.conversation_id
      and c.organization_id = red_flag_confirmations.organization_id
      and c.care_episode_id is not null
      and private.can_access_episode(c.organization_id, c.care_episode_id)
  )
);

commit;
