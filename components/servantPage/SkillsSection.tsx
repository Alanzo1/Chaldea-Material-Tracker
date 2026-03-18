"use client"

import { useState } from "react"

import { NoblePhantasmCard } from "@/components/servantPage/NoblePhantasmCard"
import { MaterialsSection } from "@/components/servantPage/MaterialsSection"
import { SkillCard } from "@/components/servantPage/SkillCard"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface SkillLike {
  id?: number
  num?: number
  name?: string
  detail?: string
  icon?: string
  coolDown?: number[]
  condLimitCount?: number
  strengthStatus?: number
  functions?: any[]
}

interface AppendPassiveEntry {
  num?: number
  skill?: SkillLike
}

interface NoblePhantasmLike {
  id?: number
  num?: number
  name?: string
  rank?: string
  type?: string
  card?: string
  icon?: string
  detail?: string
  functions?: any[]
}

interface SkillsSectionProps {
  skills: SkillLike[]
  noblePhantasms: NoblePhantasmLike[]
  appendPassive: AppendPassiveEntry[]
  classPassive: SkillLike[]
  ascensionMaterials?: Record<string, any>
  skillMaterials?: Record<string, any>
  appendSkillMaterials?: Record<string, any>
  costumeMaterials?: Record<string, any>
}

function normalizeText(value?: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function stripValueFromDescription(value?: string) {
  const text = normalizeText(value)
  return text
    .replace(/\s+by\s+{{[^}]+}}%?/gi, "")
    .replace(/\s+at\s+{{[^}]+}}%?/gi, "")
    .replace(/\s+by\s+\d+(?:\.\d+)?%?/gi, "")
    .replace(/\s+at\s+\d+(?:\.\d+)?%?/gi, "")
    .replace(/\s+\[\{0\}\]/g, "")
    .trim()
}

function getUnlockText(skill: SkillLike, isPassive = false) {
  if (isPassive) return "Available from start"
  const ascension = Number(skill.condLimitCount ?? 0)
  if (!ascension) return "Available from start"
  return `Unlocks after ${ascension}${ordinalSuffix(ascension)} Ascension`
}

function ordinalSuffix(value: number) {
  const mod100 = value % 100
  if (mod100 >= 11 && mod100 <= 13) return "th"
  const mod10 = value % 10
  if (mod10 === 1) return "st"
  if (mod10 === 2) return "nd"
  if (mod10 === 3) return "rd"
  return "th"
}

function getFunctionLabel(func: any) {
  const popup = normalizeText(func?.funcPopupText)
  if (popup && popup.toLowerCase() !== "none") return popup

  const buffNames = (func?.buffs ?? [])
    .map((buff: any) => normalizeText(buff?.name))
    .filter(Boolean)

  if (buffNames.length === 1) return buffNames[0]
  if (buffNames.length > 1) return buffNames.join(" / ")

  const fallback: Record<string, string> = {
    damageNp: "NP damage",
    damageNpIndividual: "NP damage",
    damageNPPierce: "NP damage",
    gainHp: "Heal",
    gainNp: "NP Charge",
    gainStar: "Critical Stars",
    regainHp: "HP/Turn",
    regainNp: "NP/Turn",
    regainStar: "Stars/Turn",
    lossHpSafe: "HP Loss",
    instantDeath: "Death",
    subState: "Remove Debuff",
  }

  return fallback[String(func?.funcType ?? "")] ?? normalizeText(func?.funcType) ?? "Effect"
}

function getFunctionIcon(func: any) {
  const popupIcon = normalizeText(func?.funcPopupIcon)
  if (popupIcon) return popupIcon

  const buffIcon = normalizeText(func?.buffs?.[0]?.icon)
  if (buffIcon) return buffIcon

  return ""
}

