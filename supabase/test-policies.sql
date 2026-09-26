-- Run against an isolated test database after all migrations. All fixtures roll back.
begin;
insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');

-- A pre-profiles single save becomes "Main" with the same revision.
insert into public.user_progress(user_id, document, revision) values
  ('00000000-0000-0000-0000-000000000003', '{"version":1,"qp":7,"servants":[],"ownedByMaterialId":{}}', 4);
do $$ begin
  if public.backfill_main_profiles() <> 1 then raise exception 'Backfill did not add Main'; end if;
  if public.backfill_main_profiles() <> 0 then raise exception 'Backfill ran twice'; end if;
  if not exists (select 1 from public.progress_profiles
    where user_id = '00000000-0000-0000-0000-000000000003' and name = 'Main' and revision = 4 and document->>'qp' = '7')
  then raise exception 'Backfilled Main is wrong'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select public.create_progress_profile('Main', '{"version":1,"qp":100,"servants":[],"ownedByMaterialId":{}}');
select public.save_account_settings('User A', 'dark');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select public.create_progress_profile('Main', '{"version":1,"qp":200,"servants":[],"ownedByMaterialId":{}}');
select public.save_account_settings('User B', 'light');

do $$
declare
  saved jsonb;
  main_id uuid;
  other_id uuid;
begin
  -- Isolation: user B only sees their own rows.
  if (select count(*) from public.progress_profiles) <> 1 then raise exception 'RLS exposed another user''s profiles'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'RLS exposed another user''s settings'; end if;
  saved := public.read_progress_profiles();
  if jsonb_array_length(saved->'profiles') <> 1 or saved->'profiles'->0->'document'->>'qp' <> '200'
    or saved->'settings'->>'display_name' <> 'User B'
  then raise exception 'Read RPC returned the wrong data: %', saved; end if;
  main_id := (saved->'profiles'->0->>'id')::uuid;

  -- No direct writes.
  begin
    update public.progress_profiles set revision = 999;
    raise exception 'Direct write was permitted';
  exception when insufficient_privilege then null; end;

  -- Another user's profile looks missing, for every write.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  other_id := (public.read_progress_profiles()->'profiles'->0->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  begin
    perform public.save_progress_profile(other_id, 1, '{"version":1,"qp":1,"servants":[],"ownedByMaterialId":{}}');
    raise exception 'Saved another user''s profile';
  exception when no_data_found then null; end;
  begin
    perform public.rename_progress_profile(other_id, 'Hijacked');
    raise exception 'Renamed another user''s profile';
  exception when no_data_found then null; end;
  begin
    perform public.delete_progress_profile(other_id);
    raise exception 'Deleted another user''s profile';
  exception when no_data_found then null; end;

  -- Per-profile revisions.
  if public.save_progress_profile(main_id, 1, '{"version":1,"qp":250,"servants":[],"ownedByMaterialId":{}}') <> 2
  then raise exception 'Revision did not increment'; end if;
  begin
    perform public.save_progress_profile(main_id, 1, '{"version":1,"qp":300,"servants":[],"ownedByMaterialId":{}}');
    raise exception 'Stale revision was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.save_progress_profile(main_id, 2, '{"version":1,"qp":-1,"servants":[],"ownedByMaterialId":{}}');
    raise exception 'Invalid data was accepted';
  exception when invalid_parameter_value then null; end;

  -- Names: trimmed, unique ignoring case.
  perform public.create_progress_profile('  JP alt  ', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}');
  if not exists (select 1 from public.progress_profiles where name = 'JP alt') then raise exception 'Name was not trimmed'; end if;
  begin
    perform public.create_progress_profile('main', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}');
    raise exception 'Duplicate name was accepted';
  exception when unique_violation then null; end;
  begin
    perform public.rename_progress_profile(main_id, '');
    raise exception 'Empty name was accepted';
  exception when invalid_parameter_value then null; end;

  -- Cap of 10.
  for i in 3..10 loop
    perform public.create_progress_profile('Alt ' || i, '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}');
  end loop;
  begin
    perform public.create_progress_profile('Eleventh', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}');
    raise exception 'An 11th profile was accepted' using errcode = 'P0003';
  exception when raise_exception then
    if sqlerrm <> 'Profile limit reached' then raise; end if;
  end;

  -- Never delete the last profile.
  for other_id in select id from public.progress_profiles where id <> main_id loop
    perform public.delete_progress_profile(other_id);
  end loop;
  begin
    perform public.delete_progress_profile(main_id);
    raise exception 'Deleted the last profile' using errcode = 'P0003';
  exception when raise_exception then
    if sqlerrm <> 'Cannot delete last profile' then raise; end if;
  end;

  -- The retired single-save function is closed to clients.
  begin
    perform public.save_user_progress(0, '{"version":1,"qp":1,"servants":[],"ownedByMaterialId":{}}', 'Old', 'dark');
    raise exception 'Old save function still callable';
  exception when insufficient_privilege then null; end;
end $$;

-- Game servers (NA / JP) per profile.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
do $$
declare
  created jsonb;
  saved jsonb;
begin
  -- Existing profiles default to NA; the old two-argument create still makes NA profiles.
  if (public.read_progress_profiles()->'profiles'->0->>'server') <> 'NA' then raise exception 'Existing profile is not NA'; end if;
  if (public.create_progress_profile('Old client', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}')->>'server') <> 'NA'
  then raise exception 'Two-argument create is not NA'; end if;
  created := public.create_progress_profile('JP', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}', 'JP');
  if created->>'server' <> 'JP' then raise exception 'Create did not keep JP'; end if;
  begin
    perform public.create_progress_profile('CN', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}', 'CN');
    raise exception 'Unknown server accepted' using errcode = 'P0003';
  exception when invalid_parameter_value then null; end;
  perform public.set_progress_profile_server((created->>'id')::uuid, 'NA');
  saved := (select p from jsonb_array_elements(public.read_progress_profiles()->'profiles') p where p->>'id' = created->>'id');
  if saved->>'server' <> 'NA' then raise exception 'Server change not saved'; end if;
  begin
    perform public.set_progress_profile_server((created->>'id')::uuid, 'jp');
    raise exception 'Lower-case server accepted' using errcode = 'P0003';
  exception when invalid_parameter_value then null; end;
  -- Another user's profile looks missing.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  begin
    perform public.set_progress_profile_server((created->>'id')::uuid, 'JP');
    raise exception 'Changed another user''s profile server' using errcode = 'P0003';
  exception when no_data_found then null; end;
end $$;

reset role;
set local role anon;
do $$ begin
  begin
    perform public.set_progress_profile_server('00000000-0000-0000-0000-000000000009', 'JP');
    raise exception 'Anonymous server change permitted' using errcode = 'P0003';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin
    perform * from public.progress_profiles;
    raise exception 'Anonymous profile read permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.read_progress_profiles();
    raise exception 'Anonymous RPC read permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_progress_profile('Anon', '{"version":1,"qp":0,"servants":[],"ownedByMaterialId":{}}');
    raise exception 'Anonymous create permitted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
