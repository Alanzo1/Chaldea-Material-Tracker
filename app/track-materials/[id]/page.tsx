"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Home, ListChecks } from "lucide-react"

import {
  readTrackedMaterialsState,
  setOwnedMaterialQuantity,
  updateTrackedServantLevels,
  type SkillLevels,
  type TrackedMaterial,
  type TrackedServantEntry,
  type TrackedMaterialsState,
} from "@/lib/material-tracker"
import { HeaderActionLink } from "@/components/HeaderActionLink"
import { PageHeader } from "@/components/PageHeader"

interface StageProgressRow {
  label: string
  qp: number
  materials: Array<TrackedMaterial & { owned: number; remaining: number }>
  progressPercent: number
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")

function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(Number.isFinite(value) ? value : 0)
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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
    <div className={`rounded-xl border ${borderColor} bg-white/[0.03] p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white/90">{row.label}</p>
        <div className="flex items-center gap-3 text-[11px] text-white/35">
          <span>QP: {formatNumber(row.qp)}</span>
          <span className="font-medium text-white/50">{row.progressPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
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
              className="rounded-lg border border-white/8 bg-black/20 p-2.5"
            >
              <div className="flex items-center gap-2">
                <Image
                  src={material.icon}
                  alt={material.name}
                  width={24}
                  height={24}
                  className="rounded-sm"
                />
                <span className="text-xs font-medium text-white/80 leading-tight">{material.name}</span>
              </div>

              <div className="mt-2 flex items-center gap-1 text-[10px] text-white/30">
                <span>Need <span className="text-white/50">{material.amount}</span></span>
                <span>·</span>
                <span>Remaining <span className={material.remaining > 0 ? "text-red-400/70" : "text-emerald-400/70"}>{material.remaining}</span></span>
              </div>

              <div className="mt-2">
                <input
                  type="number"
                  min={0}
                  value={material.owned}
                  onChange={(e) => onOwnedChange(material.id, e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80 placeholder:text-white/20 focus:border-white/20 focus:outline-none focus:ring-0"
                  placeholder="Owned"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/25">No materials for this stage.</p>
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
              ? "border-white/20 bg-white/10 text-white"
              : "border-white/8 bg-transparent text-white/35 hover:border-white/15 hover:text-white/60"
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
}: {
  label: string
  value: number
  options: { value: number; label: string }[]
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</p>
      <select
        className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white/80 focus:border-white/20 focus:outline-none"
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value, 1))}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0f0d12]">
            {opt.label}
          </option>
        ))}
      </select>
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

  useEffect(() => { setState(readTrackedMaterialsState()) }, [])
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
          <p className="text-sm text-white/30">Tracked servant not found.</p>
        </div>
      </main>
    )
  }

  // ─── Main ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background pb-16">

      {/* Ambient gradient */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-amber-950/10 via-transparent to-violet-950/10" />

      <PageHeader
        title={servant.servantName}
        subtitle={`${servant.className} · ${"★".repeat(servant.rarity)}`}
        actions={
          <>
            <HeaderActionLink href="/track-materials" icon={<ListChecks className="size-3.5" />} label="Tracker" />
            <HeaderActionLink href="/" icon={<Home className="size-3.5" />} label="Home" />
          </>
        }
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-5 pt-6 md:px-8">

        {/* ── Target Levels card ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
          {/* Servant identity */}
          <div className="flex items-center gap-4 border-b border-white/8 pb-4">
            {servant.portrait && (
              <Image
                src={servant.portrait}
                alt={servant.servantName}
                width={56}
                height={56}
                className="rounded-lg border border-white/10"
              />
            )}
            <div>
              <h2 className="text-base font-semibold text-white/90">Target Levels</h2>
              <p className="mt-0.5 text-xs text-white/40">
                {servant.className}{" "}
                <span className={getStarColorClass(servant.rarity)}>
                  {"★".repeat(servant.rarity)}
                </span>
              </p>
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
            {[0, 1, 2].map((i) => (
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
              />
            ))}
          </div>

          {/* Append skills */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <LevelSelect
                key={i}
                label={`Append Skill ${i + 1}`}
                value={servant.appendSkillLevels[i]}
                options={Array.from({ length: 11 }, (_, l) => ({ value: l, label: String(l) }))}
                onChange={(v) => {
                  const next = [...servant.appendSkillLevels] as SkillLevels
                  next[i] = v
                  handleUpdateAppendLevels(next)
                }}
              />
            ))}
          </div>
        </section>

        {/* ── Progress card ──────────────────────────────────────────────── */}
        <section className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white/70">Progress</h2>

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
              <p className="text-sm text-white/25">{emptyLabel}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
