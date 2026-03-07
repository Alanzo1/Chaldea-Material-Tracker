"use client"

import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useState } from "react"
import { usePathname } from "next/navigation"

interface MaterialItemLike {
  amount?: number
  item?: {
    id?: number
    name?: string
    icon?: string
    detail?: string
  }
}

interface MaterialStageLike {
  qp?: number
  items?: MaterialItemLike[]
}

type MaterialStageMap = Record<string, MaterialStageLike | undefined>

interface MaterialRow {
  stage: string
  qp: number
  materials: {
    key: string
    id?: number
    name: string
    icon: string
    detail?: string
    amount: number
  }[]
}

interface MaterialTableProps {
  rows: MaterialRow[]
}

interface MaterialsSectionProps {
  ascensionMaterials?: MaterialStageMap
  skillMaterials?: MaterialStageMap
  appendSkillMaterials?: MaterialStageMap
  costumeMaterials?: MaterialStageMap
  skillMultiplier?: number
  appendSkillMultiplier?: number
}

function sortStageKeys(a: string, b: string) {
  const numberA = Number(a)
  const numberB = Number(b)

  if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
    return numberA - numberB
  }

  return a.localeCompare(b)
}

function parseMaterialRows(
  materialMap: MaterialStageMap | undefined,
  getStageLabel: (stageKey: string) => string
) {
  if (!materialMap) return [] as MaterialRow[]

  return Object.entries(materialMap)
    .sort(([a], [b]) => sortStageKeys(a, b))
    .map(([stageKey, stage]) => {
      const materials = (stage?.items ?? [])
        .map((entry, index) => {
          const id = Number(entry.item?.id ?? 0)
          const name = String(entry.item?.name ?? "")
          const icon = String(entry.item?.icon ?? "")
          const detail = String(entry.item?.detail ?? "")
          const amount = Number(entry.amount ?? 0)

          if (!name || !icon || amount <= 0) return null

          return {
            key: `${entry.item?.id ?? name}-${index}`,
            id: Number.isFinite(id) && id > 0 ? id : undefined,
            name,
            icon,
            detail: detail || undefined,
            amount,
          }
        })
        .filter(Boolean) as MaterialRow["materials"]

      return {
        stage: getStageLabel(stageKey),
        qp: Number(stage?.qp ?? 0),
        materials,
      }
    })
    .filter((row) => row.qp > 0 || row.materials.length > 0)
}

interface MaterialTotals {
  qp: number
  materials: Map<
    string,
    {
      key: string
      id?: number
      name: string
      icon: string
      detail?: string
      amount: number
    }
  >
}

function createEmptyTotals(): MaterialTotals {
  return {
    qp: 0,
    materials: new Map(),
  }
}

function addStageMapToTotals(
  target: MaterialTotals,
  materialMap: MaterialStageMap | undefined,
  multiplier = 1
) {
  if (!materialMap || multiplier <= 0) return target

  Object.values(materialMap).forEach((stage) => {
    target.qp += Number(stage?.qp ?? 0) * multiplier

    ;(stage?.items ?? []).forEach((entry, index) => {
      const id = String(entry.item?.id ?? "")
      const numericId = Number(entry.item?.id ?? 0)
      const name = String(entry.item?.name ?? "")
      const icon = String(entry.item?.icon ?? "")
      const detail = String(entry.item?.detail ?? "")
      const amount = Number(entry.amount ?? 0) * multiplier

      if (!name || !icon || amount <= 0) return

      const key = id || `${name}-${index}`
      const existing = target.materials.get(key)

      if (!existing) {
        target.materials.set(key, {
          key,
          id: Number.isFinite(numericId) && numericId > 0 ? numericId : undefined,
          name,
          icon,
          detail: detail || undefined,
          amount,
        })
        return
      }

      existing.amount += amount
    })
  })

  return target
}

function mergeTotals(base: MaterialTotals, addition: MaterialTotals) {
  const merged = createEmptyTotals()
  merged.qp = base.qp + addition.qp

  base.materials.forEach((value, key) => {
    merged.materials.set(key, { ...value })
  })

  addition.materials.forEach((value, key) => {
    const existing = merged.materials.get(key)
    if (!existing) {
      merged.materials.set(key, { ...value })
      return
    }
    existing.amount += value.amount
  })

  return merged
}

