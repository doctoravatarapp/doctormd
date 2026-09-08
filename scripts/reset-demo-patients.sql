begin;

do $$
declare
  demo_org_id uuid;
  demo_doctor_id uuid;
begin
  select id into strict demo_org_id from public.organizations where slug = 'apollomd-demo';
  select id into demo_doctor_id
  from public.doctors
  where organization_id = demo_org_id
    and status = 'active'
    and display_name !~* '(e2e|teste|sintético)'
  order by created_at
  limit 1;
  if demo_doctor_id is null then raise exception 'No active non-test doctor found in apollomd-demo'; end if;

  create temporary table old_patients on commit drop as
    select id
    from public.patients
    where organization_id = demo_org_id
      and (
        email like '%@invalid.local'
        or email like '%@demo.apollomd.com.br'
        or full_name in ('E2E Patient B ApolloMD', 'Paciente Teste ApolloMD')
      );
  create temporary table old_episodes on commit drop as
    select id from public.care_episodes where organization_id = demo_org_id and patient_id in (select id from old_patients);
  create temporary table old_conversations on commit drop as
    select id from public.conversations where organization_id = demo_org_id and patient_id in (select id from old_patients);
  create temporary table old_entities (id uuid primary key) on commit drop;

  insert into old_entities
  select id from old_patients union select id from old_episodes union select id from old_conversations
  union select m.id from public.messages m join old_conversations c on c.id = m.conversation_id
  union select r.id from public.red_flag_confirmations r join old_conversations c on c.id = r.conversation_id
  union select r.id from public.red_flag_events r join old_conversations c on c.id = r.conversation_id
  union select s.id from public.semantic_review_events s join old_conversations c on c.id = s.conversation_id
  union select e.id from public.episode_automations e join old_episodes x on x.id = e.care_episode_id
  union select a.id from public.scheduled_actions a join public.episode_automations e on e.id = a.episode_automation_id join old_episodes x on x.id = e.care_episode_id
  union select a.id from public.automation_responses a join old_conversations c on c.id = a.conversation_id;

  delete from public.audit_logs where organization_id = demo_org_id and entity_id in (select id from old_entities);
  delete from public.automation_responses where organization_id = demo_org_id and (patient_id in (select id from old_patients) or conversation_id in (select id from old_conversations));
  delete from public.episode_automations where organization_id = demo_org_id and care_episode_id in (select id from old_episodes);
  delete from public.red_flag_events where organization_id = demo_org_id and patient_id in (select id from old_patients);
  delete from public.conversations where organization_id = demo_org_id and id in (select id from old_conversations);
  delete from public.care_episodes where organization_id = demo_org_id and id in (select id from old_episodes);
  delete from public.patients where organization_id = demo_org_id and id in (select id from old_patients);

  create temporary table demo_patients (
    id uuid primary key, full_name text not null, preferred_name text not null,
    email text not null, birth_date date not null, auth_user_id uuid
  ) on commit drop;
  insert into demo_patients
  select gen_random_uuid(), fixture.full_name, fixture.preferred_name, fixture.email, fixture.birth_date,
    (select u.id from auth.users u where lower(u.email) = lower(fixture.email) limit 1)
  from (values
    ('Carlos Silva', 'Carlos', 'carlos.silva@demo.apollomd.com.br', date '1982-04-12'),
    ('Ana Medeiros', 'Ana', 'ana.medeiros@demo.apollomd.com.br', date '1990-09-23'),
    ('Rita Souza', 'Rita', 'rita.souza@demo.apollomd.com.br', date '1975-01-30')
  ) fixture(full_name, preferred_name, email, birth_date);
  insert into public.patients (id, organization_id, full_name, preferred_name, email, birth_date, auth_user_id, status)
    select id, demo_org_id, full_name, preferred_name, email, birth_date, auth_user_id, 'active' from demo_patients;

  create temporary table scenarios (
    scenario text primary key, patient_name text not null, episode_id uuid not null,
    conversation_id uuid not null, procedure_name text not null,
    mode public.conversation_mode not null, base_time timestamptz not null
  ) on commit drop;
  insert into scenarios values
    ('routine', 'Carlos Silva', gen_random_uuid(), gen_random_uuid(), 'Acompanhamento pós-operatório', 'ai', now() - interval '20 minutes'),
    ('home_guidance', 'Ana Medeiros', gen_random_uuid(), gen_random_uuid(), 'Náusea leve — orientação autônoma', 'ai', now() - interval '1 hour'),
    ('doctor_review', 'Ana Medeiros', gen_random_uuid(), gen_random_uuid(), 'Dúvida medicamentosa — revisão médica', 'waiting_doctor', now() - interval '2 hours'),
    ('allergy', 'Rita Souza', gen_random_uuid(), gen_random_uuid(), 'Reação alérgica — emergência confirmada', 'waiting_doctor', now() - interval '3 hours'),
    ('wound', 'Rita Souza', gen_random_uuid(), gen_random_uuid(), 'Abertura dos pontos — equipe acionada', 'waiting_doctor', now() - interval '4 hours'),
    ('rejected', 'Rita Souza', gen_random_uuid(), gen_random_uuid(), 'Suspeita de vermelhidão — não confirmada', 'ai', now() - interval '5 hours');

  insert into public.care_episodes (id, organization_id, patient_id, doctor_id, procedure_name, procedure_date, status, started_at, created_at, updated_at)
  select s.episode_id, demo_org_id, p.id, demo_doctor_id, s.procedure_name, current_date - 2, 'postoperative', s.base_time - interval '2 days', s.base_time - interval '2 days', s.base_time
  from scenarios s join demo_patients p on p.full_name = s.patient_name;
  insert into public.conversations (id, organization_id, patient_id, care_episode_id, status, mode, last_message_at, created_at, updated_at)
  select s.conversation_id, demo_org_id, p.id, s.episode_id, 'open', s.mode, s.base_time + interval '4 minutes', s.base_time, s.base_time + interval '4 minutes'
  from scenarios s join demo_patients p on p.full_name = s.patient_name;

  create temporary table demo_messages (id uuid primary key, scenario text, step text, sender_type public.message_sender_type, content text, created_at timestamptz) on commit drop;
  insert into demo_messages
  select gen_random_uuid(), s.scenario, m.step, m.sender::public.message_sender_type, m.content, s.base_time + make_interval(mins => m.minute)
  from scenarios s join lateral (values
    ('routine','report','patient','Hoje caminhei um pouco, segui os horários da receita e estou me sentindo bem.',0),
    ('routine','answer','ai','Que bom que você está evoluindo bem. Continue seguindo as orientações prescritas e avise se houver alguma mudança.',1),
    ('home_guidance','report','patient','Estou com uma náusea leve, isolada, e não tive vômitos repetidos.',0),
    ('home_guidance','prompt','system','Identificamos no seu relato este possível sinal de alerta: “Náusea leve isolada, sem vômitos repetidos”. Isso está acontecendo com você agora? Confirme com Sim ou Não.',1),
    ('home_guidance','confirmation','patient','Sim',2),
    ('home_guidance','action','system','Oferecer líquidos em pequenos volumes e observar',3),
    ('doctor_review','report','patient','Eu usava anticoagulante antes da cirurgia. Posso voltar a tomar hoje?',0),
    ('doctor_review','answer','system','Essa decisão depende da sua prescrição e do procedimento. Encaminhei a dúvida para a equipe médica; aguarde antes de retomar.',1),
    ('allergy','report','patient','Depois da medicação tive urticária, meus lábios incharam e estou com dificuldade para respirar.',0),
    ('allergy','prompt','system','Identificamos no seu relato este possível sinal de alerta: “Sinais de reação alérgica: urticária, inchaço de lábios ou face, dificuldade para respirar”. Isso está acontecendo com você agora? Confirme com Sim ou Não.',1),
    ('allergy','confirmation','patient','Sim',2),
    ('allergy','action','system','Suspender a medicação e levar ao pronto-socorro imediatamente',3),
    ('wound','report','patient','Os pontos abriram e uma parte da ferida ficou exposta.',0),
    ('wound','prompt','system','Identificamos no seu relato este possível sinal de alerta: “Abertura dos pontos (deiscência)”. Isso está acontecendo com você agora? Confirme com Sim ou Não.',1),
    ('wound','confirmation','patient','Sim',2),
    ('wound','action','system','Não tentar fechar; cobrir com gaze limpa e acionar a equipe',3),
    ('rejected','report','patient','Achei que a vermelhidão perto da ferida estava aumentando, mas não tenho certeza.',0),
    ('rejected','prompt','system','Identificamos no seu relato este possível sinal de alerta: “Vermelhidão crescente ao redor da ferida”. Isso está acontecendo com você agora? Confirme com Sim ou Não.',1),
    ('rejected','confirmation','patient','Não',2),
    ('rejected','answer','system','Entendido. O sinal de alerta não foi confirmado e nenhuma ação específica foi aplicada. Se algo mudar ou piorar, conte para a equipe.',3)
  ) m(scenario,step,sender,content,minute) on m.scenario = s.scenario;
  insert into public.messages (id, organization_id, conversation_id, sender_type, content, metadata, created_at)
  select m.id, demo_org_id, s.conversation_id, m.sender_type, m.content, jsonb_build_object('source','curated_demo_v2','scenario',m.scenario,'step',m.step), m.created_at
  from demo_messages m join scenarios s on s.scenario = m.scenario;

  insert into public.red_flag_confirmations (organization_id, rule_id, conversation_id, patient_id, source_message_id, prompt_message_id, response_message_id, status, detected_at, responded_at, created_at, updated_at)
  select demo_org_id, r.id, s.conversation_id, p.id, source.id, prompt.id, response.id,
    case when x.confirmed then 'confirmed'::public.red_flag_confirmation_status else 'rejected'::public.red_flag_confirmation_status end,
    prompt.created_at, response.created_at, source.created_at, response.created_at
  from (values ('home_guidance','nausea_mild_isolated',true),('allergy','medication_allergic_reaction',true),('wound','wound_dehiscence',true),('rejected','wound_spreading_redness',false)) x(scenario,code,confirmed)
  join scenarios s on s.scenario=x.scenario join demo_patients p on p.full_name=s.patient_name
  join public.red_flag_rules r on r.organization_id=demo_org_id and r.configuration->>'code'=x.code and r.status='active'
  join demo_messages source on source.scenario=x.scenario and source.step='report'
  join demo_messages prompt on prompt.scenario=x.scenario and prompt.step='prompt'
  join demo_messages response on response.scenario=x.scenario and response.step='confirmation';

  insert into public.red_flag_events (organization_id, rule_id, conversation_id, message_id, patient_id, severity, status, metadata, resolved_at, created_at, updated_at)
  select demo_org_id,r.id,s.conversation_id,source.id,p.id,r.severity,
    case when r.priority='home_guidance' then 'resolved'::public.red_flag_event_status else 'new'::public.red_flag_event_status end,
    jsonb_build_object('source','curated_demo_v2','scenario',x.scenario,'detector','confirmed_structured_v3','confirmation_id',c.id,'rule_code',x.code,'category',r.category,'priority',r.priority,'auto_resolved',r.priority='home_guidance'),
    case when r.priority='home_guidance' then action.created_at else null end,action.created_at,action.created_at
  from (values ('home_guidance','nausea_mild_isolated'),('allergy','medication_allergic_reaction'),('wound','wound_dehiscence')) x(scenario,code)
  join scenarios s on s.scenario=x.scenario join demo_patients p on p.full_name=s.patient_name
  join public.red_flag_rules r on r.organization_id=demo_org_id and r.configuration->>'code'=x.code and r.status='active'
  join public.red_flag_confirmations c on c.conversation_id=s.conversation_id and c.rule_id=r.id
  join demo_messages source on source.scenario=x.scenario and source.step='report'
  join demo_messages action on action.scenario=x.scenario and action.step='action';

  insert into public.semantic_review_events (organization_id,conversation_id,message_id,patient_id,care_episode_id,category,confidence,classifier_version,model,status,latency_ms,usage,created_at,updated_at)
  select demo_org_id,s.conversation_id,m.id,p.id,s.episode_id,'possible_concern',0.990,'demo-curated-v2','curated-fixture','new',0,jsonb_build_object('source','curated_demo_v2'),m.created_at,m.created_at
  from scenarios s join demo_patients p on p.full_name=s.patient_name join demo_messages m on m.scenario=s.scenario and m.step='report' where s.scenario='doctor_review';
end
$$;

commit;
