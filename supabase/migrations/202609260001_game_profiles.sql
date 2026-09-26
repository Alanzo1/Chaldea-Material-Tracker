-- Game profiles: one progress row per FGO account (main + alts), each with its own revision.
begin;

create table public.progress_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  document jsonb not null check (jsonb_typeof(document) = 'object' and document->>'version' = '1'),
  revision integer not null check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Names are unique per user, ignoring case ("Main" and "main" clash), matching the client check.
create unique index progress_profiles_user_name_idx on public.progress_profiles (user_id, lower(name));
create index progress_profiles_user_idx on public.progress_profiles (user_id, created_at);

alter table public.progress_profiles enable row level security;
create policy own_progress_profiles on public.progress_profiles for select to authenticated using ((select auth.uid()) = user_id);
-- Writes only through the functions below.
revoke all on public.progress_profiles from anon, authenticated;
grant select on public.progress_profiles to authenticated;

create function public.valid_progress_document(progress_document jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select progress_document is not null
    and jsonb_typeof(progress_document) = 'object'
    and progress_document->>'version' is not distinct from '1'
    and jsonb_typeof(progress_document->'servants') is not distinct from 'array'
    and jsonb_typeof(progress_document->'ownedByMaterialId') is not distinct from 'object'
    and jsonb_typeof(progress_document->'qp') is not distinct from 'number'
    and (progress_document->>'qp')::numeric >= 0
    and octet_length(progress_document::text) <= 1048576;
$$;
revoke all on function public.valid_progress_document(jsonb) from public, anon, authenticated;

create function public.create_progress_profile(profile_name text, progress_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  clean_name text := btrim(profile_name);
  created public.progress_profiles;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 40
    or not coalesce(public.valid_progress_document(progress_document), false)
  then raise exception 'Invalid profile' using errcode = '22023'; end if;
  -- Serialise this user's creates and deletes so the cap and last-profile checks hold.
  perform pg_advisory_xact_lock(hashtext(caller::text));
  if (select count(*) from public.progress_profiles where user_id = caller) >= 10 then
    raise exception 'Profile limit reached' using errcode = 'P0001';
  end if;
  insert into public.progress_profiles (user_id, name, document, revision)
    values (caller, clean_name, progress_document, 1)
    returning * into created;
  return jsonb_build_object('id', created.id, 'name', created.name, 'revision', created.revision);
end;
$$;

create function public.save_progress_profile(profile_id uuid, expected_revision integer, progress_document jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  next_revision integer;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if expected_revision is null or not coalesce(public.valid_progress_document(progress_document), false)
  then raise exception 'Invalid save' using errcode = '22023'; end if;
  update public.progress_profiles
    set document = progress_document, revision = revision + 1, updated_at = now()
    where id = profile_id and user_id = caller and revision = expected_revision
    returning revision into next_revision;
  if next_revision is null then
    if exists (select 1 from public.progress_profiles where id = profile_id and user_id = caller) then
      raise exception 'Save conflict' using errcode = '40001';
    end if;
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return next_revision;
end;
$$;

create function public.rename_progress_profile(profile_id uuid, profile_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  clean_name text := btrim(profile_name);
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 40
  then raise exception 'Invalid profile name' using errcode = '22023'; end if;
  update public.progress_profiles set name = clean_name, updated_at = now()
    where id = profile_id and user_id = caller;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;

create function public.delete_progress_profile(profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(caller::text));
  if not exists (select 1 from public.progress_profiles where id = profile_id and user_id = caller) then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.progress_profiles where user_id = caller) <= 1 then
    raise exception 'Cannot delete last profile' using errcode = 'P0001';
  end if;
  delete from public.progress_profiles where id = profile_id and user_id = caller;
end;
$$;

-- Display name and theme belong to the account, not to a game profile.
create function public.save_account_settings(display_name text, theme text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if display_name is null or char_length(display_name) > 80 or theme is null or theme not in ('dark', 'light')
  then raise exception 'Invalid settings' using errcode = '22023'; end if;
  insert into public.profiles (user_id, display_name, theme)
    values (caller, display_name, theme)
    on conflict (user_id) do update
      set display_name = excluded.display_name, theme = excluded.theme, updated_at = now();
end;
$$;

create function public.read_progress_profiles()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'settings', (
      select jsonb_build_object('display_name', a.display_name, 'theme', a.theme)
      from public.profiles a where a.user_id = (select auth.uid())
    ),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'document', p.document, 'revision', p.revision, 'updated_at', p.updated_at
      ) order by p.created_at, p.id)
      from public.progress_profiles p where p.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke all on function
  public.create_progress_profile(text, jsonb),
  public.save_progress_profile(uuid, integer, jsonb),
  public.rename_progress_profile(uuid, text),
  public.delete_progress_profile(uuid),
  public.save_account_settings(text, text),
  public.read_progress_profiles()
  from public, anon;
grant execute on function
  public.create_progress_profile(text, jsonb),
  public.save_progress_profile(uuid, integer, jsonb),
  public.rename_progress_profile(uuid, text),
  public.delete_progress_profile(uuid),
  public.save_account_settings(text, text),
  public.read_progress_profiles()
  to authenticated;

-- Existing single saves become each user's "Main" profile, keeping their revision.
create function public.backfill_main_profiles()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  added integer;
begin
  insert into public.progress_profiles (user_id, name, document, revision, created_at, updated_at)
    select u.user_id, 'Main', u.document, u.revision, u.updated_at, u.updated_at
    from public.user_progress u
    where not exists (select 1 from public.progress_profiles p where p.user_id = u.user_id)
    on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;
revoke all on function public.backfill_main_profiles() from public, anon, authenticated;
select public.backfill_main_profiles();

-- Old clients must not keep saving to the retired single-save table. It stays as a backup for now.
revoke execute on function public.save_user_progress(integer, jsonb, text, text) from authenticated;

commit;
