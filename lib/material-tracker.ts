const TRACKED_MATERIALS_STATE_KEY = "trackedMaterialsStateV1"
const PERSIST_DEBOUNCE_MS = 120

interface MaterialItemLike {
  amount?: number
  item?: {
    id?: number
    name?: string
    icon?: string
  }
}

interface MaterialStageLike {
  qp?: number
  items?: MaterialItemLike[]
}

export type MaterialStageMap = Record<string, MaterialStageLike | undefined>

export type SkillLevels = [number, number, number]

export interface TrackedMaterial {
  id: number
  name: string
  icon: string
  amount: number
}

export interface TrackedServantEntry {
  servantId: number
  servantName: string
  className: string
  rarity: number
  portrait?: string
  ascensionLevel: number
  skillLevels: SkillLevels
  appendSkillLevels: SkillLevels
  ascensionMaterials: MaterialStageMap
  skillMaterials: MaterialStageMap
  appendSkillMaterials: MaterialStageMap
}

export interface TrackedMaterialsState {
  version: 1
  servants: TrackedServantEntry[]
  ownedByMaterialId: Record<string, number>
}

export interface RequirementMaterial extends TrackedMaterial {
  owned: number
  remaining: number
}

export interface RequirementTotals {
  qp: number
  requiredMaterials: TrackedMaterial[]
  materialsWithOwned: RequirementMaterial[]
  progressPercent: number
}

let inMemoryState: TrackedMaterialsState | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function persistStateNow() {
  if (typeof window === "undefined" || !inMemoryState) return
  writeJson(TRACKED_MATERIALS_STATE_KEY, inMemoryState)
}

function schedulePersist() {
  if (typeof window === "undefined") return
  if (persistTimer) return

  persistTimer = setTimeout(() => {
    persistTimer = null
    persistStateNow()
  }, PERSIST_DEBOUNCE_MS)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSkillLevels(levels: unknown): SkillLevels {
  const input = Array.isArray(levels) ? levels : []

  const normalized = [0, 1, 2].map((index) => {
    const level = toNumber(input[index], 0)
    return Math.min(10, Math.max(0, level))
  }) as SkillLevels

  return normalized
}

function normalizeMaterialMap(value: unknown): MaterialStageMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as MaterialStageMap
}

function normalizeServantEntry(value: unknown): TrackedServantEntry | null {
  if (!value || typeof value !== "object") return null

  const item = value as Record<string, unknown>
  const servantId = toNumber(item.servantId, 0)
  if (!servantId) return null

  const servantName = String(item.servantName ?? "").trim()
  const className = String(item.className ?? "").trim()
  const rarity = Math.max(0, toNumber(item.rarity, 0))
  const portrait = String(item.portrait ?? "").trim()
  const ascensionLevel = Math.min(5, Math.max(1, toNumber(item.ascensionLevel, 1)))

  return {
    servantId,
    servantName,
    className,
    rarity,
    portrait: portrait || undefined,
    ascensionLevel,
    skillLevels: normalizeSkillLevels(item.skillLevels),
    appendSkillLevels: normalizeSkillLevels(item.appendSkillLevels),
    ascensionMaterials: normalizeMaterialMap(item.ascensionMaterials),
    skillMaterials: normalizeMaterialMap(item.skillMaterials),
    appendSkillMaterials: normalizeMaterialMap(item.appendSkillMaterials),
  }
}

function normalizeOwnedMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, number>

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, amount]) => [key, Math.max(0, toNumber(amount, 0))] as const)
    .filter(([key, amount]) => Boolean(toNumber(key, 0)) && amount > 0)

  return Object.fromEntries(entries)
}

function createDefaultState(): TrackedMaterialsState {
  return {
    version: 1,
    servants: [],
    ownedByMaterialId: {},
  }
}

export function readTrackedMaterialsState() {
  if (inMemoryState) return inMemoryState

  const rawState = readJson<unknown>(TRACKED_MATERIALS_STATE_KEY, createDefaultState())

  if (!rawState || typeof rawState !== "object") {
    inMemoryState = createDefaultState()
    return inMemoryState
  }

  const record = rawState as Record<string, unknown>
  const servants = Array.isArray(record.servants)
    ? record.servants.map(normalizeServantEntry).filter(Boolean) as TrackedServantEntry[]
    : []

  inMemoryState = {
    version: 1 as const,
    servants: servants.sort((a, b) => a.servantName.localeCompare(b.servantName)),
    ownedByMaterialId: normalizeOwnedMap(record.ownedByMaterialId),
  }

  return inMemoryState
}

