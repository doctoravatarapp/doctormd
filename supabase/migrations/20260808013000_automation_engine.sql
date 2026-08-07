begin;

alter table public.organizations add column timezone text not null default 'UTC';
update public.organizations set timezone='America/Sao_Paulo' where slug='apollomd-demo';

create type public.automation_flow_status as enum ('draft','active','inactive');
create type public.automation_anchor as enum ('episode_started_at','procedure_date');
create type public.automation_delay_unit as enum ('minutes','hours','days','weeks');
create type public.episode_automation_status as enum ('scheduled','active','paused','completed','cancelled');
create type public.scheduled_action_status as enum ('pending','processing','completed','failed','cancelled');

create table public.automation_flows (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 120), description text, status public.automation_flow_status not null default 'draft',
  version integer not null default 1 check(version>0), created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.automation_steps (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid not null, position integer not null check(position>0), name text not null check(length(trim(name)) between 2 and 120),
  anchor public.automation_anchor not null, delay_value integer not null check(delay_value>=0), delay_unit public.automation_delay_unit not null,
  message_content text not null check(length(trim(message_content)) between 1 and 2000), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(flow_id,organization_id) references public.automation_flows(id,organization_id) on delete cascade, unique(flow_id,position), unique(id,organization_id)
);
create table public.episode_automations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  care_episode_id uuid not null, flow_id uuid not null, flow_version integer not null, status public.episode_automation_status not null default 'active',
  started_at timestamptz not null default now(), paused_at timestamptz, completed_at timestamptz, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(care_episode_id,organization_id) references public.care_episodes(id,organization_id),
  foreign key(flow_id,organization_id) references public.automation_flows(id,organization_id), unique(id,organization_id)
);
create table public.scheduled_actions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  episode_automation_id uuid not null, automation_step_id uuid, step_position integer not null, step_name text not null,
  message_content text not null, scheduled_for timestamptz not null, status public.scheduled_action_status not null default 'pending',
  claimed_at timestamptz, executed_at timestamptz, message_id uuid, attempt_count integer not null default 0, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(episode_automation_id,organization_id) references public.episode_automations(id,organization_id) on delete cascade,
  foreign key(automation_step_id,organization_id) references public.automation_steps(id,organization_id) on delete set null,
  unique(episode_automation_id,step_position), unique(id,organization_id)
);
alter table public.messages add column scheduled_action_id uuid references public.scheduled_actions(id) on delete set null;
create unique index messages_scheduled_action_key on public.messages(scheduled_action_id) where scheduled_action_id is not null;
create index scheduled_actions_due_idx on public.scheduled_actions(status,scheduled_for);

create trigger automation_flows_updated before update on public.automation_flows for each row execute function private.set_updated_at();
create trigger automation_steps_updated before update on public.automation_steps for each row execute function private.set_updated_at();
create trigger episode_automations_updated before update on public.episode_automations for each row execute function private.set_updated_at();
create trigger scheduled_actions_updated before update on public.scheduled_actions for each row execute function private.set_updated_at();

alter table public.automation_flows enable row level security; alter table public.automation_flows force row level security;
alter table public.automation_steps enable row level security; alter table public.automation_steps force row level security;
alter table public.episode_automations enable row level security; alter table public.episode_automations force row level security;
alter table public.scheduled_actions enable row level security; alter table public.scheduled_actions force row level security;
create policy flows_select on public.automation_flows for select to authenticated using(private.is_organization_member(organization_id));
create policy flows_write on public.automation_flows for all to authenticated using(private.has_organization_role(organization_id,array['organization_admin']::public.app_role[])) with check(private.has_organization_role(organization_id,array['organization_admin']::public.app_role[]));
create policy steps_select on public.automation_steps for select to authenticated using(private.is_organization_member(organization_id));
create policy steps_write on public.automation_steps for all to authenticated using(private.has_organization_role(organization_id,array['organization_admin']::public.app_role[])) with check(private.has_organization_role(organization_id,array['organization_admin']::public.app_role[]));
create policy episode_automations_select on public.episode_automations for select to authenticated using(private.can_access_episode(organization_id,care_episode_id));
create policy scheduled_actions_select on public.scheduled_actions for select to authenticated using(exists(select 1 from public.episode_automations ea where ea.id=episode_automation_id and private.can_access_episode(ea.organization_id,ea.care_episode_id)));
grant select,insert,update,delete on public.automation_flows,public.automation_steps to authenticated;
grant select on public.episode_automations,public.scheduled_actions to authenticated;

