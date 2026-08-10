begin;

create table public.doctor_ai_settings(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,doctor_id uuid not null,
 display_name text not null default 'APolloMD' check(length(trim(display_name)) between 2 and 60),communication_style text not null default 'balanced' check(communication_style in('concise','balanced','detailed')),
 custom_instructions text check(custom_instructions is null or length(custom_instructions)<=2000),is_active boolean not null default true,version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(doctor_id,organization_id) references public.doctors(id,organization_id) on delete cascade,unique(doctor_id),unique(id,organization_id)
);
create table public.semantic_review_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,conversation_id uuid not null,message_id uuid not null,patient_id uuid not null,care_episode_id uuid not null,
 category text not null check(category in('normal','possible_concern','administrative','unclear')),confidence numeric(4,3) not null check(confidence between 0 and 1),classifier_version text not null,model text not null,status text not null default 'new' check(status in('new','acknowledged','resolved','dismissed')),
 latency_ms integer,usage jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(conversation_id,organization_id) references public.conversations(id,organization_id) on delete cascade,
 foreign key(patient_id,organization_id) references public.patients(id,organization_id) on delete cascade,
 foreign key(care_episode_id,organization_id) references public.care_episodes(id,organization_id) on delete cascade,
 foreign key(message_id) references public.messages(id) on delete cascade,unique(message_id)
);
create trigger doctor_ai_settings_updated before update on public.doctor_ai_settings for each row execute function private.set_updated_at();
create trigger semantic_review_events_updated before update on public.semantic_review_events for each row execute function private.set_updated_at();
alter table public.doctor_ai_settings enable row level security;alter table public.doctor_ai_settings force row level security;
alter table public.semantic_review_events enable row level security;alter table public.semantic_review_events force row level security;
create policy doctor_ai_settings_select on public.doctor_ai_settings for select to authenticated using(private.is_organization_member(organization_id));
create policy doctor_ai_settings_write on public.doctor_ai_settings for all to authenticated using(private.has_organization_role(organization_id,array['organization_admin']::public.app_role[]) or (private.has_organization_role(organization_id,array['doctor']::public.app_role[]) and doctor_id=private.current_doctor_id(organization_id))) with check(private.has_organization_role(organization_id,array['organization_admin']::public.app_role[]) or (private.has_organization_role(organization_id,array['doctor']::public.app_role[]) and doctor_id=private.current_doctor_id(organization_id)));
create policy semantic_review_select on public.semantic_review_events for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and private.can_access_episode(c.organization_id,c.care_episode_id)));
grant select,insert,update on public.doctor_ai_settings to authenticated;grant select on public.semantic_review_events to authenticated;
commit;
