"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Home, ListChecks } from "lucide-react"

import {
  calculateServantRequirements,
  type RequirementTotals,
  readTrackedMaterialsState,
  setOwnedMaterialQuantity,
  updateTrackedServantLevels,
  writeTrackedMaterialsState,
  type SkillLevels,
  type TrackedMaterial,
  type TrackedMaterialsState,
} from "@/lib/material-tracker"
import { computeServantRequirementsInWorker } from "@/lib/material-tracker-worker-client"
import { HeaderActionLink } from "@/components/HeaderActionLink"
import { PageHeader } from "@/components/PageHeader"

interface StageProgressRow {
  label: string
  qp: number
  materials: Array<TrackedMaterial & { owned: number; remaining: number }>
  progressPercent: number
}

interface UpgradeCostMaterial {
  id: number
  name: string
  amount: number
}

interface SkillUpgradeStatus {
  currentLevel: number
  nextLevel: number | null
  qpCost: number
  materials: UpgradeCostMaterial[]
  missingQp: number
  missingMaterials: Array<UpgradeCostMaterial & { owned: number; missing: number }>
  canUpgrade: boolean
  reason: string
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")
const TRACKER_CURRENT_QP_KEY = "trackerCurrentQp"
const EMPTY_TOTALS: RequirementTotals = {
  qp: 0,
  requiredMaterials: [],
  materialsWithOwned: [],
  progressPercent: 100,
}

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toWholeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

function normalizeSkillLevel(level: unknown) {
  return Math.min(10, Math.max(1, toWholeNumber(level, 1)))
}

function getStageCostMaterials(stage: unknown) {
  const materialTotals = new Map<number, UpgradeCostMaterial>()
  const items = Array.isArray((stage as { items?: unknown[] } | null)?.items)
    ? ((stage as { items?: unknown[] }).items ?? [])
    : []

  items.forEach((entry) => {
    const row = entry as { amount?: unknown; item?: { id?: unknown; name?: unknown } }
    const id = toWholeNumber(row?.item?.id, 0)
    const amount = toWholeNumber(row?.amount, 0)
    if (!id || amount <= 0) return

    const name = String(row?.item?.name ?? `Material ${id}`).trim() || `Material ${id}`
    const existing = materialTotals.get(id)
    if (existing) {
      existing.amount += amount
      return
    }

    materialTotals.set(id, { id, name, amount })
  })

  return [...materialTotals.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function getSkillUpgradeStatus(params: {
  stageMap: Record<string, unknown> | undefined
  currentLevel: number
  ownedByMaterialId: Record<string, number>
  currentQp: number
}) {
  const normalizedLevel = normalizeSkillLevel(params.currentLevel)

  if (normalizedLevel >= 10) {
    return {
      currentLevel: normalizedLevel,
      nextLevel: null,
      qpCost: 0,
      materials: [],
      missingQp: 0,
      missingMaterials: [],
      canUpgrade: false,
      reason: "Max level",
    } as SkillUpgradeStatus
  }

  const stageKey = String(normalizedLevel)
  const stage = params.stageMap?.[stageKey]
  if (!stage || typeof stage !== "object") {
    return {
      currentLevel: normalizedLevel,
      nextLevel: normalizedLevel + 1,
      qpCost: 0,
      materials: [],
      missingQp: 0,
      missingMaterials: [],
      canUpgrade: false,
      reason: "Missing upgrade data",
    } as SkillUpgradeStatus
  }

  const qpCost = toWholeNumber((stage as { qp?: unknown }).qp, 0)
  const materials = getStageCostMaterials(stage)
  const missingMaterials = materials
    .map((material) => {
      const owned = toWholeNumber(params.ownedByMaterialId[String(material.id)] ?? 0, 0)
      const missing = Math.max(0, material.amount - owned)
      return { ...material, owned, missing }
    })
    .filter((item) => item.missing > 0)
  const missingQp = Math.max(0, qpCost - params.currentQp)
  const canUpgrade = missingQp === 0 && missingMaterials.length === 0

  return {
    currentLevel: normalizedLevel,
    nextLevel: normalizedLevel + 1,
    qpCost,
    materials,
    missingQp,
    missingMaterials,
    canUpgrade,
    reason: canUpgrade
      ? "Ready"
      : missingQp > 0
      ? "Not enough QP"
      : "Not enough materials",
  } as SkillUpgradeStatus
}

function getUpgradeHelperText(status: SkillUpgradeStatus) {
  if (status.currentLevel >= 10 || !status.nextLevel) return "Max level"
  const materialCount = status.materials.reduce((sum, item) => sum + item.amount, 0)

  if (status.canUpgrade) {
    return `Lv ${status.currentLevel}→${status.nextLevel} · QP ${formatNumber(status.qpCost)} · Mats ${formatNumber(materialCount)}`
  }

  const missingParts: string[] = []
  if (status.missingQp > 0) missingParts.push(`QP ${formatNumber(status.missingQp)}`)
  if (status.missingMaterials.length > 0) {
    const missingMaterialCount = status.missingMaterials.reduce((sum, item) => sum + item.missing, 0)
    missingParts.push(`Mats ${formatNumber(missingMaterialCount)}`)
  }

  if (missingParts.length) {
    return `Missing ${missingParts.join(" · ")}`
  }

  return status.reason
}

function writeCurrentQpToStorage(value: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(TRACKER_CURRENT_QP_KEY, String(Math.max(0, Math.floor(value))))
  } catch {
    // no-op
  }
}

function getStarColorClass(rarity: number) {
  if (rarity <= 2) return "text-amber-700"
  if (rarity === 3) return "text-slate-400"
  return "text-yellow-400"
}

function buildStageProgressRows(
  stageMap: Record<string, any>,
  shouldInclude: (stageNumber: number) => number,
  label: (stageNumber: number) => string,
  ownedByMaterialId: Record<string, number>
) {
  const rows: StageProgressRow[] = []

  Object.entries(stageMap ?? {})
    .map(([stageKey, stage]) => [toNumber(stageKey, -1), stage] as const)
    .filter(([stageNumber]) => stageNumber >= 0)
    .sort((a, b) => a[0] - b[0])
    .forEach(([stageNumber, stage]) => {
      const multiplier = shouldInclude(stageNumber)
      if (multiplier <= 0) return

      const materialMap = new Map<number, TrackedMaterial>()
      ;(stage?.items ?? []).forEach((entry: any) => {
        const id = toNumber(entry?.item?.id, 0)
        const name = String(entry?.item?.name ?? "")
        const icon = String(entry?.item?.icon ?? "")
        const amount = toNumber(entry?.amount, 0) * multiplier
        if (!id || !name || !icon || amount <= 0) return
        materialMap.set(id, { id, name, icon, amount })
      })

      const materials = [...materialMap.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((material) => {
          const owned = toNumber(ownedByMaterialId[String(material.id)], 0)
          const remaining = Math.max(0, material.amount - owned)
          return { ...material, owned, remaining }
        })

      const totalRequired = materials.reduce((sum, item) => sum + item.amount, 0)
      const totalCovered = materials.reduce((sum, item) => sum + Math.min(item.amount, item.owned), 0)
      const progressPercent = totalRequired > 0 ? Math.min(100, (totalCovered / totalRequired) * 100) : 100

      rows.push({
        label: label(stageNumber),
        qp: toNumber(stage?.qp, 0) * multiplier,
        materials,
        progressPercent,
      })
    })

  return rows
}

// ─── Tab config ──────────────────────────────────────────────────────────────
const PROGRESS_TABS = [
  { key: "ascension",    label: "Ascension",     color: "amber"  },
  { key: "skills",       label: "Skills",         color: "sky"    },
  { key: "appendSkills", label: "Append Skills",  color: "violet" },
] as const

type ProgressTab = (typeof PROGRESS_TABS)[number]["key"]

const TAB_COLORS: Record<string, { active: string; bar: string; border: string }> = {
  amber:  { active: "border-amber-500/60 bg-amber-500/10 text-amber-400",  bar: "bg-amber-500",  border: "border-amber-500/20" },
  sky:    { active: "border-sky-500/60 bg-sky-500/10 text-sky-400",        bar: "bg-sky-500",    border: "border-sky-500/20"   },
  violet: { active: "border-violet-500/60 bg-violet-500/10 text-violet-400", bar: "bg-violet-500", border: "border-violet-500/20" },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageProgressCard({
  row,
  barColor,
  borderColor,
  onOwnedChange,
}: {
  row: StageProgressRow
  barColor: string
  borderColor: string
  onOwnedChange: (id: number, value: string) => void
}) {
  return (
    <div className={`rounded-xl border ${borderColor} bg-card/60 p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{row.label}</p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>QP: {formatNumber(row.qp)}</span>
          <span className="font-medium text-foreground/70">{row.progressPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${row.progressPercent}%` }}
        />
      </div>

      {/* Materials grid */}
      {row.materials.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {row.materials.map((material) => (
            <div
              key={`${row.label}-${material.id}`}
              className="rounded-lg border border-border bg-background/50 p-2.5"
            >
              <div className="flex items-center gap-2">
                <Image
                  src={material.icon}
                  alt={material.name}
                  width={24}
                  height={24}
                  className="rounded-sm"
                />
                <span className="text-xs font-medium text-foreground/90 leading-tight">{material.name}</span>
              </div>

              <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>Need <span className="text-foreground/80">{material.amount}</span></span>
                <span>·</span>
                <span>Remaining <span className={material.remaining > 0 ? "text-red-400/70" : "text-emerald-400/70"}>{material.remaining}</span></span>
              </div>

              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  value={material.owned}
                  onChange={(e) => onOwnedChange(material.id, e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-0"
                  placeholder="Owned"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No materials for this stage.</p>
      )}
    </div>
  )
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
            active === tab.key
              ? "border-border bg-secondary text-secondary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function LevelSelect({
  label,
  value,
  options,
  onChange,
  action,
}: {
  label: string
  value: number
  options: { value: number; label: string }[]
  onChange: (value: number) => void
  action?: {
    label: string
    onClick: () => void
    disabled?: boolean
    title?: string
    helperText?: string
  }
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <select
          className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
          value={value}
          onChange={(e) => onChange(toNumber(e.target.value, 1))}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
            className="min-w-20 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs font-medium text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/50 disabled:text-muted-foreground"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      {action?.helperText ? (
        <p className="text-[10px] text-muted-foreground">{action.helperText}</p>
      ) : null}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrackedServantDetailPage() {
  const params = useParams<{ id: string }>()
  const servantId = toNumber(params?.id, 0)

  const [state, setState] = useState<TrackedMaterialsState>({
    version: 1,
    servants: [],
    ownedByMaterialId: {},
  })
  const [activeProgressTab, setActiveProgressTab] = useState<ProgressTab>("ascension")
  const [activeSkillTab, setActiveSkillTab] = useState(0)
  const [activeAppendSkillTab, setActiveAppendSkillTab] = useState(0)
  const [totalRequirements, setTotalRequirements] = useState<RequirementTotals>(EMPTY_TOTALS)
  const [currentQpInput, setCurrentQpInput] = useState("0")

  useEffect(() => {
    setState(readTrackedMaterialsState())
    try {
      const rawQp = window.localStorage.getItem(TRACKER_CURRENT_QP_KEY)
      setCurrentQpInput(String(toWholeNumber(rawQp, 0)))
    } catch {
      setCurrentQpInput("0")
    }
  }, [])
  useEffect(() => { setActiveSkillTab(0); setActiveAppendSkillTab(0) }, [servantId])

  const servant = useMemo(
    () => state.servants.find((entry) => entry.servantId === servantId) ?? null,
    [servantId, state.servants]
  )

  const ascensionRows = useMemo(() => {
    if (!servant) return []
    return buildStageProgressRows(
      servant.ascensionMaterials,
      (n) => (n >= Math.max(0, servant.ascensionLevel - 1) ? 1 : 0),
      (n) => `Ascension ${n + 1}`,
      state.ownedByMaterialId
    )
  }, [servant, state.ownedByMaterialId])

  const skillRowsBySkill = useMemo(() => {
    if (!servant) return [[], [], []] as StageProgressRow[][]
    return [0, 1, 2].map((i) =>
      buildStageProgressRows(
        servant.skillMaterials,
        (n) => (n >= Math.max(1, servant.skillLevels[i]) ? 1 : 0),
        (n) => `Skill Lv ${n} → ${n + 1}`,
        state.ownedByMaterialId
      )
    )
  }, [servant, state.ownedByMaterialId])

  const appendSkillRowsBySkill = useMemo(() => {
    if (!servant) return [[], [], []] as StageProgressRow[][]
    return [0, 1, 2].map((i) =>
      buildStageProgressRows(
        servant.appendSkillMaterials,
        (n) => (n >= Math.max(1, servant.appendSkillLevels[i]) ? 1 : 0),
        (n) => `Append Skill Lv ${n} → ${n + 1}`,
        state.ownedByMaterialId
      )
    )
  }, [servant, state.ownedByMaterialId])

  const activeSkillRows = skillRowsBySkill[activeSkillTab] ?? []
  const activeAppendSkillRows = appendSkillRowsBySkill[activeAppendSkillTab] ?? []
  const currentQp = toWholeNumber(currentQpInput === "" ? 0 : currentQpInput, 0)
  const skillUpgradeStatusByIndex = useMemo(() => {
    if (!servant) return [null, null, null] as Array<SkillUpgradeStatus | null>
    return [0, 1, 2].map((index) =>
      getSkillUpgradeStatus({
        stageMap: servant.skillMaterials as Record<string, unknown> | undefined,
        currentLevel: servant.skillLevels[index],
        ownedByMaterialId: state.ownedByMaterialId,
        currentQp,
      })
    )
  }, [currentQp, servant, state.ownedByMaterialId])
  const appendSkillUpgradeStatusByIndex = useMemo(() => {
    if (!servant) return [null, null, null] as Array<SkillUpgradeStatus | null>
    return [0, 1, 2].map((index) =>
      getSkillUpgradeStatus({
        stageMap: servant.appendSkillMaterials as Record<string, unknown> | undefined,
        currentLevel: servant.appendSkillLevels[index],
        ownedByMaterialId: state.ownedByMaterialId,
        currentQp,
      })
    )
  }, [currentQp, servant, state.ownedByMaterialId])

  useEffect(() => {
    if (!servant) {
      setTotalRequirements(EMPTY_TOTALS)
      return
    }

    let cancelled = false
    computeServantRequirementsInWorker(servant, state.ownedByMaterialId)
      .then((totals) => {
        if (!cancelled) setTotalRequirements(totals)
      })
      .catch(() => {
        if (cancelled) return
        setTotalRequirements(calculateServantRequirements(servant, state.ownedByMaterialId))
      })

    return () => {
      cancelled = true
    }
  }, [servant, state.ownedByMaterialId])

  const handleUpdateLevels = (nextAscension: number, nextSkills: SkillLevels) => {
    if (!servant) return
    setState(updateTrackedServantLevels({
      servantId: servant.servantId,
      ascensionLevel: nextAscension,
      skillLevels: nextSkills,
      appendSkillLevels: servant.appendSkillLevels,
    }))
  }

  const handleUpdateAppendLevels = (nextAppendSkills: SkillLevels) => {
    if (!servant) return
    setState(updateTrackedServantLevels({
      servantId: servant.servantId,
      ascensionLevel: servant.ascensionLevel,
      skillLevels: servant.skillLevels,
      appendSkillLevels: nextAppendSkills,
    }))
  }

  const handleOwnedQuantityChange = (materialId: number, value: string) => {
    const parsed = Number(value)
    const safeValue = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
    setState(setOwnedMaterialQuantity(materialId, safeValue))
  }

  const handleCurrentQpChange = (value: string) => {
    if (value === "") {
      setCurrentQpInput("")
      writeCurrentQpToStorage(0)
      return
    }

    const safeValue = toWholeNumber(value, 0)
    setCurrentQpInput(String(safeValue))
    writeCurrentQpToStorage(safeValue)
  }

  const handleUpgradeSkill = (skillIndex: number) => {
    if (!servant) return
    if (skillIndex < 0 || skillIndex > 2) return

    const latestState = readTrackedMaterialsState()
    const latestServant = latestState.servants.find((entry) => entry.servantId === servant.servantId)
    if (!latestServant) return

    const currentQpValue = toWholeNumber(currentQpInput === "" ? 0 : currentQpInput, 0)
    const upgradeStatus = getSkillUpgradeStatus({
      stageMap: latestServant.skillMaterials as Record<string, unknown> | undefined,
      currentLevel: latestServant.skillLevels[skillIndex],
      ownedByMaterialId: latestState.ownedByMaterialId,
      currentQp: currentQpValue,
    })

    if (!upgradeStatus.canUpgrade || !upgradeStatus.nextLevel) return

    const nextOwnedByMaterialId = { ...latestState.ownedByMaterialId }
    for (const material of upgradeStatus.materials) {
      const key = String(material.id)
      const ownedAmount = toWholeNumber(nextOwnedByMaterialId[key] ?? 0, 0)
      if (ownedAmount < material.amount) return
      const remaining = ownedAmount - material.amount
      if (remaining <= 0) {
        delete nextOwnedByMaterialId[key]
      } else {
        nextOwnedByMaterialId[key] = remaining
      }
    }

    const nextSkillLevels = [...latestServant.skillLevels] as SkillLevels
    const normalizedCurrentLevel = normalizeSkillLevel(nextSkillLevels[skillIndex])
    if (normalizedCurrentLevel >= 10) return
    nextSkillLevels[skillIndex] = normalizedCurrentLevel + 1

    const nextState: TrackedMaterialsState = {
      ...latestState,
      ownedByMaterialId: nextOwnedByMaterialId,
      servants: latestState.servants.map((entry) =>
        entry.servantId === latestServant.servantId
          ? { ...entry, skillLevels: nextSkillLevels }
          : entry
      ),
    }

    const nextQp = Math.max(0, currentQpValue - upgradeStatus.qpCost)
    writeTrackedMaterialsState(nextState)
    writeCurrentQpToStorage(nextQp)
    setCurrentQpInput(String(nextQp))
    setState(nextState)
  }

  const handleUpgradeAppendSkill = (skillIndex: number) => {
    if (!servant) return
    if (skillIndex < 0 || skillIndex > 2) return

    const latestState = readTrackedMaterialsState()
    const latestServant = latestState.servants.find((entry) => entry.servantId === servant.servantId)
    if (!latestServant) return

    const currentQpValue = toWholeNumber(currentQpInput === "" ? 0 : currentQpInput, 0)
    const upgradeStatus = getSkillUpgradeStatus({
      stageMap: latestServant.appendSkillMaterials as Record<string, unknown> | undefined,
      currentLevel: latestServant.appendSkillLevels[skillIndex],
      ownedByMaterialId: latestState.ownedByMaterialId,
      currentQp: currentQpValue,
    })

    if (!upgradeStatus.canUpgrade || !upgradeStatus.nextLevel) return

    const nextOwnedByMaterialId = { ...latestState.ownedByMaterialId }
    for (const material of upgradeStatus.materials) {
      const key = String(material.id)
      const ownedAmount = toWholeNumber(nextOwnedByMaterialId[key] ?? 0, 0)
      if (ownedAmount < material.amount) return
      const remaining = ownedAmount - material.amount
      if (remaining <= 0) {
        delete nextOwnedByMaterialId[key]
      } else {
        nextOwnedByMaterialId[key] = remaining
      }
    }

    const nextAppendSkillLevels = [...latestServant.appendSkillLevels] as SkillLevels
    const normalizedCurrentLevel = normalizeSkillLevel(nextAppendSkillLevels[skillIndex])
    if (normalizedCurrentLevel >= 10) return
    nextAppendSkillLevels[skillIndex] = normalizedCurrentLevel + 1

    const nextState: TrackedMaterialsState = {
      ...latestState,
      ownedByMaterialId: nextOwnedByMaterialId,
      servants: latestState.servants.map((entry) =>
        entry.servantId === latestServant.servantId
          ? { ...entry, appendSkillLevels: nextAppendSkillLevels }
          : entry
      ),
    }

    const nextQp = Math.max(0, currentQpValue - upgradeStatus.qpCost)
    writeTrackedMaterialsState(nextState)
    writeCurrentQpToStorage(nextQp)
    setCurrentQpInput(String(nextQp))
    setState(nextState)
  }

  // ─── Active progress tab data ───────────────────────────────────────────────
  const activeTabConfig = PROGRESS_TABS.find((t) => t.key === activeProgressTab)!
  const colors = TAB_COLORS[activeTabConfig.color]

  const activeRows =
    activeProgressTab === "ascension"
      ? ascensionRows
      : activeProgressTab === "skills"
      ? activeSkillRows
      : activeAppendSkillRows

  const emptyLabel =
    activeProgressTab === "ascension"
      ? "No ascension materials selected."
      : activeProgressTab === "skills"
      ? "No skill materials selected."
      : "No append skill materials selected."

  // ─── Not found ─────────────────────────────────────────────────────────────
  if (!servant) {
    return (
      <main className="min-h-screen bg-background pb-16">
        <PageHeader
          title="Tracked Servant"
          subtitle="Servant not found."
          actions={
            <HeaderActionLink href="/track-materials" icon={<ArrowLeft className="size-3.5" />} label="Back to Tracker" />
          }
        />
        <div className="mx-auto max-w-5xl px-6 pt-8">
          <p className="text-sm text-muted-foreground">Tracked servant not found.</p>
        </div>
      </main>
    )
  }

  // ─── Main ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background pb-16">

      {/* Ambient gradient */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      <PageHeader
        title={servant.servantName}
        subtitle={`${servant.className} · ${"★".repeat(servant.rarity)}`}
        actions={
          <>
            <HeaderActionLink href="/" icon={<Home className="size-3.5" />} label="Home" />
            <HeaderActionLink href="/track-materials" icon={<ListChecks className="size-3.5" />} label="Tracker" />
          </>
        }
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-5 pt-6 md:px-8">

        {/* ── Target Levels card ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card/60 p-5">
          {/* Servant identity */}
          <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-4">
              {servant.portrait && (
                <Image
                  src={servant.portrait}
                  alt={servant.servantName}
                  width={56}
                  height={56}
                  className="rounded-lg border border-border"
                />
              )}
              <div>
                <h2 className="text-base font-semibold text-foreground">Target Levels</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {servant.className}{" "}
                  <span className={getStarColorClass(servant.rarity)}>
                    {"★".repeat(servant.rarity)}
                  </span>
                </p>
              </div>
            </div>
            <div className="w-full sm:ml-auto sm:max-w-44">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Current QP
              </label>
              <input
                type="number"
                min={0}
                value={currentQpInput}
                onChange={(e) => handleCurrentQpChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
              />
            </div>
          </div>

          {/* Ascension + skills */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LevelSelect
              label="Ascension"
              value={servant.ascensionLevel}
              options={[1,2,3,4,5].map((v) => ({ value: v, label: v === 5 ? "Max" : String(v) }))}
              onChange={(v) => handleUpdateLevels(v, servant.skillLevels)}
            />
            {[0, 1, 2].map((i) => {
              const upgradeStatus = skillUpgradeStatusByIndex[i]
              const helperText = upgradeStatus ? getUpgradeHelperText(upgradeStatus) : undefined
              return (
                <LevelSelect
                  key={i}
                  label={`Skill ${i + 1}`}
                  value={servant.skillLevels[i]}
                  options={Array.from({ length: 10 }, (_, l) => ({ value: l + 1, label: String(l + 1) }))}
                  onChange={(v) => {
                    const next = [...servant.skillLevels] as SkillLevels
                    next[i] = v
                    handleUpdateLevels(servant.ascensionLevel, next)
                  }}
                  action={{
                    label: "upgrade",
                    onClick: () => handleUpgradeSkill(i),
                    disabled: !upgradeStatus?.canUpgrade,
                    title: helperText,
                    helperText,
                  }}
                />
              )
            })}
          </div>

          {/* Append skills */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => {
              const upgradeStatus = appendSkillUpgradeStatusByIndex[i]
              const helperText = upgradeStatus ? getUpgradeHelperText(upgradeStatus) : undefined
              return (
                <LevelSelect
                  key={i}
                  label={`Append Skill ${i + 1}`}
                  value={Math.max(1, servant.appendSkillLevels[i])}
                  options={Array.from({ length: 10 }, (_, l) => ({ value: l + 1, label: String(l + 1) }))}
                  onChange={(v) => {
                    const next = [...servant.appendSkillLevels] as SkillLevels
                    next[i] = v
                    handleUpdateAppendLevels(next)
                  }}
                  action={{
                    label: "upgrade",
                    onClick: () => handleUpgradeAppendSkill(i),
                    disabled: !upgradeStatus?.canUpgrade,
                    title: helperText,
                    helperText,
                  }}
                />
              )
            })}
          </div>
        </section>

        {/* ── Progress card ──────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Progress</h2>

          {/* Top-level tab row */}
          <TabBar
            tabs={PROGRESS_TABS.map((t) => ({ key: t.key, label: t.label }))}
            active={activeProgressTab}
            onChange={(k) => setActiveProgressTab(k as ProgressTab)}
          />

          {/* Sub-tab row for skills / append */}
          {(activeProgressTab === "skills" || activeProgressTab === "appendSkills") && (
            <div className="mt-3">
              <TabBar
                tabs={[0, 1, 2].map((i) => ({
                  key: String(i),
                  label: activeProgressTab === "skills" ? `Skill ${i + 1}` : `Append ${i + 1}`,
                }))}
                active={String(activeProgressTab === "skills" ? activeSkillTab : activeAppendSkillTab)}
                onChange={(k) =>
                  activeProgressTab === "skills"
                    ? setActiveSkillTab(Number(k))
                    : setActiveAppendSkillTab(Number(k))
                }
              />
            </div>
          )}

          {/* Stage rows */}
          <div className="mt-4 space-y-3">
            {activeRows.map((row) => (
              <StageProgressCard
                key={row.label}
                row={row}
                barColor={colors.bar}
                borderColor={colors.border}
                onOwnedChange={handleOwnedQuantityChange}
              />
            ))}
            {!activeRows.length && (
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            )}
          </div>
        </section>

        {/* ── Total materials needed card ───────────────────────────────── */}
        <section className="rounded-xl border border-border bg-card/60 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Total Materials Needed</h2>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span>QP: {formatNumber(totalRequirements.qp)}</span>
              <span>Progress: {totalRequirements.progressPercent.toFixed(1)}%</span>
            </div>
          </div>

          {totalRequirements.materialsWithOwned.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {totalRequirements.materialsWithOwned.map((material) => (
                <div
                  key={material.id}
                  className="rounded-lg border border-border bg-background/50 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src={material.icon}
                      alt={material.name}
                      width={24}
                      height={24}
                      className="rounded-sm"
                    />
                    <span className="truncate text-xs font-medium text-foreground/90">
                      {material.name}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>
                      Need <span className="text-foreground/80">{formatNumber(material.amount)}</span>
                    </span>
                    <span>·</span>
                    <span>
                      Remaining{" "}
                      <span className={material.remaining > 0 ? "text-red-400/70" : "text-emerald-400/70"}>
                        {formatNumber(material.remaining)}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No materials needed.</p>
          )}
        </section>
      </div>
    </main>
  )
}
