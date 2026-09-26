// Game profiles: separate planning progress per FGO account (main + alts).
// Pure list logic plus the guest (device) profile index; no React, no @/ imports.

export const MAX_PROFILES = 10
export const MAX_PROFILE_NAME = 40
export const GUEST_PROFILES_KEY = "chaldea:guest-profiles"
export const LEGACY_GUEST_KEY = "trackedMaterialsStateV1"
const LEGACY_QP_KEY = "trackerCurrentQp"
export const guestProgressKey = (id: string) => `chaldea:guest-progress:${id}`

export interface ProfileMeta {
  id: string
  name: string
}

export interface GuestProfiles {
  version: 1
  active: string
  profiles: ProfileMeta[]
}

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

export class ProfileError extends Error {}

export function normalizeProfileName(name: string) {
  const trimmed = String(name ?? "").trim()
  if (!trimmed) throw new ProfileError("Enter a profile name.")
  if (trimmed.length > MAX_PROFILE_NAME) throw new ProfileError(`Profile names can be up to ${MAX_PROFILE_NAME} characters.`)
  return trimmed
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function assertNameFree(profiles: ProfileMeta[], name: string, exceptId?: string) {
  if (profiles.some((profile) => profile.id !== exceptId && sameName(profile.name, name))) {
    throw new ProfileError(`A profile named “${name}” already exists.`)
  }
}

export function createProfile(profiles: ProfileMeta[], name: string, id: string): ProfileMeta[] {
  const normalized = normalizeProfileName(name)
  if (profiles.length >= MAX_PROFILES) throw new ProfileError(`You can have up to ${MAX_PROFILES} profiles.`)
  assertNameFree(profiles, normalized)
  return [...profiles, { id, name: normalized }]
}

export function renameProfile(profiles: ProfileMeta[], id: string, name: string): ProfileMeta[] {
  const normalized = normalizeProfileName(name)
  if (!profiles.some((profile) => profile.id === id)) throw new ProfileError("That profile no longer exists.")
  assertNameFree(profiles, normalized, id)
  return profiles.map((profile) => (profile.id === id ? { ...profile, name: normalized } : profile))
}

/** Removes a profile; `nextActive` is the one before it (else the new first) for when it was active. */
export function deleteProfile(profiles: ProfileMeta[], id: string) {
  const index = profiles.findIndex((profile) => profile.id === id)
  if (index === -1) throw new ProfileError("That profile no longer exists.")
  if (profiles.length === 1) throw new ProfileError("You can't delete your last profile.")
  const remaining = profiles.filter((profile) => profile.id !== id)
  return { profiles: remaining, nextActive: (remaining[index - 1] ?? remaining[0]).id }
}

function readJson(store: KeyValueStore, key: string): unknown {
  try {
    return JSON.parse(store.get(key) ?? "null")
  } catch {
    return null
  }
}

function isGuestProfiles(value: unknown): value is GuestProfiles {
  const record = value as GuestProfiles | null
  return Boolean(
    record &&
      record.version === 1 &&
      Array.isArray(record.profiles) &&
      record.profiles.length > 0 &&
      record.profiles.every((profile) => typeof profile?.id === "string" && typeof profile?.name === "string")
  )
}

export function saveGuestProfiles(store: KeyValueStore, value: GuestProfiles) {
  store.set(GUEST_PROFILES_KEY, JSON.stringify(value))
}

/**
 * Reads the device profile list. The first time, the pre-profiles guest save becomes "Main";
 * the legacy key is left untouched as a backup.
 */
export function loadGuestProfiles(store: KeyValueStore, newId: () => string): GuestProfiles {
  const saved = readJson(store, GUEST_PROFILES_KEY)
  if (isGuestProfiles(saved)) {
    if (saved.profiles.some((profile) => profile.id === saved.active)) return saved
    const repaired = { ...saved, active: saved.profiles[0].id }
    saveGuestProfiles(store, repaired)
    return repaired
  }

  const id = newId()
  const legacy = readJson(store, LEGACY_GUEST_KEY)
  if (legacy && typeof legacy === "object") {
    const record = legacy as Record<string, unknown>
    const legacyQp = readJson(store, LEGACY_QP_KEY)
    const qp = record.qp ?? (legacyQp == null ? undefined : Number(legacyQp))
    store.set(guestProgressKey(id), JSON.stringify(qp === undefined ? record : { ...record, qp }))
  }
  const created: GuestProfiles = { version: 1, active: id, profiles: [{ id, name: "Main" }] }
  saveGuestProfiles(store, created)
  return created
}

export interface ImportCandidate extends ProfileMeta {
  hasProgress: boolean
}

/** Which device profiles to add to an account on sign-in. Never overwrites; clashing names get a suffix. */
export function planImport(guest: ImportCandidate[], account: ProfileMeta[]) {
  const taken = account.map((profile) => profile.name)
  const add: ProfileMeta[] = []
  const skippedEmpty: ProfileMeta[] = []
  const skippedOverCap: ProfileMeta[] = []

  for (const candidate of guest) {
    const meta = { id: candidate.id, name: candidate.name }
    if (!candidate.hasProgress) {
      skippedEmpty.push(meta)
      continue
    }
    if (taken.length >= MAX_PROFILES) {
      skippedOverCap.push(meta)
      continue
    }
    const name = uniqueName(candidate.name, taken)
    taken.push(name)
    add.push({ id: candidate.id, name })
  }

  return { add, skippedEmpty, skippedOverCap }
}

function uniqueName(name: string, taken: string[]) {
  const free = (candidate: string) => !taken.some((existing) => sameName(existing, candidate))
  if (free(name)) return name
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? " (device)" : ` (device ${n})`
    const candidate = `${name.slice(0, MAX_PROFILE_NAME - suffix.length)}${suffix}`
    if (free(candidate)) return candidate
  }
}
