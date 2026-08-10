alter type public.automation_anchor add value if not exists 'previous_step_completed_at';
alter type public.episode_automation_status add value if not exists 'waiting_response';

begin;

alter table public.automation_steps
  add column step_type text not null default 'message' check(step_type in('message','question','condition')),
  add column response_type text check(response_type in('text','single_choice','number','boolean')),
  add column response_options text[], add column response_required boolean not null default true,
  add column response_min numeric, add column response_max numeric, add column response_unit text,
  add column response_timeout_value integer check(response_timeout_value is null or response_timeout_value>0),
  add column response_timeout_unit public.automation_delay_unit,
  add column timeout_strategy text not null default 'stop' check(timeout_strategy in('continue','stop')),
  add column condition_question_step_id uuid references public.automation_steps(id) on delete restrict,
  add column condition_operator text check(condition_operator in('equals','not_equals','greater_than','greater_than_or_equal','less_than','less_than_or_equal')),
  add column condition_value text,
  add column if_true_step_id uuid references public.automation_steps(id) on delete restrict,
  add column if_false_step_id uuid references public.automation_steps(id) on delete restrict;

alter table public.episode_automations add column current_step_id uuid references public.automation_steps(id) on delete set null;

alter table public.scheduled_actions
  add column step_type text not null default 'message' check(step_type in('message','question','condition')),
  add column anchor public.automation_anchor not null default 'episode_started_at',
  add column delay_value integer not null default 0,
  add column delay_unit public.automation_delay_unit not null default 'minutes',
  add column response_type text, add column response_options text[], add column response_required boolean not null default true,
  add column response_min numeric, add column response_max numeric, add column response_unit text,
  add column response_timeout_value integer, add column response_timeout_unit public.automation_delay_unit,
  add column timeout_strategy text not null default 'stop', add column condition_question_step_id uuid,
  add column condition_operator text, add column condition_value text,
  add column if_true_step_id uuid, add column if_false_step_id uuid,
  add column response_due_at timestamptz;

create table public.automation_responses(
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  episode_automation_id uuid not null, automation_step_id uuid not null, patient_id uuid not null, conversation_id uuid not null,
  message_id uuid not null references public.messages(id) on delete restrict, response_type text not null check(response_type in('text','single_choice','number','boolean')),
  text_value text, number_value numeric, boolean_value boolean, selected_option text, skipped boolean not null default false,
  answered_at timestamptz not null default now(), created_at timestamptz not null default now(),
  foreign key(episode_automation_id,organization_id) references public.episode_automations(id,organization_id) on delete cascade,
  foreign key(automation_step_id,organization_id) references public.automation_steps(id,organization_id) on delete restrict,
  foreign key(patient_id,organization_id) references public.patients(id,organization_id) on delete restrict,
  foreign key(conversation_id,organization_id) references public.conversations(id,organization_id) on delete restrict,
  unique(episode_automation_id,automation_step_id), unique(message_id)
);
create index automation_responses_episode_idx on public.automation_responses(episode_automation_id,answered_at);
alter table public.automation_responses enable row level security; alter table public.automation_responses force row level security;
create policy automation_responses_select on public.automation_responses for select to authenticated using(
  exists(select 1 from public.episode_automations ea where ea.id=episode_automation_id and private.can_access_episode(ea.organization_id,ea.care_episode_id))
);
grant select on public.automation_responses to authenticated;

