begin;

alter table public.conversations add column generation_started_at timestamptz;
alter table public.messages add column client_message_id uuid;
create unique index messages_conversation_client_key
  on public.messages(conversation_id, client_message_id)
  where client_message_id is not null;

create or replace function private.is_current_patient(target_patient_id uuid, target_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patients p
    where p.id = target_patient_id
      and p.organization_id = target_organization_id
      and p.auth_user_id = (select auth.uid())
      and p.status = 'active'
  );
$$;

drop policy doctors_select on public.doctors;
create policy doctors_select on public.doctors for select to authenticated using (
  private.is_platform_admin() or private.is_organization_member(organization_id)
  or exists (
    select 1 from public.care_episodes ce
    join public.patients p on p.id = ce.patient_id and p.organization_id = ce.organization_id
    where ce.doctor_id = doctors.id and ce.organization_id = doctors.organization_id
      and p.auth_user_id = (select auth.uid()) and p.status = 'active'
  )
);

drop policy patients_select on public.patients;
create policy patients_select on public.patients for select to authenticated
using (private.can_access_patient(organization_id, id) or private.is_current_patient(id, organization_id));

drop policy care_episodes_select on public.care_episodes;
create policy care_episodes_select on public.care_episodes for select to authenticated
using (private.can_access_episode(organization_id, id) or private.is_current_patient(patient_id, organization_id));

drop policy conversations_select on public.conversations;
create policy conversations_select on public.conversations for select to authenticated using (
  private.is_platform_admin()
  or private.has_organization_role(organization_id, array['organization_admin', 'staff']::public.app_role[])
  or (care_episode_id is not null and private.can_access_episode(organization_id, care_episode_id))
  or private.is_current_patient(patient_id, organization_id)
);

drop policy messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and c.organization_id = messages.organization_id
  )
);

drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  (
    sender_type = 'patient'
    and sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = messages.organization_id
        and private.is_current_patient(c.patient_id, c.organization_id)
    )
  )
  or (
    sender_type in ('doctor', 'staff')
    and sender_user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = messages.organization_id
    )
  )
);

grant execute on function private.is_current_patient(uuid, uuid) to authenticated;

commit;