export function writeTrackedMaterialsState(state: TrackedMaterialsState) {
  inMemoryState = state
  schedulePersist()
}

export function upsertTrackedServant(entry: TrackedServantEntry) {
  const state = readTrackedMaterialsState()
  const normalized = normalizeServantEntry(entry)
  if (!normalized) return state

  const nextServants = [
    ...state.servants.filter((item) => item.servantId !== normalized.servantId),
    normalized,
  ]

  const nextState: TrackedMaterialsState = {
    ...state,
    servants: nextServants,
  }

  writeTrackedMaterialsState(nextState)
  return nextState
}

export function removeTrackedServant(servantId: number) {
  const state = readTrackedMaterialsState()
  const nextState: TrackedMaterialsState = {
    ...state,
    servants: state.servants.filter((entry) => entry.servantId !== servantId),
  }
  writeTrackedMaterialsState(nextState)
  return nextState
}

export function reorderTrackedServants(orderedServantIds: number[]) {
  const state = readTrackedMaterialsState()
  const byId = new Map(state.servants.map((entry) => [entry.servantId, entry] as const))
  const used = new Set<number>()

  const reordered = orderedServantIds
    .map((id) => Number(id))
    .filter((id) => byId.has(id))
    .map((id) => {
      used.add(id)
      return byId.get(id)!
    })

  const remaining = state.servants.filter((entry) => !used.has(entry.servantId))

  const nextState: TrackedMaterialsState = {
    ...state,
    servants: [...reordered, ...remaining],
  }

  writeTrackedMaterialsState(nextState)
  return nextState
}

export function updateTrackedServantLevels(params: {
  servantId: number
  ascensionLevel: number
  skillLevels: SkillLevels
  appendSkillLevels?: SkillLevels
}) {
  const { servantId, ascensionLevel, skillLevels, appendSkillLevels } = params
  const state = readTrackedMaterialsState()

  const nextState: TrackedMaterialsState = {
    ...state,
    servants: state.servants.map((entry) =>
      entry.servantId === servantId
        ? {
            ...entry,
            ascensionLevel: Math.min(5, Math.max(1, toNumber(ascensionLevel, 1))),
            skillLevels: normalizeSkillLevels(skillLevels),
            appendSkillLevels: normalizeSkillLevels(appendSkillLevels ?? entry.appendSkillLevels),
          }
        : entry
    ),
  }

  writeTrackedMaterialsState(nextState)
  return nextState
}

export function setOwnedMaterialQuantity(materialId: number, quantity: number) {
  const state = readTrackedMaterialsState()
  const id = String(Math.max(0, toNumber(materialId, 0)))
  if (!id || id === "0") return state

  const nextOwnedByMaterialId = { ...state.ownedByMaterialId }
  const normalizedQuantity = Math.max(0, toNumber(quantity, 0))

  if (normalizedQuantity <= 0) {
    delete nextOwnedByMaterialId[id]
  } else {
    nextOwnedByMaterialId[id] = normalizedQuantity
  }

  const nextState: TrackedMaterialsState = {
    ...state,
    ownedByMaterialId: nextOwnedByMaterialId,
  }

  writeTrackedMaterialsState(nextState)
  return nextState
}

export function getOwnedMaterialQuantity(materialId: number) {
  const state = readTrackedMaterialsState()
  return Math.max(0, toNumber(state.ownedByMaterialId[String(materialId)] ?? 0, 0))
}

function addStageMaterials(
  stage: MaterialStageLike | undefined,
  multiplier: number,
  materialTotals: Map<number, TrackedMaterial>
) {
  if (!stage || multiplier <= 0) return 0

  let qp = toNumber(stage.qp, 0) * multiplier

  ;(stage.items ?? []).forEach((entry) => {
    const id = toNumber(entry.item?.id, 0)
    const name = String(entry.item?.name ?? "")
    const icon = String(entry.item?.icon ?? "")
    const amount = toNumber(entry.amount, 0) * multiplier

    if (!id || !name || !icon || amount <= 0) return

    const existing = materialTotals.get(id)
    if (existing) {
      existing.amount += amount
      return
    }

    materialTotals.set(id, {
      id,
      name,
      icon,
      amount,
    })
  })

  return qp
}