create or replace function private.validate_automation_flow(target_flow_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare bad boolean;
begin
  select exists(select 1 from public.automation_steps s where s.flow_id=target_flow_id and s.is_active and (
    (s.step_type='question' and (s.response_type is null or (s.response_type='single_choice' and coalesce(array_length(s.response_options,1),0)<2) or (s.response_min is not null and s.response_max is not null and s.response_min>s.response_max))) or
    (s.step_type='condition' and (s.condition_question_step_id is null or s.condition_operator is null or s.if_true_step_id is null or s.if_false_step_id is null or
      not exists(select 1 from public.automation_steps q where q.id=s.condition_question_step_id and q.flow_id=s.flow_id and q.step_type='question' and q.position<s.position) or
      not exists(select 1 from public.automation_steps t where t.id=s.if_true_step_id and t.flow_id=s.flow_id and t.position>s.position) or
      not exists(select 1 from public.automation_steps f where f.id=s.if_false_step_id and f.flow_id=s.flow_id and f.position>s.position)))
  )) into bad;
  if bad or not exists(select 1 from public.automation_steps where flow_id=target_flow_id and is_active) then raise exception 'invalid automation graph' using errcode='22023'; end if;
  return true;
end $$;

create or replace function private.validate_active_flow_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.status='active' then perform private.validate_automation_flow(new.id); end if; return new; end $$;
create trigger validate_active_automation_flow before insert or update of status on public.automation_flows for each row execute function private.validate_active_flow_trigger();

create or replace function public.assign_automation(target_episode_id uuid,target_flow_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare ep public.care_episodes; flow public.automation_flows; org public.organizations; assignment_id uuid; anchor_time timestamptz;
begin
 select * into ep from public.care_episodes where id=target_episode_id; select * into flow from public.automation_flows where id=target_flow_id and organization_id=ep.organization_id and status='active'; select * into org from public.organizations where id=ep.organization_id;
 if ep.id is null or flow.id is null then raise exception 'episode or flow unavailable' using errcode='22023'; end if; perform private.validate_automation_flow(flow.id);
 if not(private.has_organization_role(ep.organization_id,array['organization_admin']::public.app_role[]) or (private.has_organization_role(ep.organization_id,array['doctor']::public.app_role[]) and ep.doctor_id=private.current_doctor_id(ep.organization_id))) then raise exception 'assignment forbidden' using errcode='42501'; end if;
 insert into public.episode_automations(organization_id,care_episode_id,flow_id,flow_version,status,created_by) values(ep.organization_id,ep.id,flow.id,flow.version,'active',(select auth.uid())) returning id into assignment_id;
 insert into public.scheduled_actions(organization_id,episode_automation_id,automation_step_id,step_position,step_name,message_content,scheduled_for,step_type,anchor,delay_value,delay_unit,response_type,response_options,response_required,response_min,response_max,response_unit,response_timeout_value,response_timeout_unit,timeout_strategy,condition_question_step_id,condition_operator,condition_value,if_true_step_id,if_false_step_id)
 select ep.organization_id,assignment_id,s.id,s.position,s.name,s.message_content,
   (case s.anchor when 'episode_started_at' then coalesce(ep.started_at,now()) when 'procedure_date' then (ep.procedure_date::timestamp at time zone org.timezone) else now() end)
   + case s.delay_unit when 'minutes' then make_interval(mins=>s.delay_value) when 'hours' then make_interval(hours=>s.delay_value) when 'days' then make_interval(days=>s.delay_value) else make_interval(days=>s.delay_value*7) end,
   s.step_type,s.anchor,s.delay_value,s.delay_unit,s.response_type,s.response_options,s.response_required,s.response_min,s.response_max,s.response_unit,s.response_timeout_value,s.response_timeout_unit,s.timeout_strategy,s.condition_question_step_id,s.condition_operator,s.condition_value,s.if_true_step_id,s.if_false_step_id
 from public.automation_steps s where s.flow_id=flow.id and s.organization_id=ep.organization_id and s.is_active order by s.position;
 if not found then raise exception 'active steps required' using errcode='22023'; end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata) values(ep.organization_id,(select auth.uid()),'automation.assigned','episode_automation',assignment_id,jsonb_build_object('flow_id',flow.id,'flow_version',flow.version)); return assignment_id;
end $$;

create or replace function public.claim_due_automation_actions(batch_size integer default 20)
returns setof public.scheduled_actions language plpgsql security definer set search_path='' as $$
begin
 update public.scheduled_actions set status='failed',last_error='processing_timeout' where status='processing' and claimed_at<now()-interval '5 minutes' and attempt_count<3;
 -- Resolve simple question timeouts before claiming the next work item.
 with expired as(select ea.id,ea.organization_id,sa.step_position,sa.timeout_strategy from public.episode_automations ea join public.scheduled_actions sa on sa.automation_step_id=ea.current_step_id and sa.episode_automation_id=ea.id where ea.status='waiting_response' and sa.response_due_at<=now() for update of ea)
 update public.scheduled_actions x set status='cancelled' from expired e where x.episode_automation_id=e.id and x.step_position>e.step_position and e.timeout_strategy='stop' and x.status in('pending','failed');
 with expired as(select ea.id,ea.organization_id,sa.step_position,sa.timeout_strategy from public.episode_automations ea join public.scheduled_actions sa on sa.automation_step_id=ea.current_step_id and sa.episode_automation_id=ea.id where ea.status='waiting_response' and sa.response_due_at<=now() for update of ea)
 update public.episode_automations ea set status=case when e.timeout_strategy='continue' then 'active'::public.episode_automation_status else 'completed'::public.episode_automation_status end,current_step_id=null,completed_at=case when e.timeout_strategy='stop' then now() else null end from expired e where ea.id=e.id;
 return query with candidates as(select sa.id from public.scheduled_actions sa join public.episode_automations ea on ea.id=sa.episode_automation_id join public.care_episodes ce on ce.id=ea.care_episode_id join public.conversations c on c.care_episode_id=ce.id and c.organization_id=ce.organization_id and c.status='open'
 where sa.status in('pending','failed') and sa.attempt_count<3 and sa.scheduled_for<=now() and ea.status='active' and c.mode='ai'
 and not exists(select 1 from public.scheduled_actions prior where prior.episode_automation_id=sa.episode_automation_id and prior.step_position<sa.step_position and prior.status not in('completed','cancelled'))
 order by sa.scheduled_for for update of sa skip locked limit greatest(1,least(batch_size,100)))
 update public.scheduled_actions sa set status='processing',claimed_at=now(),attempt_count=attempt_count+1,last_error=null from candidates where sa.id=candidates.id returning sa.*;
end $$;

create or replace function public.complete_automation_action(target_action_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare sa public.scheduled_actions;ea public.episode_automations;ce public.care_episodes;conv public.conversations;mid uuid; response public.automation_responses; target uuid; target_pos integer;
begin
 select * into sa from public.scheduled_actions where id=target_action_id for update; if sa.status='completed' then return coalesce(sa.message_id,sa.id); end if; if sa.status<>'processing' then raise exception 'action not claimed'; end if;
 select * into ea from public.episode_automations where id=sa.episode_automation_id and status='active'; select * into ce from public.care_episodes where id=ea.care_episode_id; select * into conv from public.conversations where care_episode_id=ce.id and organization_id=ce.organization_id and status='open' order by created_at limit 1;
 if ea.id is null or conv.id is null or conv.mode<>'ai' then update public.scheduled_actions set status='pending',claimed_at=null where id=sa.id; return null; end if;
 if sa.step_type='condition' then
   select * into response from public.automation_responses where episode_automation_id=ea.id and automation_step_id=sa.condition_question_step_id;
   if response.id is null then raise exception 'condition response missing'; end if;
   if (case sa.condition_operator
     when 'equals' then coalesce(response.selected_option,response.text_value,response.number_value::text,response.boolean_value::text)=sa.condition_value
     when 'not_equals' then coalesce(response.selected_option,response.text_value,response.number_value::text,response.boolean_value::text)<>sa.condition_value
     when 'greater_than' then response.number_value>sa.condition_value::numeric when 'greater_than_or_equal' then response.number_value>=sa.condition_value::numeric
     when 'less_than' then response.number_value<sa.condition_value::numeric when 'less_than_or_equal' then response.number_value<=sa.condition_value::numeric else false end) then target=sa.if_true_step_id; else target=sa.if_false_step_id; end if;
   select step_position into target_pos from public.scheduled_actions where episode_automation_id=ea.id and automation_step_id=target;
   update public.scheduled_actions set status='completed',executed_at=now(),claimed_at=null where id=sa.id;
   update public.scheduled_actions set status='cancelled' where episode_automation_id=ea.id and step_position>sa.step_position and automation_step_id<>target and status in('pending','failed');
   update public.scheduled_actions set scheduled_for=now() + case delay_unit when 'minutes' then make_interval(mins=>delay_value) when 'hours' then make_interval(hours=>delay_value) when 'days' then make_interval(days=>delay_value) else make_interval(days=>delay_value*7) end where episode_automation_id=ea.id and automation_step_id=target and anchor='previous_step_completed_at';
   insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata) values(sa.organization_id,'automation.condition_evaluated','scheduled_action',sa.id,jsonb_build_object('result_step_id',target)),(sa.organization_id,'automation.branch_selected','scheduled_action',sa.id,jsonb_build_object('selected_step_id',target)); return sa.id;
 end if;
 insert into public.messages(organization_id,conversation_id,sender_type,content,metadata,scheduled_action_id) values(sa.organization_id,conv.id,'system',sa.message_content,jsonb_build_object('source','automation','step_name',sa.step_name,'step_type',sa.step_type),sa.id) on conflict(scheduled_action_id) where scheduled_action_id is not null do update set scheduled_action_id=excluded.scheduled_action_id returning id into mid;
 update public.scheduled_actions set status='completed',executed_at=now(),message_id=mid,claimed_at=null,response_due_at=case when sa.step_type='question' and sa.response_timeout_value is not null then now()+case sa.response_timeout_unit when 'minutes' then make_interval(mins=>sa.response_timeout_value) when 'hours' then make_interval(hours=>sa.response_timeout_value) when 'days' then make_interval(days=>sa.response_timeout_value) else make_interval(days=>sa.response_timeout_value*7) end else null end where id=sa.id;
 update public.conversations set last_message_at=now() where id=conv.id;
 if sa.step_type='question' then update public.episode_automations set status='waiting_response',current_step_id=sa.automation_step_id where id=ea.id; insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata) values(sa.organization_id,'automation.question_sent','scheduled_action',sa.id,jsonb_build_object('step_id',sa.automation_step_id));
 elsif not exists(select 1 from public.scheduled_actions p where p.episode_automation_id=ea.id and p.status not in('completed','cancelled')) then update public.episode_automations set status='completed',completed_at=now() where id=ea.id; end if;
 if sa.step_type='message' then insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata) values(sa.organization_id,'automation.message_sent','scheduled_action',sa.id,jsonb_build_object('message_id',mid)); end if; return mid;
