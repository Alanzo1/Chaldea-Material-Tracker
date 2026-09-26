import type { TrackedMaterialsState, TrackedServantEntry, SkillLevels } from "./material-tracker"

export interface ProgressDocument {
  version: 1
  qp: number
  servants: Pick<TrackedServantEntry, "servantId" | "ascensionLevel" | "skillLevels" | "appendSkillLevels">[]
  ownedByMaterialId: Record<string, number>
}
export interface PrivateProfile { displayName: string; theme: "dark" | "light" }
export interface CloudSnapshot { document: ProgressDocument; profile: PrivateProfile; revision: number }
export interface PendingSave extends CloudSnapshot { dirty: boolean }
export const emptyDocument = (): ProgressDocument => ({ version: 1, qp: 0, servants: [], ownedByMaterialId: {} })
const integer = (n: unknown, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(0, Math.floor(Number(n) || 0)))
export function toDocument(state: TrackedMaterialsState): ProgressDocument {
  return {
    version: 1, qp: integer(state.qp),
    servants: state.servants.map(s => ({ servantId: s.servantId, ascensionLevel: s.ascensionLevel, skillLevels: [...s.skillLevels], appendSkillLevels: [...s.appendSkillLevels] })),
    ownedByMaterialId: Object.fromEntries(Object.entries(state.ownedByMaterialId).map(([id, n]) => [id, integer(n)])),
  }
}
export function validateDocument(value: unknown): ProgressDocument {
  const d = value as ProgressDocument
  if (!d || d.version !== 1 || !Array.isArray(d.servants) || !d.ownedByMaterialId || typeof d.ownedByMaterialId !== "object" || Array.isArray(d.ownedByMaterialId) || !Number.isSafeInteger(d.qp) || d.qp < 0) throw new Error("Saved progress has an unsupported format. Your save has not been replaced.")
  const ids = new Set<number>()
  for (const s of d.servants) {
    if (!Number.isSafeInteger(s.servantId) || s.servantId <= 0 || ids.has(s.servantId) || !Number.isInteger(s.ascensionLevel) || s.ascensionLevel < 1 || s.ascensionLevel > 5) throw new Error("Invalid saved servant")
    ids.add(s.servantId)
    for (const [levels, min] of [[s.skillLevels, 0], [s.appendSkillLevels, 1]] as [SkillLevels, number][]) {
      if (!Array.isArray(levels) || levels.length !== 3 || levels.some(n => !Number.isInteger(n) || n < min || n > 10)) throw new Error("Invalid saved levels")
    }
  }
  for (const [id, n] of Object.entries(d.ownedByMaterialId)) if (!/^\d+$/.test(id) || !Number.isSafeInteger(n) || n < 0) throw new Error("Invalid saved inventory")
  return d
}
export function hasProgress(d: ProgressDocument) { return d.servants.length > 0 || d.qp > 0 || Object.values(d.ownedByMaterialId).some(n => n > 0) }

export async function hydrateDocument(document: ProgressDocument): Promise<TrackedMaterialsState> {
  validateDocument(document)
  const servants = await Promise.all(document.servants.map(async saved => {
    const response = await fetch(`/data/servants/${saved.servantId}.json`, { cache: "force-cache" })
    if (!response.ok) throw new Error(`Unable to load servant ${saved.servantId}. Retry when connected.`)
    const s = await response.json()
    return { ...saved, servantName: s.name, className: s.className, rarity: s.rarity,
      portrait: s.portrait, ascensionMaterials: s.ascensionMaterials ?? {}, skillMaterials: s.skillMaterials ?? {}, appendSkillMaterials: s.appendSkillMaterials ?? {} }
  }))
  return { version: 1, qp: document.qp, servants, ownedByMaterialId: document.ownedByMaterialId }
}
