begin;
alter function public.assign_automation(uuid,uuid) security definer;
alter function public.set_episode_automation_status(uuid,public.episode_automation_status) security definer;
revoke all on function public.assign_automation(uuid,uuid),public.set_episode_automation_status(uuid,public.episode_automation_status) from public,anon;
grant execute on function public.assign_automation(uuid,uuid),public.set_episode_automation_status(uuid,public.episode_automation_status) to authenticated;
commit;
