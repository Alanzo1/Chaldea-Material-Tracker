"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"

import {
  readTrackedMaterialsState,
  updateTrackedServantLevels,
  type SkillLevels,
  type TrackedMaterial,
  type TrackedServantEntry,
  type TrackedMaterialsState,
} from "@/lib/material-tracker"
import { Button } from "@/components/ui/button"

interface StageProgressRow {
  label: string
  qp: number
  materials: Array<TrackedMaterial & { owned: number; remaining: number }>
  progressPercent: number
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getStarColorClass(rarity: number) {
  if (rarity <= 2) return "text-amber-700"
  if (rarity === 3) return "text-slate-400"
  return "text-yellow-500"
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

export default function TrackedServantDetailPage() {
  const params = useParams<{ id: string }>()
  const servantId = toNumber(params?.id, 0)

  const [state, setState] = useState<TrackedMaterialsState>({
    version: 1,
    servants: [],
    ownedByMaterialId: {},
  })
  const [activeProgressTab, setActiveProgressTab] = useState<"ascension" | "skills" | "appendSkills">("ascension")
  const [activeSkillTab, setActiveSkillTab] = useState(0)
  const [activeAppendSkillTab, setActiveAppendSkillTab] = useState(0)

  useEffect(() => {
    setState(readTrackedMaterialsState())
  }, [])

  useEffect(() => {
    setActiveSkillTab(0)
    setActiveAppendSkillTab(0)
  }, [servantId])

  const servant = useMemo(
    () => state.servants.find((entry) => entry.servantId === servantId) ?? null,
    [servantId, state.servants]
  )

  const ascensionRows = useMemo(() => {
    if (!servant) return []
    return buildStageProgressRows(
      servant.ascensionMaterials,
      (stageNumber) => (stageNumber >= Math.max(0, servant.ascensionLevel - 1) ? 1 : 0),
      (stageNumber) => `Ascension ${stageNumber + 1}`,
      state.ownedByMaterialId
    )
  }, [servant, state.ownedByMaterialId])

  const skillRowsBySkill = useMemo(() => {
    if (!servant) return [[], [], []] as StageProgressRow[][]

    return [0, 1, 2].map((skillIndex) =>
      buildStageProgressRows(
        servant.skillMaterials,
        (stageNumber) => (stageNumber >= Math.max(1, servant.skillLevels[skillIndex]) ? 1 : 0),
        (stageNumber) => `Skill Lv ${stageNumber} → ${stageNumber + 1}`,
        state.ownedByMaterialId
      )
    )
  }, [servant, state.ownedByMaterialId])

  const activeSkillRows = skillRowsBySkill[activeSkillTab] ?? []

  const appendSkillRowsBySkill = useMemo(() => {
    if (!servant) return [[], [], []] as StageProgressRow[][]

    return [0, 1, 2].map((skillIndex) =>
      buildStageProgressRows(
        servant.appendSkillMaterials,
        (stageNumber) =>
          stageNumber >= Math.max(1, servant.appendSkillLevels[skillIndex]) ? 1 : 0,
        (stageNumber) => `Append Skill Lv ${stageNumber} → ${stageNumber + 1}`,
        state.ownedByMaterialId
      )
    )
  }, [servant, state.ownedByMaterialId])

  const activeAppendSkillRows = appendSkillRowsBySkill[activeAppendSkillTab] ?? []

  const handleUpdateLevels = (nextAscension: number, nextSkills: SkillLevels) => {
    if (!servant) return
    const nextState = updateTrackedServantLevels({
      servantId: servant.servantId,
      ascensionLevel: nextAscension,
      skillLevels: nextSkills,
      appendSkillLevels: servant.appendSkillLevels,
    })
    setState(nextState)
  }

  const handleUpdateAppendLevels = (nextAppendSkills: SkillLevels) => {
    if (!servant) return
    const nextState = updateTrackedServantLevels({
      servantId: servant.servantId,
      ascensionLevel: servant.ascensionLevel,
      skillLevels: servant.skillLevels,
      appendSkillLevels: nextAppendSkills,
    })
    setState(nextState)
  }

  if (!servant) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <Button asChild variant="outline">
          <Link href="/track-materials">Back to Tracker</Link>
        </Button>
        <p className="text-sm text-muted-foreground">Tracked servant not found.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <Button asChild variant="outline">
          <Link href="/track-materials">Back to Tracker</Link>
        </Button>
      </div>

      <section className="rounded-md border p-4">
        <div className="flex items-center gap-3">
          {servant.portrait ? (
            <Image
              src={servant.portrait}
              alt={servant.servantName}
              width={64}
              height={64}
              className="rounded-md"
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold">{servant.servantName}</h1>
            <p className="text-sm text-muted-foreground">
              {servant.className} ·{" "}
              <span className={getStarColorClass(servant.rarity)}>
                {"★".repeat(servant.rarity)}
              </span>
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Ascension Lv</p>
            <select
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={servant.ascensionLevel}
              onChange={(event) =>
                handleUpdateLevels(toNumber(event.target.value, 1), servant.skillLevels)
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>Max</option>
            </select>
          </div>
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-1">
              <p className="text-sm font-medium">Skill {index + 1} Lv</p>
              <select
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={servant.skillLevels[index]}
                onChange={(event) => {
                  const nextLevels = [...servant.skillLevels] as SkillLevels
                  nextLevels[index] = toNumber(event.target.value, 1)
                  handleUpdateLevels(servant.ascensionLevel, nextLevels)
                }}
              >
                {Array.from({ length: 10 }, (_, level) => level + 1).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={`append-${index}`} className="space-y-1">
              <p className="text-sm font-medium">Append Skill {index + 1} Lv</p>
              <select
                className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={servant.appendSkillLevels[index]}
                onChange={(event) => {
                  const nextLevels = [...servant.appendSkillLevels] as SkillLevels
                  nextLevels[index] = toNumber(event.target.value, 0)
                  handleUpdateAppendLevels(nextLevels)
                }}
              >
                {Array.from({ length: 11 }, (_, level) => level).map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-lg font-semibold">Progress</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-md border px-3 py-1 text-sm ${
              activeProgressTab === "ascension"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                : "border-border bg-background text-muted-foreground"
            }`}
            onClick={() => setActiveProgressTab("ascension")}
          >
            Ascension
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1 text-sm ${
              activeProgressTab === "skills"
                ? "border-sky-500 bg-sky-500/10 text-sky-600"
                : "border-border bg-background text-muted-foreground"
            }`}
            onClick={() => setActiveProgressTab("skills")}
          >
            Skills
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1 text-sm ${
              activeProgressTab === "appendSkills"
                ? "border-violet-500 bg-violet-500/10 text-violet-600"
                : "border-border bg-background text-muted-foreground"
            }`}
            onClick={() => setActiveProgressTab("appendSkills")}
          >
            Append Skills
          </button>
        </div>

        {activeProgressTab === "ascension" ? (
          <div className="mt-3 space-y-3">
            {ascensionRows.map((row) => (
              <div key={row.label} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">
                    QP: {row.qp.toLocaleString()} · Progress: {row.progressPercent.toFixed(1)}%
                  </p>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${row.progressPercent}%` }} />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {row.materials.map((material) => (
                    <div key={`${row.label}-${material.id}`} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Image
                          src={material.icon}
                          alt={material.name}
                          width={20}
                          height={20}
                          className="rounded-sm"
                        />
                        <span>{material.name}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        Need {material.amount} · Owned {material.owned} · Remaining {material.remaining}
                      </p>
                    </div>
                  ))}
                  {!row.materials.length ? (
                    <p className="text-xs text-muted-foreground">No materials for this stage.</p>
                  ) : null}
                </div>
              </div>
            ))}
            {!ascensionRows.length ? (
              <p className="text-sm text-muted-foreground">No ascension materials selected.</p>
            ) : null}
          </div>
        ) : activeProgressTab === "skills" ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2].map((skillIndex) => (
                <button
                  key={`skill-tab-${skillIndex + 1}`}
                  type="button"
                  className={`rounded-md border px-3 py-1 text-sm ${
                    activeSkillTab === skillIndex
                      ? "border-sky-500 bg-sky-500/10 text-sky-600"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                  onClick={() => setActiveSkillTab(skillIndex)}
                >
                  Skill {skillIndex + 1}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              {activeSkillRows.map((row) => (
                <div key={row.label} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      QP: {row.qp.toLocaleString()} · Progress: {row.progressPercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                    <div className="h-full bg-sky-500" style={{ width: `${row.progressPercent}%` }} />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {row.materials.map((material) => (
                      <div key={`${row.label}-${material.id}`} className="rounded-md border p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Image
                            src={material.icon}
                            alt={material.name}
                            width={20}
                            height={20}
                            className="rounded-sm"
                          />
                          <span>{material.name}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          Need {material.amount} · Owned {material.owned} · Remaining {material.remaining}
                        </p>
                      </div>
                    ))}
                    {!row.materials.length ? (
                      <p className="text-xs text-muted-foreground">No materials for this stage.</p>
                    ) : null}
                  </div>
                </div>
              ))}
              {!activeSkillRows.length ? (
                <p className="text-sm text-muted-foreground">No skill materials selected.</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2].map((skillIndex) => (
                <button
                  key={`append-skill-tab-${skillIndex + 1}`}
                  type="button"
                  className={`rounded-md border px-3 py-1 text-sm ${
                    activeAppendSkillTab === skillIndex
                      ? "border-violet-500 bg-violet-500/10 text-violet-600"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                  onClick={() => setActiveAppendSkillTab(skillIndex)}
                >
                  Append {skillIndex + 1}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              {activeAppendSkillRows.map((row) => (
                <div key={row.label} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      QP: {row.qp.toLocaleString()} · Progress: {row.progressPercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                    <div className="h-full bg-violet-500" style={{ width: `${row.progressPercent}%` }} />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {row.materials.map((material) => (
                      <div key={`${row.label}-${material.id}`} className="rounded-md border p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Image
                            src={material.icon}
                            alt={material.name}
                            width={20}
                            height={20}
                            className="rounded-sm"
                          />
                          <span>{material.name}</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          Need {material.amount} · Owned {material.owned} · Remaining {material.remaining}
                        </p>
                      </div>
                    ))}
                    {!row.materials.length ? (
                      <p className="text-xs text-muted-foreground">No materials for this stage.</p>
                    ) : null}
                  </div>
                </div>
              ))}
              {!activeAppendSkillRows.length ? (
                <p className="text-sm text-muted-foreground">No append skill materials selected.</p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