create or replace function public.assign_automation(target_episode_id uuid,target_flow_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare ep public.care_episodes; flow public.automation_flows; org public.organizations; assignment_id uuid; anchor_time timestamptz;
begin
 select * into ep from public.care_episodes where id=target_episode_id; select * into flow from public.automation_flows where id=target_flow_id and organization_id=ep.organization_id and status='active'; select * into org from public.organizations where id=ep.organization_id;
 if ep.id is null or flow.id is null then raise exception 'episode or flow unavailable' using errcode='22023'; end if;
 if not(private.has_organization_role(ep.organization_id,array['organization_admin']::public.app_role[]) or (private.has_organization_role(ep.organization_id,array['doctor']::public.app_role[]) and ep.doctor_id=private.current_doctor_id(ep.organization_id))) then raise exception 'assignment forbidden' using errcode='42501'; end if;
 insert into public.episode_automations(organization_id,care_episode_id,flow_id,flow_version,status,created_by) values(ep.organization_id,ep.id,flow.id,flow.version,'active',(select auth.uid())) returning id into assignment_id;
 insert into public.scheduled_actions(organization_id,episode_automation_id,automation_step_id,step_position,step_name,message_content,scheduled_for)
 select ep.organization_id,assignment_id,s.id,s.position,s.name,s.message_content,
   (case s.anchor when 'episode_started_at' then coalesce(ep.started_at,now()) when 'procedure_date' then (ep.procedure_date::timestamp at time zone org.timezone) end)
   + case s.delay_unit when 'minutes' then make_interval(mins=>s.delay_value) when 'hours' then make_interval(hours=>s.delay_value) when 'days' then make_interval(days=>s.delay_value) else make_interval(days=>s.delay_value*7) end
 from public.automation_steps s where s.flow_id=flow.id and s.organization_id=ep.organization_id and s.is_active order by s.position;
 if not found then raise exception 'active steps required' using errcode='22023'; end if;
 insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata) values(ep.organization_id,(select auth.uid()),'automation.assigned','episode_automation',assignment_id,jsonb_build_object('flow_id',flow.id,'flow_version',flow.version)); return assignment_id;
end $$;

create or replace function public.set_episode_automation_status(target_assignment_id uuid,target_status public.episode_automation_status)
returns boolean language plpgsql security invoker set search_path='' as $$ declare ea public.episode_automations; action text;
begin select * into ea from public.episode_automations where id=target_assignment_id;if ea.id is null or not(private.has_organization_role(ea.organization_id,array['organization_admin']::public.app_role[]) or (private.has_organization_role(ea.organization_id,array['doctor']::public.app_role[]) and exists(select 1 from public.care_episodes ce where ce.id=ea.care_episode_id and ce.doctor_id=private.current_doctor_id(ea.organization_id)))) then raise exception 'automation control forbidden' using errcode='42501';end if;
 if target_status not in('active','paused','cancelled') then raise exception 'invalid transition' using errcode='22023';end if;
 update public.episode_automations set status=target_status,paused_at=case when target_status='paused' then now() else null end where id=ea.id and status in('active','paused','scheduled');if not found then raise exception 'invalid state' using errcode='55000';end if;
 if target_status='cancelled' then update public.scheduled_actions set status='cancelled' where episode_automation_id=ea.id and status in('pending','failed');end if;
 action=case target_status when 'paused' then 'automation.paused' when 'active' then 'automation.resumed' else 'automation.cancelled' end;insert into public.audit_logs(organization_id,actor_user_id,action,entity_type,entity_id,metadata)values(ea.organization_id,(select auth.uid()),action,'episode_automation',ea.id,'{}');return true;end $$;

