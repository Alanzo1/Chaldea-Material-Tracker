"use client"

import { useState } from "react"

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

interface SkillsSectionProps {
  skills: SkillLike[]
  appendPassive: AppendPassiveEntry[]
  classPassive: SkillLike[]
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

function shouldFormatAsPercent(label: string) {
  const normalized = label.toLowerCase()

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
    "buster",
    "arts",
    "quick",
    "def",
    "atk",
    "critical",
    "np",
  ]

  return percentKeywords.some((keyword) => normalized.includes(keyword))
}

function isNpGaugeLabel(label: string) {
  const normalized = label.toLowerCase()
  return (
    normalized.includes("np charge") ||
    (normalized.includes("np gain") && !normalized.includes("np gain up")) ||
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
  const divisor = isNpGaugeLabel(label) ? 100 : 10
  return formatPercentValue(value, divisor)
}

function shouldHideLevelRow(label: string) {
  const normalized = label.toLowerCase()
  return normalized.includes("bonus effect with")
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

  const rows: { label: string; values: string[] }[] = []

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
    if (shouldHideLevelRow(label)) return
    const values = levels.map((_, index) => {
      const value = func?.svals?.[index]?.Value
      return formatLevelValue(label, value)
    })

    if (values.every((value) => value === "—")) return

    rows.push({ label, values })
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

export function SkillsSection({
  skills,
  appendPassive,
  classPassive,
}: SkillsSectionProps) {
  const appendSkills = appendPassive
    .map((entry) => entry.skill)
    .filter(Boolean) as SkillLike[]
  const activeSkillGroups = groupActiveSkills(skills)

  if (!activeSkillGroups.length && !appendSkills.length && !classPassive.length) return null

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
    </div>
  )
}