function shouldFormatAsPercent(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes("%")) return true

  const flatValueKeywords = [
    "cooldown",
    "heal",
    "hp",
    "critical stars",
    "stars",
    "remove debuff",
    "death",
  ]

  if (flatValueKeywords.some((keyword) => normalized.includes(keyword))) {
    return false
  }

  const percentKeywords = [
    "up",
    "down",
    "strength",
    "resist",
    "rate",
    "attack",
    "buster",
    "arts",
    "quick",
    "def",
    "atk",
    "critical",
    "np",
    "damage",
  ]

  return percentKeywords.some((keyword) => normalized.includes(keyword))
}

function isNpGaugeLabel(label: string) {
  const normalized = label.toLowerCase()
  return (
    normalized.includes("np charge") ||
    (normalized.includes("np gain") && !normalized.includes("np gain up")) ||
    normalized.includes("np loss") ||
    normalized.includes("charge loss") ||
    normalized.includes("np/turn") ||
    normalized.includes("np regen")
  )
}

function formatPercentValue(value: number, divisor: number) {
  const percent = value / divisor
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`
}

function formatLevelValue(label: string, value: unknown) {
  if (typeof value !== "number") return "—"
  if (!shouldFormatAsPercent(label)) return String(value)
  if (label.trim().toLowerCase() === "np gain") {
    return formatPercentValue(value, 100)
  }
  const divisor = isNpGaugeLabel(label) ? 100 : 10
  return formatPercentValue(value, divisor)
}

function shouldHideLevelRow(label: string) {
  const normalized = label.toLowerCase()
  return (
    normalized.includes("bonus effect with") ||
    normalized === "charge gain" ||
    normalized.includes("charge loss")
  )
}

function shouldHideSkillLevelRow(label: string) {
  const normalized = label.toLowerCase()
  return shouldHideLevelRow(label) || normalized.includes("overcharge")
}

function isDemeritStateFunction(func: any, label: string) {
  const normalizedLabel = label.toLowerCase()
  if (normalizedLabel.includes("staying up late")) return true

  const popupText = normalizeText(func?.funcPopupText).toLowerCase()
  if (popupText.includes("demerit")) return true

  const buffList = Array.isArray(func?.buffs) ? func.buffs : []
  return buffList.some((buff: any) => {
    const buffName = normalizeText(buff?.name).toLowerCase()
    const buffDetail = normalizeText(buff?.detail).toLowerCase()
    const buffVals = Array.isArray(buff?.vals) ? buff.vals : []

    const hasNegativeEffectFlag = buffVals.some((value: any) =>
      Number(value?.id) === 3005 || normalizeText(value?.name).toLowerCase() === "buffnegativeeffect"
    )

    return (
      hasNegativeEffectFlag ||
      buffName.includes("demerit") ||
      buffDetail.includes("demerit") ||
      buffDetail.includes("stun is applied after")
    )
  })
}

function getLevels(skill: SkillLike) {
  const cooldownLevels = Array.isArray(skill.coolDown)
    ? skill.coolDown.filter((value) => typeof value === "number")
    : []

  const levelCount = Math.max(
    cooldownLevels.length,
    ...(skill.functions ?? []).map((func: any) => (func?.svals ?? []).length),
    0
  )

  return Array.from({ length: levelCount }, (_, index) => String(index + 1))
}

function getRows(skill: SkillLike) {
  const levels = getLevels(skill)
  if (!levels.length) return { levels: [], rows: [] as { label: string; values: string[] }[] }

  const rows: { label: string; values: string[]; icon?: string }[] = []

  const cooldown = Array.isArray(skill.coolDown)
    ? skill.coolDown.slice(0, levels.length).map((value) => String(value))
    : []

  if (cooldown.some((value) => value !== "0")) {
    rows.push({
      label: "Cooldown",
      values: levels.map((_, index) => cooldown[index] ?? "—"),
    })
  }

  ;(skill.functions ?? []).forEach((func: any, funcIndex: number) => {
    const label = getFunctionLabel(func) || `Effect ${funcIndex + 1}`
    if (shouldHideSkillLevelRow(label)) return
    if (isDemeritStateFunction(func, label)) return
    const values = levels.map((_, index) => {
      const value = func?.svals?.[index]?.Value
      return formatLevelValue(label, value)
    })

    if (values.every((value) => value === "—")) return

    rows.push({ label, values, icon: getFunctionIcon(func) || undefined })
  })

  return { levels, rows }
}

function splitNameAndRank(value?: string) {
  const fullName = normalizeText(value)
  const match = fullName.match(/^(.*?)(?:\s+([A-E](?:\+{1,3})?|EX))$/i)

  if (!match) {
    return {
      name: fullName,
      rank: "",
    }
  }

  return {
    name: normalizeText(match[1]),
    rank: match[2].toUpperCase(),
  }
}

function getNPEffectValue(entry: any) {
  if (typeof entry?.Value === "number") return entry.Value
  if (typeof entry?.Rate === "number") return entry.Rate
  if (typeof entry?.Correction === "number") return entry.Correction
  if (typeof entry?.AddCount === "number") return entry.AddCount
  if (typeof entry?.RateCount === "number") return entry.RateCount
  return null
}

function formatNPEffectLabel(label: string) {
  const normalized = label.toLowerCase()
  if (normalized === "damagenp") return "NP damage"
  if (normalized === "damagenppierce") return "NP damage"
  if (normalized === "np charge" || normalized === "np gain") return "NP Gain"
  if (normalized === "heal") return "Heal Amount"
  return label
}

function hasDistinctValues(values: string[]) {
  const nonEmpty = values.filter((value) => value !== "—")
  return new Set(nonEmpty).size > 1
}

function getNPTableData(np: NoblePhantasmLike) {
  const levelRows: { label: string; values: string[]; icon?: string }[] = []
  const overchargeRows: { label: string; values: string[]; icon?: string }[] = []

  ;(np.functions ?? []).forEach((func: any, index: number) => {
    const rawLabel = getFunctionLabel(func) || `Effect ${index + 1}`
    if (shouldHideLevelRow(rawLabel)) return
    if (isDemeritStateFunction(func, rawLabel)) return

    const label = formatNPEffectLabel(rawLabel)
    const icon = getFunctionIcon(func) || undefined
    const levelValues = Array.from({ length: 5 }, (_, valueIndex) => {
      const value = getNPEffectValue(func?.svals?.[valueIndex])
      return formatLevelValue(label, value)
    })

    const hasLevelData = levelValues.some((value) => value !== "—")
    const ocArrays = [func?.svals, func?.svals2, func?.svals3, func?.svals4, func?.svals5]
    const ocEntries = ocArrays.map((values: any) => values?.[0] ?? null)

    const correctionOverchargeValues = ocEntries.map((entry: any) =>
      formatLevelValue("Special Attack", entry?.Correction)
    )
    const hasDistinctCorrectionOvercharge = hasDistinctValues(correctionOverchargeValues)

    const overchargeLabel = hasDistinctCorrectionOvercharge
      ? "Special attack damage +"
      : label

    const overchargeValues = hasDistinctCorrectionOvercharge
      ? correctionOverchargeValues
      : ocEntries.map((entry: any) => {
          const value = getNPEffectValue(entry)
          return formatLevelValue(overchargeLabel, value)
        })
    const hasOverchargeData = overchargeValues.some((value) => value !== "—")
    const hasDistinctOvercharge = hasDistinctValues(overchargeValues)

    if (hasDistinctOvercharge && hasOverchargeData) {
      overchargeRows.push({
        label: overchargeLabel,
        values: overchargeValues,
        icon,
      })
    }

    if (hasLevelData && (!hasDistinctOvercharge || hasDistinctValues(levelValues))) {
      levelRows.push({
        label,
        values: levelValues,
        icon,
      })
    }
  })

  return {
    levelRows,
    overchargeRows,
  }
}

function normalizeNPDescription(value?: string) {
  return normalizeText(value).replace(/\s+\[\{0\}\]/g, "")
}

function getNPDescriptions(np: NoblePhantasmLike) {
  const detail = normalizeNPDescription(np.detail)
  const match = detail.match(/<([^>]*overcharge[^>]*)>/i)

  if (!match) {
    return {
      baseDescription: detail,
      overchargeDescription: "",
    }
  }

  return {
    baseDescription: detail.replace(match[0], "").replace(/\s{2,}/g, " ").trim(),
    overchargeDescription: match[1].trim(),
  }
}

function SkillGroup({
  title,
  skills,
  isPassive = false,
  stripValues = false,
}: {
  title?: string
  skills: SkillLike[]
  isPassive?: boolean
  stripValues?: boolean
}) {
  if (!skills.length) return null

  return (
    <div className="space-y-4">
      {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
      <div className="grid gap-4">
        {skills.map((skill) => {
          const { levels, rows } = getRows(skill)
          const titleParts = splitNameAndRank(skill.name)

          return (
            <SkillCard
              key={skill.id ?? `${title}-${skill.name}`}
              icon={skill.icon}
              name={titleParts.name}
              rank={titleParts.rank}
              description={
                stripValues
                  ? stripValueFromDescription(skill.detail)
                  : normalizeText(skill.detail)
              }
              unlockText={getUnlockText(skill, isPassive)}
              rows={isPassive ? [] : rows}
              levels={isPassive ? [] : levels}
            />
          )
        })}
      </div>
    </div>
  )
}

function getVariantLabel(index: number) {
  if (index === 0) return "Base"
  if (index === 1) return "Upgrade"
  return `Upgrade ${index}`
}

function SkillVariantTabs({ skills }: { skills: SkillLike[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeSkill = skills[activeIndex] ?? skills[0]
  const { levels, rows } = getRows(activeSkill)
  const titleParts = splitNameAndRank(activeSkill.name)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {skills.map((skill, index) => (
          <Button
            key={skill.id ?? `${skill.name}-${index}`}
            type="button"
            size="sm"
            variant={index === activeIndex ? "default" : "outline"}
            onClick={() => setActiveIndex(index)}
          >
            {getVariantLabel(index)}
          </Button>
        ))}
      </div>
      <SkillCard
        icon={activeSkill.icon}
        name={titleParts.name}
        rank={titleParts.rank}
        description={normalizeText(activeSkill.detail)}
        unlockText={getUnlockText(activeSkill)}
        rows={rows}
        levels={levels}
      />
    </div>
  )
}

function groupActiveSkills(skills: SkillLike[]) {
  const grouped = new Map<string, SkillLike[]>()

  skills.forEach((skill, index) => {
    const key = String(skill.num ?? `skill-${index}`)
    const current = grouped.get(key) ?? []
    current.push(skill)
    grouped.set(key, current)
  })

  return [...grouped.values()]
}

function groupNoblePhantasms(noblePhantasms: NoblePhantasmLike[]) {
  const grouped = new Map<string, NoblePhantasmLike[]>()

  noblePhantasms.forEach((np, index) => {
    const key = String(np.num ?? `np-${index}`)
    const current = grouped.get(key) ?? []
    current.push(np)
    grouped.set(key, current)
  })

  return [...grouped.values()]
}

function NPVariantTabs({ noblePhantasms }: { noblePhantasms: NoblePhantasmLike[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeNP = noblePhantasms[activeIndex] ?? noblePhantasms[0]
  const titleParts = splitNameAndRank(activeNP.name)
  const { baseDescription, overchargeDescription } = getNPDescriptions(activeNP)
  const { levelRows, overchargeRows } = getNPTableData(activeNP)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {noblePhantasms.map((np, index) => (
          <Button
            key={np.id ?? `${np.name}-${index}`}
            type="button"
            size="sm"
            variant={index === activeIndex ? "default" : "outline"}
            onClick={() => setActiveIndex(index)}
          >
            {getVariantLabel(index)}
          </Button>
        ))}
      </div>
      <NoblePhantasmCard
        nameImage={activeNP.icon}
        name={titleParts.name}
        rank={titleParts.rank || activeNP.rank}
        card={activeNP.card}
        npType={activeNP.type}
        baseDescription={baseDescription}
        overchargeDescription={overchargeDescription}
        levelRows={levelRows}
        overchargeRows={overchargeRows}
      />
    </div>
  )
}

export function SkillsSection({
  skills,
  noblePhantasms,
  appendPassive,
  classPassive,
  ascensionMaterials,
  skillMaterials,
  appendSkillMaterials,
  costumeMaterials,
}: SkillsSectionProps) {
  const appendSkills = appendPassive
    .map((entry) => entry.skill)
    .filter(Boolean) as SkillLike[]
  const activeSkillGroups = groupActiveSkills(skills)
  const noblePhantasmGroups = groupNoblePhantasms(noblePhantasms)
  const activeSkillCount = Math.max(activeSkillGroups.length, 1)
  const appendSkillCount = Math.max(appendSkills.length, 1)
  const hasMaterials =
    Object.keys(ascensionMaterials ?? {}).length > 0 ||
    Object.keys(skillMaterials ?? {}).length > 0 ||
    Object.keys(appendSkillMaterials ?? {}).length > 0 ||
    Object.keys(costumeMaterials ?? {}).length > 0

  if (
    !activeSkillGroups.length &&
    !noblePhantasmGroups.length &&
    !appendSkills.length &&
    !classPassive.length &&
    !hasMaterials
  ) {
    return null
  }

  return (
    <div className="space-y-6">
      {activeSkillGroups.length ? (
        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-lg">Active Skills</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="grid gap-4">
              {activeSkillGroups.map((skillGroup, index) =>
                skillGroup.length > 1 ? (
                  <SkillVariantTabs
                    key={`active-skill-group-${index}`}
                    skills={skillGroup}
                  />
                ) : (
                  <SkillGroup
                    key={`active-skill-single-${index}`}
                    skills={skillGroup}
                  />
                )
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {noblePhantasmGroups.length ? (
        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-lg">Noble Phantasm</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="grid gap-4">
              {noblePhantasmGroups.map((npGroup, index) =>
                npGroup.length > 1 ? (
                  <NPVariantTabs
                    key={`np-group-${index}`}
                    noblePhantasms={npGroup}
                  />
                ) : (
                  (() => {
                    const np = npGroup[0]
                    const titleParts = splitNameAndRank(np.name)
                    const { baseDescription, overchargeDescription } = getNPDescriptions(np)
                    const { levelRows, overchargeRows } = getNPTableData(np)

                    return (
                      <NoblePhantasmCard
                        key={`np-single-${index}`}
                        nameImage={np.icon}
                        name={titleParts.name}
                        rank={titleParts.rank || np.rank}
                        card={np.card}
                        npType={np.type}
                        baseDescription={baseDescription}
                        overchargeDescription={overchargeDescription}
                        levelRows={levelRows}
                        overchargeRows={overchargeRows}
                      />
                    )
                  })()
                )
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {appendSkills.length ? (
        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-lg">Append Skills</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <SkillGroup skills={appendSkills} stripValues />
          </CardContent>
        </Card>
      ) : null}
      {classPassive.length ? (
        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-lg">Class Skills</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <SkillGroup skills={classPassive} isPassive />
          </CardContent>
        </Card>
      ) : null}
      {hasMaterials ? (
        <MaterialsSection
          ascensionMaterials={ascensionMaterials}
          skillMaterials={skillMaterials}
          appendSkillMaterials={appendSkillMaterials}
          costumeMaterials={costumeMaterials}
          skillMultiplier={activeSkillCount}
          appendSkillMultiplier={appendSkillCount}
        />
      ) : null}
    </div>
  )
}