function toSortedMaterialArray(totals: MaterialTotals) {
  return [...totals.materials.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function getLevelUpgradeLabel(stageKey: string) {
  const level = Number(stageKey)
  if (!Number.isFinite(level)) return stageKey
  return `Lv ${level} -> ${level + 1}`
}

function getAscensionStageLabel(stageKey: string) {
  const stage = Number(stageKey)
  if (!Number.isFinite(stage)) return stageKey
  return `Ascension ${stage + 1}`
}

function getCostumeStageLabel(stageKey: string) {
  return `Costume ${stageKey}`
}

function normalizeMaterialDetail(detail?: string) {
  if (!detail) return ""
  return detail.replace(/["\r\n]+/g, " ").replace(/\s+/g, " ").trim()
}

function getMaterialHref(
  material: { id?: number; name: string; icon: string; detail?: string },
  returnTo?: string
) {
  if (!material.id) return null
  const nameParam = encodeURIComponent(material.name)
  const iconParam = encodeURIComponent(material.icon)
  const detail = normalizeMaterialDetail(material.detail)
  const detailParam = detail ? `&detail=${encodeURIComponent(detail)}` : ""
  const returnToParam = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""
  return `/material/${material.id}?name=${nameParam}&icon=${iconParam}${detailParam}${returnToParam}`
}

function MaterialTable({ rows }: MaterialTableProps) {
  const pathname = usePathname()

  if (!rows.length) return null

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Stage</TableHead>
          <TableHead>QP Cost</TableHead>
          <TableHead>Materials</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.stage}>
            <TableCell className="font-medium">{row.stage}</TableCell>
            <TableCell>{row.qp.toLocaleString()}</TableCell>
            <TableCell>
              {row.materials.length ? (
                <div className="flex flex-wrap gap-3">
                  {row.materials.map((material) => {
                    const href = getMaterialHref(material, pathname)

                    if (!href) {
                      return (
                        <div
                          key={material.key}
                          className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
                          title={`${material.name} x ${material.amount}`}
                        >
                          <Image
                            src={material.icon}
                            alt={material.name}
                            width={54}
                            height={54}
                            className="rounded-sm"
                          />
                          <span>{material.amount.toLocaleString()}</span>
                        </div>
                      )
                    }

                    return (
                      <Button
                        key={material.key}
                        asChild
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-auto gap-2 px-2 py-1"
                        title={`${material.name} x ${material.amount}`}
                      >
                        <Link href={href}>
                          <Image
                            src={material.icon}
                            alt={material.name}
                            width={54}
                            height={54}
                            className="rounded-sm"
                          />
                          <span>{material.amount.toLocaleString()}</span>
                        </Link>
                      </Button>
                    )
                  })}
                </div>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function MaterialsSection({
  ascensionMaterials,
  skillMaterials,
  appendSkillMaterials,
  costumeMaterials,
  skillMultiplier = 3,
  appendSkillMultiplier = 3,
}: MaterialsSectionProps) {
  const pathname = usePathname()

  const tabs = [
    {
      id: "ascension",
      label: "Ascension",
      rows: parseMaterialRows(ascensionMaterials, getAscensionStageLabel),
    },
    {
      id: "skill",
      label: "Skill Enhancement",
      rows: parseMaterialRows(skillMaterials, getLevelUpgradeLabel),
    },
    {
      id: "append",
      label: "Append Skill",
      rows: parseMaterialRows(appendSkillMaterials, getLevelUpgradeLabel),
    },
    {
      id: "costume",
      label: "Costume",
      rows: parseMaterialRows(costumeMaterials, getCostumeStageLabel),
    },
  ].filter((tab) => tab.rows.length > 0)

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "ascension")

  if (!tabs.length) return null

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const ascensionTotals = addStageMapToTotals(createEmptyTotals(), ascensionMaterials, 1)
  const skillTotals = addStageMapToTotals(createEmptyTotals(), skillMaterials, skillMultiplier)
  const appendTotals = addStageMapToTotals(
    createEmptyTotals(),
    appendSkillMaterials,
    appendSkillMultiplier
  )
  const ascensionSkillTotals = mergeTotals(ascensionTotals, skillTotals)
  const totalTotals = mergeTotals(ascensionSkillTotals, appendTotals)
  const summaryRows: { label: string; totals: MaterialTotals }[] = [
    { label: "Ascension", totals: ascensionTotals },
    { label: "Skill", totals: skillTotals },
    { label: "Append Skill", totals: appendTotals },
    { label: "Ascension+Skill", totals: ascensionSkillTotals },
    { label: "Total", totals: totalTotals },
  ]

  return (
    <div className="space-y-6">
      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-lg">Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={activeTab.id === tab.id ? "default" : "outline"}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <MaterialTable rows={activeTab.rows} />
        </CardContent>
      </Card>
      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-lg">Materials Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Total Materials + QP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.map((row) => {
                const materials = toSortedMaterialArray(row.totals)
                return (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="space-y-3">
                      <p className="font-medium">QP: {row.totals.qp.toLocaleString()}</p>
                      {materials.length ? (
                        <div className="flex flex-wrap gap-3">
                          {materials.map((material) => {
                            const href = getMaterialHref(material, pathname)

                            if (!href) {
                              return (
                                <div
                                  key={`${row.label}-${material.key}`}
                                  className="inline-flex items-center gap-2 rounded-md border px-2 py-1"
                                  title={`${material.name} x ${material.amount}`}
                                >
                                  <Image
                                    src={material.icon}
                                    alt={material.name}
                                    width={54}
                                    height={54}
                                    className="rounded-sm"
                                  />
                                  <span>{material.amount.toLocaleString()}</span>
                                </div>
                              )
                            }

                            return (
                              <Button
                                key={`${row.label}-${material.key}`}
                                asChild
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-auto gap-2 px-2 py-1"
                                title={`${material.name} x ${material.amount}`}
                              >
                                <Link href={href}>
                                  <Image
                                    src={material.icon}
                                    alt={material.name}
                                    width={54}
                                    height={54}
                                    className="rounded-sm"
                                  />
                                  <span>{material.amount.toLocaleString()}</span>
                                </Link>
                              </Button>
                            )
                          })}
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
