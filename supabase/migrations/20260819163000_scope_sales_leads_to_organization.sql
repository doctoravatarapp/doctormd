do $$
begin
  if not exists (select 1 from public.organizations where slug = 'apollomd-demo') then
    raise exception 'APolloMD sales organization not found';
  end if;
end $$;

alter table public.sales_leads add column organization_id uuid references public.organizations(id) on delete restrict;
update public.sales_leads set organization_id = (select id from public.organizations where slug = 'apollomd-demo' limit 1) where organization_id is null;
alter table public.sales_leads alter column organization_id set not null;
create index sales_leads_organization_status_created_idx on public.sales_leads (organization_id, status, created_at desc);
comment on column public.sales_leads.organization_id is 'Tenant that owns and processes this commercial lead.';
