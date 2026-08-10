do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.answer_active_automation_question(uuid,uuid,text)'::regprocedure::oid) into definition;
  definition := replace(definition, E'AS $function$\n', E'AS $function$\n#variable_conflict use_column\n');
  if definition not like '%#variable_conflict use_column%' then
    raise exception 'could not patch automation answer function';
  end if;
  execute definition;
end
$migration$;
