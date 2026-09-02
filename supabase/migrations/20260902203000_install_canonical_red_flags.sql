begin;

-- Remove only the synthetic red-flag fixtures identified in the production inventory.
delete from public.audit_logs
where entity_type = 'red_flag_event'
  and entity_id in (
    select e.id from public.red_flag_events e
    join public.red_flag_rules r on r.id = e.rule_id and r.organization_id = e.organization_id
    where r.name in ('TESTE_RED_FLAG_APOLLO', 'E2E Prompt 07 deterministic', 'E2E Prompt 08 Rule', 'E2E Prompt 09 Rule')
       or r.configuration->>'pattern' in ('TESTE_RED_FLAG_APOLLO', 'TESTE_DETERMINISTIC_P07', 'synthetic')
  );

delete from public.red_flag_events e
using public.red_flag_rules r
where e.rule_id = r.id
  and e.organization_id = r.organization_id
  and (
    r.name in ('TESTE_RED_FLAG_APOLLO', 'E2E Prompt 07 deterministic', 'E2E Prompt 08 Rule', 'E2E Prompt 09 Rule')
    or r.configuration->>'pattern' in ('TESTE_RED_FLAG_APOLLO', 'TESTE_DETERMINISTIC_P07', 'synthetic')
  );

delete from public.red_flag_rules
where name in ('TESTE_RED_FLAG_APOLLO', 'E2E Prompt 07 deterministic', 'E2E Prompt 08 Rule', 'E2E Prompt 09 Rule')
   or configuration->>'pattern' in ('TESTE_RED_FLAG_APOLLO', 'TESTE_DETERMINISTIC_P07', 'synthetic');

create unique index if not exists red_flag_rules_org_canonical_code_key
  on public.red_flag_rules (organization_id, (configuration->>'code'))
  where configuration->>'code' is not null;

