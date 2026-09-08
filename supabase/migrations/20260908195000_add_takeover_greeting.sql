begin;

create or replace function public.take_over_conversation(target_conversation_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed public.conversations;
  actor_doctor uuid;
  greeting_message_id uuid;
begin
  if not private.can_operate_conversation(target_conversation_id) then
    raise exception 'takeover forbidden' using errcode = '42501';
  end if;

  select d.id
  into actor_doctor
  from public.doctors d
  where d.user_id = (select auth.uid())
    and d.status = 'active'
  limit 1;

  update public.conversations
  set mode = 'doctor',
      taken_over_by = (select auth.uid()),
      taken_over_doctor_id = actor_doctor,
      taken_over_at = now(),
      generation_started_at = null
  where id = target_conversation_id
    and mode = 'waiting_doctor'
  returning * into changed;

  if changed.id is null then
    raise exception 'conversation already handled or unavailable' using errcode = '40001';
  end if;

  insert into public.messages (
    organization_id,
    conversation_id,
    sender_type,
    sender_user_id,
    content,
    metadata
  )
  values (
    changed.organization_id,
    changed.id,
    'doctor',
    (select auth.uid()),
    'Olá, sou seu médico e estou assumindo a conversa a partir de agora',
    '{"source":"takeover_greeting","automatic":true}'::jsonb
  )
  returning id into greeting_message_id;

  update public.conversations
  set last_message_at = now()
  where id = changed.id;

  update public.red_flag_events
  set status = 'acknowledged',
      acknowledged_by = (select auth.uid()),
      acknowledged_at = now()
  where conversation_id = target_conversation_id
    and status = 'new';

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    changed.organization_id,
    (select auth.uid()),
    'conversation.takeover',
    'conversation',
    changed.id,
    jsonb_build_object('greeting_message_id', greeting_message_id)
  );

  return true;
end;
$$;

revoke all on function public.take_over_conversation(uuid) from public;
grant execute on function public.take_over_conversation(uuid) to authenticated;

commit;