export function calculateServantRequirements(
  servant: TrackedServantEntry,
  ownedByMaterialId: Record<string, number> = {}
): RequirementTotals {
  const materialTotals = new Map<number, TrackedMaterial>()
  let qp = 0

  Object.entries(servant.ascensionMaterials).forEach(([stageKey, stage]) => {
    const stageNumber = toNumber(stageKey, -1)
    if (stageNumber < 0 || stageNumber < Math.max(0, servant.ascensionLevel - 1)) return
    qp += addStageMaterials(stage, 1, materialTotals)
  })

  Object.entries(servant.skillMaterials).forEach(([stageKey, stage]) => {
    const stageNumber = toNumber(stageKey, -1)
    if (stageNumber < 1) return
    const multiplier = servant.skillLevels.filter(
      (level) => stageNumber >= Math.max(1, level)
    ).length
    if (multiplier <= 0) return
    qp += addStageMaterials(stage, multiplier, materialTotals)
  })

  Object.entries(servant.appendSkillMaterials).forEach(([stageKey, stage]) => {
    const stageNumber = toNumber(stageKey, -1)
    if (stageNumber < 1) return
    const multiplier = servant.appendSkillLevels.filter(
      (level) => stageNumber >= Math.max(1, level)
    ).length
    if (multiplier <= 0) return
    qp += addStageMaterials(stage, multiplier, materialTotals)
  })

  const requiredMaterials = [...materialTotals.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const materialsWithOwned = requiredMaterials.map((material) => {
    const owned = Math.max(0, toNumber(ownedByMaterialId[String(material.id)], 0))
    const remaining = Math.max(0, material.amount - owned)
    return {
      ...material,
      owned,
      remaining,
    }
  })

  const totalRequired = materialsWithOwned.reduce((sum, item) => sum + item.amount, 0)
  const totalCovered = materialsWithOwned.reduce(
    (sum, item) => sum + Math.min(item.amount, item.owned),
    0
  )
  const progressPercent = totalRequired > 0 ? Math.min(100, (totalCovered / totalRequired) * 100) : 100

  return {
    qp,
    requiredMaterials,
    materialsWithOwned,
    progressPercent,
  }
}

export function calculateAggregateRequirements(state: TrackedMaterialsState) {
  const aggregate = new Map<number, TrackedMaterial>()
  let qp = 0

  state.servants.forEach((servant) => {
    const totals = calculateServantRequirements(servant)
    qp += totals.qp

    totals.requiredMaterials.forEach((material) => {
      const existing = aggregate.get(material.id)
      if (existing) {
        existing.amount += material.amount
        return
      }
      aggregate.set(material.id, { ...material })
    })
  })

  const requiredMaterials = [...aggregate.values()].sort((a, b) => a.name.localeCompare(b.name))
  const materialsWithOwned = requiredMaterials.map((material) => {
    const owned = Math.max(0, toNumber(state.ownedByMaterialId[String(material.id)] ?? 0, 0))
    const remaining = Math.max(0, material.amount - owned)
    return {
      ...material,
      owned,
      remaining,
    }
  })

  const totalRequired = materialsWithOwned.reduce((sum, item) => sum + item.amount, 0)
  const totalCovered = materialsWithOwned.reduce(
    (sum, item) => sum + Math.min(item.amount, item.owned),
    0
  )
  const progressPercent = totalRequired > 0 ? Math.min(100, (totalCovered / totalRequired) * 100) : 100

  return {
    qp,
    requiredMaterials,
    materialsWithOwned,
    progressPercent,
  }
}

export function exportTrackedMaterialsState() {
  return JSON.stringify(readTrackedMaterialsState(), null, 2)
}

export function importTrackedMaterialsState(payload: string) {
  const parsed = JSON.parse(payload) as Partial<TrackedMaterialsState>
  const nextState: TrackedMaterialsState = {
    version: 1,
    servants: Array.isArray(parsed?.servants)
      ? parsed.servants.map(normalizeServantEntry).filter(Boolean) as TrackedServantEntry[]
      : [],
    ownedByMaterialId: normalizeOwnedMap(parsed?.ownedByMaterialId),
  }
  inMemoryState = nextState
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  persistStateNow()
  return nextState
}