create or replace function private.seed_default_red_flag_rules(target_organization_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with catalog(code, category, signal, priority, severity, recommended_action, matcher) as (
    values
      ('wound_active_bleeding', 'Ferida operatória', 'Sangramento ativo que não cessa com compressão local por 10 minutos', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente, mantendo compressão no local', '{"phrases":["sangramento não para","sangramento nao para","continua sangrando","sangramento que não cessa"],"groups":[["sangramento","sangrando"],["não parou","nao parou","não cessa","nao cessa","mesmo comprimindo","compressão","compressao"]]}'::jsonb),
      ('wound_dehiscence', 'Ferida operatória', 'Abertura dos pontos (deiscência)', 'contact_surgeon', 'high'::public.alert_severity, 'Não tentar fechar; cobrir com gaze limpa e acionar a equipe', '{"phrases":["pontos abriram","ponto abriu","abertura dos pontos","ferida abriu","deiscência","deiscencia"]}'::jsonb),
      ('wound_purulent_discharge', 'Ferida operatória', 'Secreção amarelada ou esverdeada com mau cheiro', 'contact_surgeon', 'high'::public.alert_severity, 'Enviar foto para a equipe e aguardar orientação', '{"phrases":["secreção amarelada","secrecao amarelada","secreção esverdeada","secrecao esverdeada","pus na ferida"],"groups":[["secreção","secrecao","líquido","liquido"],["mau cheiro","cheiro ruim","amarelada","esverdeada","pus"]]}'::jsonb),
      ('wound_spreading_redness', 'Ferida operatória', 'Vermelhidão crescente ao redor da ferida', 'contact_surgeon', 'high'::public.alert_severity, 'Enviar foto e relatar se há dor ou febre associada', '{"phrases":["vermelhidão aumentando","vermelhidao aumentando","vermelhidão crescente","vermelhidao crescente","vermelho ao redor da ferida"],"groups":[["vermelhidão","vermelhidao","vermelho"],["aumentando","crescendo","espalhando","ao redor da ferida"]]}'::jsonb),
      ('wound_painful_swelling', 'Ferida operatória', 'Inchaço importante e doloroso no local', 'contact_surgeon', 'high'::public.alert_severity, 'Avaliar necessidade de retorno ao consultório', '{"phrases":["inchaço importante","inchaco importante","muito inchado"],"groups":[["inchaço","inchaco","inchado"],["dor","doloroso","doendo muito"]]}'::jsonb),
      ('fever_after_48h', 'Febre', 'Febre de 38,5°C ou mais após as primeiras 48h da cirurgia', 'contact_surgeon', 'high'::public.alert_severity, 'Reportar temperatura, horário da medição e sintomas associados', '{"phrases":["38,5","38.5","trinta e oito e meio"],"groups":[["febre","temperatura"],["38 5","39°","39 graus","40°","40 graus"],["48 horas","dois dias","2 dias","terceiro dia","3 dias"]]}'::jsonb),
      ('fever_systemic_decline', 'Febre', 'Febre com calafrios, prostração ou piora do estado geral', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente', '{"groups":[["febre"],["calafrio","prostração","prostracao","muito abatido","piora geral","estado geral piorou"]]}'::jsonb),
      ('fever_low_first_48h', 'Febre', 'Febre baixa (até 38°C) nas primeiras 48h', 'home_guidance', 'low'::public.alert_severity, 'Observar, hidratar e repetir a medição em 4 a 6 horas', '{"phrases":["febre baixa","até 38","ate 38","38 graus"],"groups":[["febre","temperatura"],["37 5","37 6","37 7","37 8","37 9","38°"],["primeiras 48 horas","primeiro dia","1 dia","segundo dia","2 dias"]],"exclude":["calafrio","prostração","prostracao","38 5","39","40"]}'::jsonb),
      ('pain_uncontrolled', 'Dor', 'Dor intensa não aliviada pelo analgésico prescrito', 'contact_surgeon', 'high'::public.alert_severity, 'Não aumentar a dose por conta própria; acionar a equipe', '{"phrases":["analgésico não resolveu","analgesico nao resolveu","remédio não aliviou","remedio nao aliviou","dor não passa com remédio","dor nao passa com remedio"],"groups":[["dor forte","dor intensa","muita dor"],["não alivia","nao alivia","não passa","nao passa","analgésico","analgesico"]]}'::jsonb),
      ('pain_sudden_progressive', 'Dor', 'Dor súbita, intensa e crescente, fora do padrão esperado', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente', '{"phrases":["dor súbita e intensa","dor subita e intensa","dor muito forte de repente","dor fora do normal"],"groups":[["dor"],["súbita","subita","de repente"],["intensa","muito forte","aumentando","piorando"]]}'::jsonb),
      ('pain_controlled', 'Dor', 'Dor leve a moderada controlada com a medicação', 'home_guidance', 'low'::public.alert_severity, 'Manter medicação conforme prescrito e repouso', '{"phrases":["dor controlada","dor leve","dor moderada"],"groups":[["dor"],["controlada","melhorou com remédio","melhorou com remedio","suportável","suportavel"]],"exclude":["não alivia","nao alivia","não passa","nao passa","piorando","intensa","muito forte"]}'::jsonb),
      ('vomiting_cannot_retain_liquids', 'Náuseas e vômitos', 'Vômitos persistentes, não consegue reter líquidos', 'immediate_emergency', 'critical'::public.alert_severity, 'Suspender alimentação oral e levar ao pronto-socorro', '{"phrases":["não consegue reter líquidos","nao consegue reter liquidos","vomita tudo que bebe","não para de vomitar","nao para de vomitar"],"groups":[["vômito","vomito","vomitando"],["persistente","várias vezes","varias vezes","não segura líquido","nao segura liquido"]]}'::jsonb),
      ('vomiting_bilious', 'Náuseas e vômitos', 'Vômito esverdeado (bilioso)', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente', '{"phrases":["vômito verde","vomito verde","vômito esverdeado","vomito esverdeado","vômito bilioso","vomito bilioso"]}'::jsonb),
      ('nausea_mild_isolated', 'Náuseas e vômitos', 'Náusea leve isolada, sem vômitos repetidos', 'home_guidance', 'low'::public.alert_severity, 'Oferecer líquidos em pequenos volumes e observar', '{"phrases":["náusea leve","nausea leve","enjoo leve"],"groups":[["náusea","nausea","enjoo"],["leve","sem vomitar","não vomitei","nao vomitei"]],"exclude":["várias vezes","varias vezes","persistente","vômito verde","vomito verde"]}'::jsonb),
      ('urine_absent_8h', 'Hidratação e diurese', 'Não urina há mais de 8 a 10 horas', 'contact_surgeon', 'high'::public.alert_severity, 'Aumentar oferta de líquidos e acionar a equipe se persistir', '{"phrases":["não urina há 8 horas","nao urina ha 8 horas","não faço xixi há 8 horas","nao faco xixi ha 8 horas","sem urinar desde"],"groups":[["não urinou","nao urinou","não urina","nao urina","sem fazer xixi"],["8 horas","9 horas","10 horas","desde ontem"]]}'::jsonb),
      ('liquids_total_refusal_8h', 'Hidratação e diurese', 'Recusa total de líquidos por mais de 8 horas', 'contact_surgeon', 'high'::public.alert_severity, 'Oferecer pequenos volumes frequentes; acionar equipe se persistir', '{"phrases":["recusa todos os líquidos","não aceita nenhum líquido","nao aceita nenhum liquido","não bebe nada","nao bebe nada"],"groups":[["recusa","não aceita","nao aceita","não bebe","nao bebe"],["líquido","liquido","água","agua"],["8 horas","9 horas","10 horas","desde ontem"]]}'::jsonb),
      ('bowel_no_movement_3_5d', 'Eliminações', 'Não evacuou nos primeiros 3 a 5 dias', 'home_guidance', 'low'::public.alert_severity, 'Esperado em muitos pós-operatórios; manter hidratação e alimentação', '{"phrases":["não evacuou há 3 dias","nao evacuou ha 3 dias","sem evacuar há 3 dias","sem evacuar ha 3 dias","não fez cocô há 3 dias","nao fez coco ha 3 dias"],"groups":[["não evacuou","nao evacuou","sem evacuar","não fez cocô","nao fez coco"],["3 dias","4 dias","5 dias"]],"exclude":["dor e vômito","dor e vomito","barriga muito inchada","sangue"]}'::jsonb),
      ('abdomen_distension_pain_vomiting', 'Eliminações', 'Distensão abdominal importante com dor e vômitos', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente', '{"groups":[["barriga inchada","abdômen distendido","abdomen distendido","distensão abdominal","distensao abdominal"],["dor","dolorida"],["vômito","vomito","vomitando"]]}'::jsonb),
      ('stool_significant_blood', 'Eliminações', 'Sangue nas fezes em quantidade importante', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente', '{"phrases":["muito sangue nas fezes","grande quantidade de sangue nas fezes","fezes com muito sangue","sangramento nas fezes"],"groups":[["sangue nas fezes","fezes com sangue"],["muito","quantidade importante","bastante","grande quantidade"]]}'::jsonb),
      ('general_lethargy_hard_to_wake', 'Estado geral', 'Letargia, sonolência anormal ou dificuldade de acordar', 'immediate_emergency', 'critical'::public.alert_severity, 'Levar ao pronto-socorro imediatamente', '{"phrases":["difícil de acordar","dificil de acordar","não consegue acordar","nao consegue acordar","sonolência anormal","sonolencia anormal","muito letárgico","muito letargico"]}'::jsonb),
      ('general_inconsolable_irritability', 'Estado geral', 'Irritabilidade intensa e inconsolável', 'contact_surgeon', 'high'::public.alert_severity, 'Enviar relato à equipe e observar sinais associados', '{"phrases":["irritabilidade intensa","choro inconsolável","choro inconsolavel","não para de chorar","nao para de chorar","muito irritado e não acalma","muito irritado e nao acalma"]}'::jsonb),
      ('medication_allergic_reaction', 'Medicação', 'Sinais de reação alérgica: urticária, inchaço de lábios ou face, dificuldade para respirar', 'immediate_emergency', 'critical'::public.alert_severity, 'Suspender a medicação e levar ao pronto-socorro imediatamente', '{"phrases":["dificuldade para respirar","falta de ar depois do remédio","falta de ar depois do remedio","lábios inchados","labios inchados","rosto inchado","urticária","urticaria","reação alérgica","reacao alergica"],"groups":[["remédio","remedio","medicação","medicacao"],["coceira","placas vermelhas","inchaço","inchaco","falta de ar"]]}'::jsonb)
  )
  insert into public.red_flag_rules (organization_id, name, description, severity, status, configuration)
  select
    target_organization_id,
    signal,
    category,
    severity,
    'active'::public.red_flag_rule_status,
    jsonb_build_object(
      'schema_version', 2,
      'source', 'public/redflags.csv',
      'code', code,
      'category', category,
      'priority', priority,
      'recommended_action', recommended_action,
      'matcher', matcher
    )
  from catalog
  where not exists (
    select 1 from public.red_flag_rules existing
    where existing.organization_id = target_organization_id
      and existing.configuration->>'code' = catalog.code
  );
$$;

revoke all on function private.seed_default_red_flag_rules(uuid) from public;

select private.seed_default_red_flag_rules(id) from public.organizations;

create or replace function private.seed_red_flags_for_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_default_red_flag_rules(new.id);
  return new;
end;
$$;

revoke all on function private.seed_red_flags_for_new_organization() from public;

drop trigger if exists organizations_seed_red_flags on public.organizations;
create trigger organizations_seed_red_flags
after insert on public.organizations
for each row execute function private.seed_red_flags_for_new_organization();

commit;
