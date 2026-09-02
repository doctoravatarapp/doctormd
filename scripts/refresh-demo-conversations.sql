begin;

do $$
declare
  demo_organization_id uuid;
  demo_patient_id uuid;
  demo_doctor_id uuid;
begin
  select o.id into strict demo_organization_id
  from public.organizations o
  where o.slug = 'apollomd-demo';

  select p.id into strict demo_patient_id
  from public.patients p
  where p.organization_id = demo_organization_id
    and p.full_name = 'Paciente Teste APolloMD';

  select d.id into strict demo_doctor_id
  from public.doctors d
  where d.organization_id = demo_organization_id
    and d.display_name = 'Dr. Teste APolloMD';

  create temporary table demo_old_episodes on commit drop as
  select ce.id
  from public.care_episodes ce
  where ce.organization_id = demo_organization_id
    and ce.patient_id = demo_patient_id;

  create temporary table demo_old_conversations on commit drop as
  select c.id
  from public.conversations c
  where c.organization_id = demo_organization_id
    and c.patient_id = demo_patient_id;

  create temporary table demo_old_entities (id uuid primary key) on commit drop;
  insert into demo_old_entities (id)
  select id from demo_old_episodes
  union
  select id from demo_old_conversations
  union
  select m.id from public.messages m join demo_old_conversations c on c.id = m.conversation_id
  union
  select e.id from public.red_flag_events e join demo_old_conversations c on c.id = e.conversation_id
  union
  select r.id from public.red_flag_confirmations r join demo_old_conversations c on c.id = r.conversation_id
  union
  select s.id from public.semantic_review_events s join demo_old_conversations c on c.id = s.conversation_id
  union
  select ea.id from public.episode_automations ea join demo_old_episodes e on e.id = ea.care_episode_id
  union
  select sa.id
  from public.scheduled_actions sa
  join public.episode_automations ea on ea.id = sa.episode_automation_id
  join demo_old_episodes e on e.id = ea.care_episode_id;

  delete from public.audit_logs a
  where a.organization_id = demo_organization_id
    and a.entity_id in (select id from demo_old_entities);

  delete from public.episode_automations ea
  where ea.organization_id = demo_organization_id
    and ea.care_episode_id in (select id from demo_old_episodes);

  delete from public.conversations c
  where c.organization_id = demo_organization_id
    and c.id in (select id from demo_old_conversations);

  delete from public.care_episodes ce
  where ce.organization_id = demo_organization_id
    and ce.id in (select id from demo_old_episodes);

  create temporary table demo_scenarios (
    scenario text primary key,
    episode_id uuid not null,
    conversation_id uuid not null,
    procedure_name text not null,
    conversation_mode public.conversation_mode not null,
    base_time timestamptz not null
  ) on commit drop;

  insert into demo_scenarios values
    ('red_flag_emergency_confirmed', gen_random_uuid(), gen_random_uuid(), '[DEMO] Reação alérgica — emergência confirmada', 'waiting_doctor', now() - interval '5 hours'),
    ('red_flag_surgeon_confirmed', gen_random_uuid(), gen_random_uuid(), '[DEMO] Abertura dos pontos — equipe acionada', 'waiting_doctor', now() - interval '4 hours'),
    ('red_flag_rejected', gen_random_uuid(), gen_random_uuid(), '[DEMO] Suspeita de vermelhidão — não confirmada', 'ai', now() - interval '3 hours'),
    ('doctor_review', gen_random_uuid(), gen_random_uuid(), '[DEMO] Dúvida sobre anticoagulante — revisão médica', 'waiting_doctor', now() - interval '2 hours'),
    ('red_flag_home_guidance', gen_random_uuid(), gen_random_uuid(), '[DEMO] Náusea leve — orientação autônoma', 'ai', now() - interval '1 hour'),
    ('autonomous_routine', gen_random_uuid(), gen_random_uuid(), '[DEMO] Evolução habitual — acompanhamento autônomo', 'ai', now() - interval '20 minutes');

  insert into public.care_episodes (
    id, organization_id, patient_id, doctor_id, procedure_name, procedure_date,
    status, started_at, created_at, updated_at
  )
  select episode_id, demo_organization_id, demo_patient_id, demo_doctor_id,
    procedure_name, current_date - 2, 'postoperative', base_time - interval '2 days',
    base_time - interval '2 days', base_time
  from demo_scenarios;

  insert into public.conversations (
    id, organization_id, patient_id, care_episode_id, status, mode,
    last_message_at, created_at, updated_at
  )
  select conversation_id, demo_organization_id, demo_patient_id, episode_id,
    'open', conversation_mode, base_time + interval '4 minutes',
    base_time, base_time + interval '4 minutes'
  from demo_scenarios;

  create temporary table demo_messages (
    id uuid primary key,
    scenario text not null,
    step text not null,
    sender_type public.message_sender_type not null,
    content text not null,
    created_at timestamptz not null
  ) on commit drop;

  insert into demo_messages
  select gen_random_uuid(), s.scenario, v.step, v.sender_type::public.message_sender_type,
    v.content, s.base_time + make_interval(mins => v.minute_offset)
  from demo_scenarios s
  join lateral (
    values
      ('red_flag_emergency_confirmed', 'patient_report', 'patient', 'Depois da medicação comecei a ter urticária, meus lábios estão inchando e estou com dificuldade para respirar.', 0),
      ('red_flag_emergency_confirmed', 'confirmation_prompt', 'system', 'Identificamos no seu relato este possível sinal de alerta: “Sinais de reação alérgica: urticária, inchaço de lábios ou face, dificuldade para respirar”. Isso está acontecendo com você agora? Confirme com Sim ou Não.', 1),
      ('red_flag_emergency_confirmed', 'patient_confirmation', 'patient', 'Sim', 2),
      ('red_flag_emergency_confirmed', 'recommended_action', 'system', 'Suspender a medicação e levar ao pronto-socorro imediatamente', 3),

      ('red_flag_surgeon_confirmed', 'patient_report', 'patient', 'Percebi agora que os pontos abriram e uma parte da ferida ficou exposta.', 0),
      ('red_flag_surgeon_confirmed', 'confirmation_prompt', 'system', 'Identificamos no seu relato este possível sinal de alerta: “Abertura dos pontos (deiscência)”. Isso está acontecendo com você agora? Confirme com Sim ou Não.', 1),
      ('red_flag_surgeon_confirmed', 'patient_confirmation', 'patient', 'Sim', 2),
      ('red_flag_surgeon_confirmed', 'recommended_action', 'system', 'Não tentar fechar; cobrir com gaze limpa e acionar a equipe', 3),

      ('red_flag_rejected', 'patient_report', 'patient', 'Achei que a vermelhidão perto da ferida estava aumentando, mas não tenho certeza.', 0),
      ('red_flag_rejected', 'confirmation_prompt', 'system', 'Identificamos no seu relato este possível sinal de alerta: “Vermelhidão crescente ao redor da ferida”. Isso está acontecendo com você agora? Confirme com Sim ou Não.', 1),
      ('red_flag_rejected', 'patient_confirmation', 'patient', 'Não', 2),
      ('red_flag_rejected', 'rejection_response', 'system', 'Entendido. O sinal de alerta não foi confirmado e nenhuma ação específica foi aplicada. Se algo mudar ou piorar, conte para a equipe.', 3),

      ('doctor_review', 'patient_report', 'patient', 'Eu usava anticoagulante antes da cirurgia. Posso voltar a tomar hoje ou preciso esperar?', 0),
      ('doctor_review', 'handoff_response', 'system', 'Essa decisão depende da sua prescrição e do procedimento realizado. Encaminhei sua dúvida para a equipe médica; aguarde a orientação antes de retomar o anticoagulante.', 1),

      ('red_flag_home_guidance', 'patient_report', 'patient', 'Estou com uma náusea leve, isolada, e não tive vômitos repetidos.', 0),
      ('red_flag_home_guidance', 'confirmation_prompt', 'system', 'Identificamos no seu relato este possível sinal de alerta: “Náusea leve isolada, sem vômitos repetidos”. Isso está acontecendo com você agora? Confirme com Sim ou Não.', 1),
      ('red_flag_home_guidance', 'patient_confirmation', 'patient', 'Sim', 2),
      ('red_flag_home_guidance', 'recommended_action', 'system', 'Oferecer líquidos em pequenos volumes e observar', 3),

      ('autonomous_routine', 'patient_report', 'patient', 'Hoje consegui caminhar um pouco, tomei os remédios nos horários da receita e estou me sentindo bem.', 0),
      ('autonomous_routine', 'ai_response', 'ai', 'Que bom que você está seguindo as orientações e evoluindo bem. Continue com os cuidados prescritos e me avise se surgir alguma mudança ou dúvida.', 1)
  ) as v(scenario, step, sender_type, content, minute_offset)
    on v.scenario = s.scenario;

  insert into public.messages (
    id, organization_id, conversation_id, sender_type, content, metadata, created_at
  )
  select m.id, demo_organization_id, s.conversation_id, m.sender_type, m.content,
    jsonb_build_object('source', 'curated_demo_v1', 'scenario', m.scenario, 'step', m.step),
    m.created_at
  from demo_messages m
  join demo_scenarios s on s.scenario = m.scenario;

  insert into public.red_flag_confirmations (
    organization_id, rule_id, conversation_id, patient_id,
    source_message_id, prompt_message_id, response_message_id,
    status, detected_at, responded_at, created_at, updated_at
  )
  select demo_organization_id, r.id, s.conversation_id, demo_patient_id,
    source_message.id, prompt_message.id, response_message.id,
    case when x.confirmed then 'confirmed'::public.red_flag_confirmation_status else 'rejected'::public.red_flag_confirmation_status end,
    prompt_message.created_at, response_message.created_at, source_message.created_at, response_message.created_at
  from (values
    ('red_flag_emergency_confirmed', 'medication_allergic_reaction', true),
    ('red_flag_surgeon_confirmed', 'wound_dehiscence', true),
    ('red_flag_rejected', 'wound_spreading_redness', false),
    ('red_flag_home_guidance', 'nausea_mild_isolated', true)
  ) as x(scenario, rule_code, confirmed)
  join demo_scenarios s on s.scenario = x.scenario
  join public.red_flag_rules r on r.organization_id = demo_organization_id
    and r.configuration->>'code' = x.rule_code and r.status = 'active'
  join demo_messages source_message on source_message.scenario = x.scenario and source_message.step = 'patient_report'
  join demo_messages prompt_message on prompt_message.scenario = x.scenario and prompt_message.step = 'confirmation_prompt'
  join demo_messages response_message on response_message.scenario = x.scenario and response_message.step = 'patient_confirmation';

  insert into public.red_flag_events (
    organization_id, rule_id, conversation_id, message_id, patient_id,
    severity, status, metadata, resolved_at, created_at, updated_at
  )
  select demo_organization_id, r.id, s.conversation_id, source_message.id, demo_patient_id,
    r.severity,
    case when r.priority = 'home_guidance' then 'resolved'::public.red_flag_event_status else 'new'::public.red_flag_event_status end,
    jsonb_build_object(
      'source', 'curated_demo_v1', 'scenario', x.scenario,
      'detector', 'confirmed_structured_v3', 'confirmation_id', confirmation.id,
      'rule_code', x.rule_code, 'category', r.category, 'priority', r.priority,
      'auto_resolved', r.priority = 'home_guidance'
    ),
    case when r.priority = 'home_guidance' then action_message.created_at else null end,
    action_message.created_at, action_message.created_at
  from (values
    ('red_flag_emergency_confirmed', 'medication_allergic_reaction'),
    ('red_flag_surgeon_confirmed', 'wound_dehiscence'),
    ('red_flag_home_guidance', 'nausea_mild_isolated')
  ) as x(scenario, rule_code)
  join demo_scenarios s on s.scenario = x.scenario
  join public.red_flag_rules r on r.organization_id = demo_organization_id
    and r.configuration->>'code' = x.rule_code and r.status = 'active'
  join public.red_flag_confirmations confirmation on confirmation.conversation_id = s.conversation_id and confirmation.rule_id = r.id
  join demo_messages source_message on source_message.scenario = x.scenario and source_message.step = 'patient_report'
  join demo_messages action_message on action_message.scenario = x.scenario and action_message.step = 'recommended_action';

  insert into public.semantic_review_events (
    organization_id, conversation_id, message_id, patient_id, care_episode_id,
    category, confidence, classifier_version, model, status, latency_ms, usage,
    created_at, updated_at
  )
  select demo_organization_id, s.conversation_id, m.id, demo_patient_id, s.episode_id,
    'possible_concern', 0.990, 'demo-curated-v1', 'curated-fixture', 'new', 0,
    jsonb_build_object('source', 'curated_demo_v1', 'scenario', s.scenario),
    m.created_at, m.created_at
  from demo_scenarios s
  join demo_messages m on m.scenario = s.scenario and m.step = 'patient_report'
  where s.scenario = 'doctor_review';

  insert into public.audit_logs (organization_id, action, entity_type, entity_id, metadata, created_at)
  select demo_organization_id, 'demo.scenario_seeded', 'conversation', s.conversation_id,
    jsonb_build_object('source', 'curated_demo_v1', 'scenario', s.scenario), s.base_time
  from demo_scenarios s;
end
$$;

commit;