end $$;

create or replace function public.answer_active_automation_question(target_conversation_id uuid,target_message_id uuid,raw_answer text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare conv public.conversations;ea public.episode_automations;sa public.scheduled_actions;msg public.messages;answer text:=btrim(raw_answer);num numeric;bool_value boolean;skip boolean:=false;next_action public.scheduled_actions;
begin
 select * into conv from public.conversations where id=target_conversation_id; select * into msg from public.messages where id=target_message_id and conversation_id=conv.id and sender_type='patient';
 if conv.id is null or msg.id is null then raise exception 'invalid conversation or message' using errcode='42501'; end if;
 if conv.mode<>'ai' then return jsonb_build_object('handled',false,'reason','human_mode'); end if;
 select ea.* into ea from public.episode_automations ea join public.care_episodes ce on ce.id=ea.care_episode_id where ce.id=conv.care_episode_id and ce.patient_id=conv.patient_id and ea.status='waiting_response' order by ea.created_at limit 1 for update of ea;
 if ea.id is null then return jsonb_build_object('handled',false); end if;
 select * into sa from public.scheduled_actions where episode_automation_id=ea.id and automation_step_id=ea.current_step_id and step_type='question' for update;
 if sa.id is null then return jsonb_build_object('handled',false); end if;
 if lower(answer)='prefiro não responder' and not sa.response_required then skip=true;
 elsif sa.response_type='text' then if answer='' then return jsonb_build_object('handled',true,'valid',false,'feedback','Digite uma resposta.'); end if;
 elsif sa.response_type='single_choice' then if not(answer=any(sa.response_options)) then return jsonb_build_object('handled',true,'valid',false,'feedback','Escolha uma das opções apresentadas.'); end if;
 elsif sa.response_type='number' then begin num=replace(answer,',','.')::numeric; exception when others then return jsonb_build_object('handled',true,'valid',false,'feedback','Informe um número válido.'); end; if (sa.response_min is not null and num<sa.response_min) or (sa.response_max is not null and num>sa.response_max) then return jsonb_build_object('handled',true,'valid',false,'feedback',format('Informe um valor entre %s e %s.',coalesce(sa.response_min::text,'-∞'),coalesce(sa.response_max::text,'∞'))); end if;
 elsif sa.response_type='boolean' then if lower(answer) in('sim','true','1') then bool_value=true; elsif lower(answer) in('não','nao','false','0') then bool_value=false; else return jsonb_build_object('handled',true,'valid',false,'feedback','Responda Sim ou Não.'); end if; end if;
 insert into public.automation_responses(organization_id,episode_automation_id,automation_step_id,patient_id,conversation_id,message_id,response_type,text_value,number_value,boolean_value,selected_option,skipped)
 values(ea.organization_id,ea.id,sa.automation_step_id,conv.patient_id,conv.id,msg.id,sa.response_type,case when sa.response_type='text' and not skip then answer end,case when sa.response_type='number' and not skip then num end,case when sa.response_type='boolean' and not skip then bool_value end,case when sa.response_type='single_choice' and not skip then answer end,skip)
 on conflict(episode_automation_id,automation_step_id) do nothing;
 if not found then return jsonb_build_object('handled',true,'valid',true,'duplicate',true); end if;
 select * into next_action from public.scheduled_actions where episode_automation_id=ea.id and step_position>sa.step_position and status in('pending','failed') order by step_position limit 1;
 if next_action.id is null then update public.episode_automations set status='completed',current_step_id=null,completed_at=now() where id=ea.id;
 else update public.episode_automations set status='active',current_step_id=null where id=ea.id; if next_action.anchor='previous_step_completed_at' then update public.scheduled_actions set scheduled_for=now()+case next_action.delay_unit when 'minutes' then make_interval(mins=>next_action.delay_value) when 'hours' then make_interval(hours=>next_action.delay_value) when 'days' then make_interval(days=>next_action.delay_value) else make_interval(days=>next_action.delay_value*7) end where id=next_action.id; end if; end if;
 insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata) values(ea.organization_id,'automation.response_received','automation_response',target_message_id,jsonb_build_object('step_id',sa.automation_step_id,'response_type',sa.response_type,'skipped',skip));
 return jsonb_build_object('handled',true,'valid',true);
end $$;

revoke all on function public.answer_active_automation_question(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.answer_active_automation_question(uuid,uuid,text) to service_role;

commit;
