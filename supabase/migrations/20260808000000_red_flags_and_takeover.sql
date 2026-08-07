begin;

alter table public.conversations
  add column taken_over_by uuid references auth.users(id) on delete set null,
  add column taken_over_doctor_id uuid,
  add column taken_over_at timestamptz,
  add constraint conversations_takeover_doctor_fk foreign key (taken_over_doctor_id, organization_id) references public.doctors(id, organization_id);

alter table public.red_flag_events
  add column patient_id uuid,
  add column resolved_by uuid references auth.users(id) on delete set null,
  add column resolved_at timestamptz,
  add constraint red_flag_events_patient_fk foreign key (patient_id, organization_id) references public.patients(id, organization_id);

create unique index red_flag_events_rule_message_key on public.red_flag_events(rule_id, message_id) where rule_id is not null and message_id is not null;

create or replace function private.can_operate_conversation(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    join public.care_episodes ce on ce.id = c.care_episode_id and ce.organization_id = c.organization_id
    left join public.doctors d on d.id = ce.doctor_id and d.organization_id = ce.organization_id
    where c.id = target_conversation_id
      and (
        private.has_organization_role(c.organization_id, array['organization_admin']::public.app_role[])
        or (private.has_organization_role(c.organization_id, array['doctor']::public.app_role[]) and d.user_id = (select auth.uid()) and d.status = 'active')
      )
  );
$$;

create or replace function public.take_over_conversation(target_conversation_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed public.conversations; actor_doctor uuid;
begin
  if not private.can_operate_conversation(target_conversation_id) then raise exception 'takeover forbidden' using errcode='42501'; end if;
  select d.id into actor_doctor from public.doctors d where d.user_id=(select auth.uid()) and d.status='active' limit 1;
  update public.conversations set mode='doctor', taken_over_by=(select auth.uid()), taken_over_doctor_id=actor_doctor, taken_over_at=now(), generation_started_at=null
    where id=target_conversation_id and mode='waiting_doctor' returning * into changed;
  if changed.id is null then raise exception 'conversation already handled or unavailable' using errcode='40001'; end if;
  update public.red_flag_events set status='acknowledged', acknowledged_by=(select auth.uid()), acknowledged_at=now()
    where conversation_id=target_conversation_id and status='new';
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(changed.organization_id,(select auth.uid()),'conversation.takeover','conversation',changed.id,'{}');
  return true;
end; $$;

create or replace function public.send_doctor_message(target_conversation_id uuid, message_content text, target_client_message_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare target public.conversations; created_id uuid;
begin
  if length(trim(message_content))<1 or length(message_content)>2000 then raise exception 'invalid message' using errcode='22023'; end if;
  if not private.can_operate_conversation(target_conversation_id) then raise exception 'message forbidden' using errcode='42501'; end if;
  select * into target from public.conversations where id=target_conversation_id and mode='doctor' and status='open';
  if target.id is null then raise exception 'human mode required' using errcode='55000'; end if;
  insert into public.messages(organization_id,conversation_id,sender_type,sender_user_id,content,client_message_id,metadata)
    values(target.organization_id,target.id,'doctor',(select auth.uid()),trim(message_content),target_client_message_id,'{"source":"admin_console"}') returning id into created_id;
  update public.conversations set last_message_at=now() where id=target.id;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(target.organization_id,(select auth.uid()),'conversation.doctor_message','conversation',target.id,jsonb_build_object('message_id',created_id));
  return created_id;
end; $$;

create or replace function public.resume_ai_conversation(target_conversation_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed public.conversations;
begin
  if not private.can_operate_conversation(target_conversation_id) then raise exception 'resume forbidden' using errcode='42501'; end if;
  update public.conversations set mode='ai',taken_over_by=null,taken_over_doctor_id=null,taken_over_at=null
    where id=target_conversation_id and mode='doctor' returning * into changed;
  if changed.id is null then raise exception 'human mode required' using errcode='55000'; end if;
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(changed.organization_id,(select auth.uid()),'conversation.ai_resumed','conversation',changed.id,'{}');
  return true;
end; $$;

create or replace function public.resolve_red_flag(target_event_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare target public.red_flag_events;
begin
  select * into target from public.red_flag_events where id=target_event_id;
  if target.id is null or not private.can_operate_conversation(target.conversation_id) then raise exception 'resolve forbidden' using errcode='42501'; end if;
  update public.red_flag_events set status='resolved',resolved_by=(select auth.uid()),resolved_at=now() where id=target.id and status in ('new','acknowledged');
  insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
    values(target.organization_id,(select auth.uid()),'red_flag.resolved','red_flag_event',target.id,'{}');
  return true;
end; $$;

grant execute on function private.can_operate_conversation(uuid) to authenticated;
revoke all on function public.take_over_conversation(uuid), public.send_doctor_message(uuid,text,uuid), public.resume_ai_conversation(uuid), public.resolve_red_flag(uuid) from public;
grant execute on function public.take_over_conversation(uuid), public.send_doctor_message(uuid,text,uuid), public.resume_ai_conversation(uuid), public.resolve_red_flag(uuid) to authenticated;

commit;
