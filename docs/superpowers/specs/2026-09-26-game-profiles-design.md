# Game Profiles (FGO alt accounts) — Design

**Status:** approved in chat 2026-09-26
**Branch:** `feat/game-profiles`

## Goal

Let one person keep separate planning progress for several FGO game accounts (a main and alts).
Each **game profile** has its own servants, inventory and QP. Works for guests (saved on the device)
and for signed-in users (each profile synced to the cloud).

## Decisions

| Topic | Decision |
|---|---|
| Who gets profiles | Guests and signed-in accounts, same switcher |
| Profile contents | Name + progress (servants, owned materials, QP) |
| Shared across profiles | Theme and account display name |
| Active profile | Remembered per device (phone can be on "Main" while PC is on "JP alt") |
| Existing progress | Becomes a profile named **Main** |
| Cap | 10 profiles |
| New profile | Starts empty (no copy-from) |
| Sign-in import | Offer once to add the guest's device profiles as new cloud profiles; never overwrite |
| Storage approach | One cloud row per profile, each with its own revision |

Terminology: "profile" in this feature means a **game profile**. The existing `public.profiles`
table (display name + theme) is the **account settings** and keeps its name.

## 1. Data

### 1.1 Cloud — new migration `supabase/migrations/202609260001_game_profiles.sql`

```sql
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
```

- RLS enabled; `select` policy `(select auth.uid()) = user_id` for `authenticated`.
- `revoke all` from `anon, authenticated`; `grant select` to `authenticated`. All writes go through
  `security definer` functions with `set search_path = ''` that use `auth.uid()` as the caller.
- Document validation is the same as today's `save_user_progress` (object, `version = 1`, `servants`
  array, `ownedByMaterialId` object, numeric `qp >= 0`, ≤ 1 MiB). It moves into one shared
  function `private_valid_progress(jsonb) returns boolean` used by both create and save.

Functions (all `revoke ... from public, anon; grant execute ... to authenticated`):

| Function | Behaviour | Errors |
|---|---|---|
| `create_progress_profile(profile_name text, progress_document jsonb) returns jsonb` | Takes a per-user advisory lock (`pg_advisory_xact_lock(hashtext(caller::text))`), refuses when the caller already has 10 rows, inserts with `revision = 1`, returns `{id, name, revision}` | `42501` not signed in · `22023` invalid name/document · `23505` duplicate name · `P0001` message `Profile limit reached` |
| `save_progress_profile(profile_id uuid, expected_revision integer, progress_document jsonb) returns integer` | `update ... set document, revision = revision + 1, updated_at = now() where id = profile_id and user_id = caller and revision = expected_revision returning revision` | `40001` revision mismatch · `P0002` profile not found (deleted or not yours) · `22023` invalid document |
| `rename_progress_profile(profile_id uuid, profile_name text) returns void` | Updates the name of the caller's row | `22023` · `23505` · `P0002` |
| `delete_progress_profile(profile_id uuid) returns void` | Takes the same advisory lock; refuses when it is the caller's only row; deletes | `P0001` message `Cannot delete last profile` · `P0002` |
| `save_account_settings(display_name text, theme text) returns void` | Upserts `public.profiles` (display name ≤ 80, theme `dark`/`light`) | `22023` |
| `read_progress_profiles() returns jsonb` (`security invoker`, `stable`) | `{ settings: {display_name, theme} \| null, profiles: [{id, name, document, revision, updated_at}] }` ordered by `created_at` | — |

Migration of existing data (same migration):

- For each `public.user_progress` row insert a `progress_profiles` row with `name = 'Main'`, the same
  `document`, and the same `revision`.
- `revoke execute on function public.save_user_progress(...)` from `authenticated`, so a tab still
  running old code fails with "Not synced" instead of writing to the old table.
- `public.user_progress` and `read_user_save()` stay as a backup; a later migration drops them.

`supabase/test-policies.sql` gains checks for: another user's rows not readable or writable, 11th
create refused, last-profile delete refused, per-profile revision conflict, and the `Main` backfill.
`docs/supabase-setup.md` gains the new migration step.

### 1.2 Device (browser storage)

Guests:

- `chaldea:guest-profiles` → `{ version: 1, active: string, profiles: [{ id: string, name: string }] }`
- `chaldea:guest-progress:<id>` → that profile's `TrackedMaterialsState` (same shape as today, with `qp`).
- First load with no `chaldea:guest-profiles`: create profile **Main** with a random id; its progress
  is read from the existing `trackedMaterialsStateV1` (plus the old `trackerCurrentQp` value) if
  present, otherwise empty. `trackedMaterialsStateV1` is left untouched as a backup. Running the
  migration again is a no-op.

Signed in (per user):

- `chaldea:account:<userId>:profile:<profileId>` → `PendingSave` for that profile (today's single
  `chaldea:account:<userId>` cache moves here; the old key is read once as the cache for "Main").