create or replace function public.claim_due_automation_actions(batch_size integer default 20)
returns setof public.scheduled_actions language plpgsql security definer set search_path='' as $$
begin
 update public.scheduled_actions set status='failed',last_error='processing_timeout' where status='processing' and claimed_at<now()-interval '5 minutes' and attempt_count<3;
 return query with candidates as(select sa.id from public.scheduled_actions sa join public.episode_automations ea on ea.id=sa.episode_automation_id join public.care_episodes ce on ce.id=ea.care_episode_id join public.conversations c on c.care_episode_id=ce.id and c.organization_id=ce.organization_id and c.status='open'
 where sa.status in('pending','failed') and sa.attempt_count<3 and sa.scheduled_for<=now() and ea.status='active' and c.mode='ai'
 and not exists(select 1 from public.scheduled_actions prior where prior.episode_automation_id=sa.episode_automation_id and prior.step_position<sa.step_position and prior.status<>'completed')
 order by sa.scheduled_for for update of sa skip locked limit greatest(1,least(batch_size,100)))
 update public.scheduled_actions sa set status='processing',claimed_at=now(),attempt_count=attempt_count+1,last_error=null from candidates where sa.id=candidates.id returning sa.*;
end $$;

create or replace function public.complete_automation_action(target_action_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$ declare sa public.scheduled_actions;ea public.episode_automations;ce public.care_episodes;conv public.conversations;mid uuid;
begin select * into sa from public.scheduled_actions where id=target_action_id for update;if sa.status='completed' and sa.message_id is not null then return sa.message_id;end if;if sa.status<>'processing' then raise exception 'action not claimed';end if;select * into ea from public.episode_automations where id=sa.episode_automation_id and status='active';select * into ce from public.care_episodes where id=ea.care_episode_id;select * into conv from public.conversations where care_episode_id=ce.id and organization_id=ce.organization_id and status='open' order by created_at limit 1;if ea.id is null or conv.id is null or conv.mode<>'ai' then update public.scheduled_actions set status='pending',claimed_at=null where id=sa.id;return null;end if;
 insert into public.messages(organization_id,conversation_id,sender_type,content,metadata,scheduled_action_id) values(sa.organization_id,conv.id,'system',sa.message_content,jsonb_build_object('source','automation','step_name',sa.step_name),sa.id) on conflict(scheduled_action_id) where scheduled_action_id is not null do update set scheduled_action_id=excluded.scheduled_action_id returning id into mid;
 update public.scheduled_actions set status='completed',executed_at=now(),message_id=mid,claimed_at=null where id=sa.id;update public.conversations set last_message_at=now() where id=conv.id;
 if not exists(select 1 from public.scheduled_actions pending where pending.episode_automation_id=ea.id and pending.status<>'completed') then update public.episode_automations set status='completed',completed_at=now() where id=ea.id;end if;
 insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata)values(sa.organization_id,'automation.message_sent','scheduled_action',sa.id,jsonb_build_object('message_id',mid));return mid;end $$;

create or replace function public.fail_automation_action(target_action_id uuid,error_code text)
returns void language plpgsql security definer set search_path='' as $$ begin update public.scheduled_actions set status=case when attempt_count>=3 then 'failed'::public.scheduled_action_status else 'failed'::public.scheduled_action_status end,claimed_at=null,last_error=left(regexp_replace(error_code,'[^a-zA-Z0-9_.-]','','g'),120) where id=target_action_id and status='processing';insert into public.audit_logs(organization_id,action,entity_type,entity_id,metadata)select organization_id,'automation.failed','scheduled_action',id,jsonb_build_object('attempt_count',attempt_count,'error_code',left(error_code,40)) from public.scheduled_actions where id=target_action_id;end $$;

revoke all on function public.claim_due_automation_actions(integer),public.complete_automation_action(uuid),public.fail_automation_action(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_due_automation_actions(integer),public.complete_automation_action(uuid),public.fail_automation_action(uuid,text) to service_role;
grant execute on function public.assign_automation(uuid,uuid),public.set_episode_automation_status(uuid,public.episode_automation_status) to authenticated;
commit;
