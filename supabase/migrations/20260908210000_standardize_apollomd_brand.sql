begin;

alter table public.doctor_ai_settings
  alter column display_name set default 'ApolloMD';

update public.doctor_ai_settings
set display_name = 'ApolloMD'
where display_name = 'APolloMD';

update public.organizations
set name = 'ApolloMD Demo'
where name = 'APolloMD Demo';

comment on table public.sales_leads is
  'Commercial leads submitted through the public ApolloMD landing page; no clinical data.';

commit;
