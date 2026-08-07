begin;

alter table public.patients
  add column auth_user_id uuid references auth.users(id) on delete set null;

alter table public.patients
  add constraint patients_organization_auth_user_key unique (organization_id, auth_user_id);

create index patients_auth_user_idx on public.patients(auth_user_id) where auth_user_id is not null;

create or replace function private.current_doctor_id(target_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id
  from public.doctors d
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
      join public.doctors d on d.id = ce.doctor_id and d.organization_id = ce.organization_id
      where ce.organization_id = target_organization_id
        and ce.patient_id = target_patient_id
        and d.user_id = (select auth.uid())
        and d.status = 'active'
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
      join public.doctors d on d.id = ce.doctor_id and d.organization_id = ce.organization_id
      where ce.organization_id = target_organization_id
        and ce.id = target_episode_id
        and d.user_id = (select auth.uid())
        and d.status = 'active'
    );
$$;

drop policy patients_select on public.patients;
drop policy patients_insert on public.patients;
drop policy patients_update on public.patients;

create policy patients_select on public.patients for select to authenticated
using (private.can_access_patient(organization_id, id));
create policy patients_insert on public.patients for insert to authenticated
with check (
  private.is_platform_admin()
  or private.has_organization_role(
    organization_id,
    array['organization_admin', 'doctor', 'staff']::public.app_role[]
  )
);
create policy patients_update on public.patients for update to authenticated
using (private.can_access_patient(organization_id, id))
with check (private.can_access_patient(organization_id, id));

drop policy care_episodes_select on public.care_episodes;
drop policy care_episodes_write on public.care_episodes;

create policy care_episodes_select on public.care_episodes for select to authenticated
using (private.can_access_episode(organization_id, id));
create policy care_episodes_insert on public.care_episodes for insert to authenticated
with check (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or (
    private.has_organization_role(organization_id, array['doctor']::public.app_role[])
    and doctor_id = private.current_doctor_id(organization_id)
  )
);
create policy care_episodes_update on public.care_episodes for update to authenticated
using (private.can_access_episode(organization_id, id))
with check (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or doctor_id = private.current_doctor_id(organization_id)
);

drop policy conversations_select on public.conversations;
drop policy conversations_write on public.conversations;

create policy conversations_select on public.conversations for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or (care_episode_id is not null and private.can_access_episode(organization_id, care_episode_id))
);
create policy conversations_insert on public.conversations for insert to authenticated
with check (
  private.can_access_patient(organization_id, patient_id)
  and (care_episode_id is null or private.can_access_episode(organization_id, care_episode_id))
);
create policy conversations_update on public.conversations for update to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or (care_episode_id is not null and private.can_access_episode(organization_id, care_episode_id))
)
with check (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or (care_episode_id is not null and private.can_access_episode(organization_id, care_episode_id))
);

drop policy messages_select on public.messages;
drop policy messages_insert on public.messages;

create policy messages_select on public.messages for select to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.organization_id = messages.organization_id
  )
);
create policy messages_insert on public.messages for insert to authenticated
with check (
  sender_user_id = (select auth.uid())
  and sender_type in ('doctor', 'staff')
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.organization_id = messages.organization_id
  )
);

grant execute on function private.current_doctor_id(uuid) to authenticated;
grant execute on function private.can_access_patient(uuid, uuid) to authenticated;
grant execute on function private.can_access_episode(uuid, uuid) to authenticated;

create or replace function public.create_care_episode(
  target_patient_id uuid,
  target_doctor_id uuid,
  target_procedure_name text,
  target_procedure_date date default null,
  target_status public.care_episode_status default 'planned'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_organization_id uuid;
  created_episode_id uuid;
begin
  select om.organization_id into resolved_organization_id
  from public.organization_memberships om
  where om.user_id = (select auth.uid())
    and om.status = 'active'
    and om.role in ('organization_admin', 'doctor', 'staff')
  order by om.created_at
  limit 1;

  if resolved_organization_id is null then
    raise exception 'active organization membership required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = target_patient_id and p.organization_id = resolved_organization_id
  ) or not exists (
    select 1 from public.doctors d
    where d.id = target_doctor_id and d.organization_id = resolved_organization_id and d.status = 'active'
  ) then
    raise exception 'patient or doctor unavailable' using errcode = '22023';
  end if;

  if private.has_organization_role(resolved_organization_id, array['doctor']::public.app_role[])
     and target_doctor_id <> private.current_doctor_id(resolved_organization_id) then
    raise exception 'doctor may only create own episode' using errcode = '42501';
  end if;

  insert into public.care_episodes (
    organization_id, patient_id, doctor_id, procedure_name, procedure_date, status
  ) values (
    resolved_organization_id, target_patient_id, target_doctor_id,
    trim(target_procedure_name), target_procedure_date, target_status
  ) returning id into created_episode_id;

  insert into public.conversations (organization_id, patient_id, care_episode_id, status, mode)
  values (resolved_organization_id, target_patient_id, created_episode_id, 'open', 'ai');

  return created_episode_id;
end;
$$;

revoke all on function public.create_care_episode(uuid, uuid, text, date, public.care_episode_status) from public;
grant execute on function public.create_care_episode(uuid, uuid, text, date, public.care_episode_status) to authenticated;

commit;
