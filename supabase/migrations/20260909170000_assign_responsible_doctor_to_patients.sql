begin;

alter table public.patients
  add column responsible_doctor_id uuid;

alter table public.patients
  add constraint patients_responsible_doctor_fkey
  foreign key (responsible_doctor_id, organization_id)
  references public.doctors(id, organization_id)
  on delete restrict;

with ranked_assignments as (
  select distinct on (ce.organization_id, ce.patient_id)
    ce.organization_id,
    ce.patient_id,
    ce.doctor_id
  from public.care_episodes ce
  order by
    ce.organization_id,
    ce.patient_id,
    case when ce.status in ('planned', 'preoperative', 'postoperative') then 0 else 1 end,
    ce.created_at desc
)
update public.patients p
set responsible_doctor_id = selected.doctor_id
from ranked_assignments selected
where p.organization_id = selected.organization_id
  and p.id = selected.patient_id
  and p.responsible_doctor_id is null;

create index patients_responsible_doctor_idx
  on public.patients (organization_id, responsible_doctor_id)
  where responsible_doctor_id is not null;

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
      from public.patients p
      where p.organization_id = target_organization_id
        and p.id = target_patient_id
        and p.responsible_doctor_id = private.current_doctor_id(target_organization_id)
    )
    or exists (
      select 1
      from public.patients p
      join public.care_episodes ce
        on ce.organization_id = p.organization_id
       and ce.patient_id = p.id
      where p.organization_id = target_organization_id
        and p.id = target_patient_id
        and p.responsible_doctor_id is null
        and ce.doctor_id = private.current_doctor_id(target_organization_id)
    );
$$;

drop policy patients_insert on public.patients;
create policy patients_insert on public.patients for insert to authenticated
with check (
  responsible_doctor_id is not null
  and (
    private.is_platform_admin()
    or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
    or (
      private.has_organization_role(organization_id, array['doctor']::public.app_role[])
      and responsible_doctor_id = private.current_doctor_id(organization_id)
    )
  )
);

create or replace function public.assign_patient_doctor(
  target_patient_id uuid,
  target_doctor_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_organization_id uuid;
  previous_doctor_id uuid;
  changed_episode_count integer := 0;
begin
  select p.organization_id, p.responsible_doctor_id
  into resolved_organization_id, previous_doctor_id
  from public.patients p
  where p.id = target_patient_id;

  if resolved_organization_id is null then
    raise exception 'patient unavailable' using errcode = '22023';
  end if;

  if not (
    private.is_platform_admin()
    or private.has_organization_role(
      resolved_organization_id,
      array['organization_admin', 'staff']::public.app_role[]
    )
  ) then
    raise exception 'doctor assignment requires organization administration' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.doctors d
    where d.id = target_doctor_id
      and d.organization_id = resolved_organization_id
      and d.status = 'active'
  ) then
    raise exception 'active doctor unavailable' using errcode = '22023';
  end if;

  if previous_doctor_id is not distinct from target_doctor_id then
    return 0;
  end if;

  update public.patients
  set responsible_doctor_id = target_doctor_id
  where id = target_patient_id
    and organization_id = resolved_organization_id;

  update public.care_episodes
  set doctor_id = target_doctor_id
  where patient_id = target_patient_id
    and organization_id = resolved_organization_id
    and status in ('planned', 'preoperative', 'postoperative');
  get diagnostics changed_episode_count = row_count;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    resolved_organization_id,
    (select auth.uid()),
    'patient.doctor_reassigned',
    'patient',
    target_patient_id,
    jsonb_build_object(
      'previous_doctor_id', previous_doctor_id,
      'responsible_doctor_id', target_doctor_id,
      'active_episodes_updated', changed_episode_count
    )
  );

  return changed_episode_count;
end;
$$;

revoke all on function public.assign_patient_doctor(uuid, uuid) from public;
grant execute on function public.assign_patient_doctor(uuid, uuid) to authenticated;

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
  responsible_doctor_id uuid;
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

  select p.responsible_doctor_id into responsible_doctor_id
  from public.patients p
  where p.id = target_patient_id
    and p.organization_id = resolved_organization_id;

  if responsible_doctor_id is null
     or target_doctor_id is distinct from responsible_doctor_id
     or not exists (
       select 1 from public.doctors d
       where d.id = responsible_doctor_id
         and d.organization_id = resolved_organization_id
         and d.status = 'active'
     ) then
    raise exception 'patient responsible doctor unavailable' using errcode = '22023';
  end if;

  if private.has_organization_role(resolved_organization_id, array['doctor']::public.app_role[])
     and responsible_doctor_id <> private.current_doctor_id(resolved_organization_id) then
    raise exception 'doctor may only create own episode' using errcode = '42501';
  end if;

  insert into public.care_episodes (
    organization_id, patient_id, doctor_id, procedure_name, procedure_date, status
  ) values (
    resolved_organization_id, target_patient_id, responsible_doctor_id,
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
