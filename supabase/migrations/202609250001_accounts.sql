begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);
create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object' and document->>'version' = '1'),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_progress on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
-- Writes only through the revision-checked function; direct writes cannot bypass conflicts.
revoke all on public.profiles, public.user_progress from anon, authenticated;
grant select on public.profiles, public.user_progress to authenticated;

create function public.save_user_progress(expected_revision integer, progress_document jsonb, profile_name text, profile_theme text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  next_revision integer;
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if expected_revision is null or expected_revision < 0 or progress_document is null
    or jsonb_typeof(progress_document) <> 'object' or progress_document->>'version' is distinct from '1'
    or jsonb_typeof(progress_document->'servants') is distinct from 'array'
    or jsonb_typeof(progress_document->'ownedByMaterialId') is distinct from 'object'
    or jsonb_typeof(progress_document->'qp') is distinct from 'number'
    or (progress_document->>'qp')::numeric < 0
    or octet_length(progress_document::text) > 1048576
    or profile_name is null or char_length(profile_name) > 80
    or profile_theme is null or profile_theme not in ('dark','light')
  then raise exception 'Invalid save' using errcode = '22023'; end if;
  insert into public.user_progress as current (user_id, document, revision)
    values (caller, progress_document, 1)
    on conflict (user_id) do update
      set document = excluded.document, revision = current.revision + 1, updated_at = now()
      where current.revision = expected_revision
    returning revision into next_revision;
  -- An expected nonzero revision must not recreate a removed save.
  if next_revision is null or (next_revision = 1 and expected_revision <> 0) then
    raise exception 'Save conflict' using errcode = '40001';
  end if;
  insert into public.profiles(user_id, display_name, theme)
    values (caller, profile_name, profile_theme)
    on conflict (user_id) do update set display_name = excluded.display_name, theme = excluded.theme, updated_at = now();
  return next_revision;
end;
$$;
revoke all on function public.save_user_progress(integer,jsonb,text,text) from public, anon;
grant execute on function public.save_user_progress(integer,jsonb,text,text) to authenticated;
create function public.read_user_save()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('document', p.document, 'revision', p.revision,
    'display_name', a.display_name, 'theme', a.theme)
  from public.user_progress p join public.profiles a using (user_id)
  where p.user_id = (select auth.uid());
$$;
revoke all on function public.read_user_save() from public, anon;
grant execute on function public.read_user_save() to authenticated;
commit;
