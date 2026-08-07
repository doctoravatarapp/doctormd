begin;

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
    and private.has_organization_role(
      organization_id,
      case sender_type
        when 'doctor' then array['organization_admin', 'doctor']::public.app_role[]
        else array['organization_admin', 'staff']::public.app_role[]
      end
    )
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.organization_id = messages.organization_id
    )
  )
);

commit;