- `chaldea:account:<userId>:active` → active profile id on this device.
- Recovery copies and the `import-seen` flag keep their current keys.

## 2. App

### 2.1 `lib/profiles.ts` (pure, tested with `node --test`)

No React and no `@/` imports. Works through a `KeyValueStore` interface
(`get(key): string | null`, `set(key, value)`) so tests use an in-memory map.

- `normalizeProfileName(name)`: trim, 1–40 characters, else throws `ProfileError`.
- `createProfile(list, name)`, `renameProfile(list, id, name)`, `deleteProfile(list, id)`:
  return a new list; enforce unique names (case-insensitive), the 10 cap, and never deleting the
  last profile. `deleteProfile` returns the next active id (the profile before it, else the first).
- `loadGuestProfiles(store)`: reads `chaldea:guest-profiles`, running the one-time legacy move.
- `planImport(guestProfiles, accountProfileCount)`: returns `{ add, skippedEmpty, skippedOverCap }`
  for the sign-in import (skip profiles with no progress; add in order until the cap).

### 2.2 Tracker

`lib/material-tracker.ts` keeps its public API. `readGuestProgress(key)` takes the storage key of the
active guest profile, and guest persistence writes to that key. Switching profile calls the existing
`activateTracker()`; every page showing progress already subscribes to store swaps, so no remount.

### 2.3 `AccountProvider`

New context fields: `profiles: {id, name}[]`, `activeProfileId`, `switchProfile(id)`,
`createProfile(name)`, `renameProfile(id, name)`, `deleteProfile(id)`.

Signed in:

- `read_progress_profiles()` loads the list and settings. The active id comes from
  `chaldea:account:<user>:active`, falling back to the first profile.
- The existing `CloudSync` engine runs for the **active profile only**. Its transport calls
  `save_progress_profile` for that id; `read` picks that profile out of `read_progress_profiles()`.
  `P0002` from save means the profile was deleted elsewhere (handled as below).
- Switching: flush the active engine's unsaved changes (same as sign-out today), dispose it, then
  hydrate and activate the target profile from its cache or the cloud.
- On load, any non-active profile whose device cache is `dirty` is saved once in the background.
- On window focus / online: reload the list. New or renamed profiles appear; if the active profile
  no longer exists, switch to the first and show a notice.
- Display name and theme save through `save_account_settings`, separate from progress.
- Create, rename and delete are online-only for signed-in users. They call the RPC, then update
  the list. Failure leaves the list unchanged and shows the error inline.

Guests: the same actions against `lib/profiles.ts` and browser storage.

Sign-in import: the existing import dialog becomes "Add your N device profiles to your account?".
It uses `planImport`, calls `create_progress_profile` for each profile in `add`, and lists the ones
in `skippedOverCap`. It is offered once per account (existing `import-seen` flag). It never
overwrites a cloud profile.

### 2.4 Interface

- **Navbar account button** shows the active profile name. Clicking it opens a popover with:
  the profile list (a check on the active one, click to switch), **New profile** (name input,
  starts empty), **Manage profiles** (→ `/account`), and **Sign in** / **Account**.
- **`/account`** gains a **Profiles** section for guests and signed-in users: the list with
  inline rename, delete with a confirmation naming the profile and its servant count (disabled for
  the last profile), and create.
- Buttons use `cursor-pointer` and the existing neutral button styles (as on the sign-in page).

## 3. Errors

| Situation | Behaviour |
|---|---|
| Offline or save fails | Change kept in that profile's device cache; status "Not synced"; switching away keeps it and it is sent on the next load |
| Revision conflict | Existing "Choose which progress to keep" dialog, scoped to the active profile, title includes the profile name |
| Create / rename / delete fails (offline, cap, duplicate name, last profile) | Inline error in the popover or `/account`; nothing changes locally |
| Active profile deleted on another device | Switch to the first profile; notice "“JP alt” was deleted on another device" |
| A profile's device cache can't be read | That profile shows an error with Retry; its data is left untouched; other profiles keep working |
| Browser storage full | Existing storage warning, shown in the popover |

## 4. Testing

- `lib/profiles.test.mjs`: create/rename/delete and next-active, name rules and duplicates, the 10
  cap, legacy move (no old save / old save + old QP key / run twice), and `planImport`.
- Existing `lib/cloud-sync.test.mjs` and `lib/material-tracker-storage.test.mjs` keep passing.
- `supabase/test-policies.sql` additions listed in 1.1.
- Browser, as a guest: create "JP alt", add a servant, switch to Main and see Main's servants,
  reload and stay on the same profile; Planning totals and a material page's owned count follow the
  active profile.
- Not covered: signed-in sync across two devices, unless a test Supabase project is available.

## Out of scope

Reordering profiles, copying a profile, per-profile theme, server/region tags, sharing profiles.
