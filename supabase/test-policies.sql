-- Run against an isolated test database after the migration. All fixtures roll back.
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.save_user_progress(0, '{"version":1,"qp":100,"servants":[],"ownedByMaterialId":{}}', 'User A', 'dark');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.save_user_progress(0, '{"version":1,"qp":200,"servants":[],"ownedByMaterialId":{}}', 'User B', 'light');
do $$ begin
  if (select count(*) from public.user_progress) <> 1 then raise exception 'RLS exposed another user progress'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'RLS exposed another user profile'; end if;
  if (public.read_user_save()->'document'->>'qp') <> '200' then raise exception 'Read RPC exposed wrong user'; end if;
  begin
    update public.user_progress set revision = 999;
    raise exception 'Direct write was permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(user_id, display_name) values ('00000000-0000-0000-0000-000000000001', 'Hijacked');
    raise exception 'Profile direct write was permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_user_progress(0, '{"version":1,"qp":300,"servants":[],"ownedByMaterialId":{}}', 'Stale', 'dark');
    raise exception 'Stale revision was accepted';
  exception when serialization_failure then null; end;
  if (public.read_user_save()->>'display_name') <> 'User B' then raise exception 'Conflict changed profile'; end if;
  if public.save_user_progress(1, '{"version":1,"qp":250,"servants":[],"ownedByMaterialId":{}}', 'Updated B', 'light') <> 2 then raise exception 'Revision did not increment'; end if;
  begin
    perform public.save_user_progress(2, '{"version":1,"qp":-1,"servants":[],"ownedByMaterialId":{}}', 'Invalid', 'dark');
    raise exception 'Invalid data was accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.profiles;
    raise exception 'Anonymous profile read permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.user_progress;
    raise exception 'Anonymous progress read permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.read_user_save();
    raise exception 'Anonymous RPC read permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_user_progress(0, '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}', 'Anonymous', 'dark');
    raise exception 'Anonymous RPC write permitted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
