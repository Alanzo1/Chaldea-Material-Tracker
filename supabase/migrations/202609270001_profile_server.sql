-- Each game profile belongs to a game server: NA or JP. Existing profiles are NA.
begin;

alter table public.progress_profiles
  add column server text not null default 'NA' check (server in ('NA', 'JP'));

create function public.create_progress_profile(profile_name text, progress_document jsonb, profile_server text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  clean_name text := btrim(profile_name);
  created public.progress_profiles;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 40
    or profile_server is null or profile_server not in ('NA', 'JP')
    or not coalesce(public.valid_progress_document(progress_document), false)
  then raise exception 'Invalid profile' using errcode = '22023'; end if;
  -- Serialise this user's creates and deletes so the cap and last-profile checks hold.
  perform pg_advisory_xact_lock(hashtext(caller::text));
  if (select count(*) from public.progress_profiles where user_id = caller) >= 10 then
    raise exception 'Profile limit reached' using errcode = 'P0001';
  end if;
  insert into public.progress_profiles (user_id, name, document, revision, server)
    values (caller, clean_name, progress_document, 1, profile_server)
    returning * into created;
  return jsonb_build_object('id', created.id, 'name', created.name, 'revision', created.revision, 'server', created.server);
end;
$$;

-- The two-argument form (used by the previous release) creates an NA profile.
create or replace function public.create_progress_profile(profile_name text, progress_document jsonb)
returns jsonb language sql security definer set search_path = '' as $$
  select public.create_progress_profile(profile_name, progress_document, 'NA');
$$;

create function public.set_progress_profile_server(profile_id uuid, profile_server text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if profile_server is null or profile_server not in ('NA', 'JP')
  then raise exception 'Invalid server' using errcode = '22023'; end if;
  update public.progress_profiles set server = profile_server, updated_at = now()
    where id = profile_id and user_id = caller;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.read_progress_profiles()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'settings', (
      select jsonb_build_object('display_name', a.display_name, 'theme', a.theme)
      from public.profiles a where a.user_id = (select auth.uid())
    ),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'server', p.server, 'document', p.document, 'revision', p.revision, 'updated_at', p.updated_at
      ) order by p.created_at, p.id)
      from public.progress_profiles p where p.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

revoke all on function
  public.create_progress_profile(text, jsonb, text),
  public.set_progress_profile_server(uuid, text)
  from public, anon;
grant execute on function
  public.create_progress_profile(text, jsonb, text),
  public.set_progress_profile_server(uuid, text)
  to authenticated;

commit;
