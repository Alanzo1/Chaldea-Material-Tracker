"use client"

import { useEffect, useRef, useState } from "react"
import { RegionLink as Link } from "@/components/RegionLink"
import { CheckCircle2, PlusCircle, X } from "lucide-react"

import {
  MaterialStageMap,
  readTrackedMaterialsState,
  type SkillLevels,
  upsertTrackedServant,
} from "@/lib/material-tracker"
import { ProfileServerNotice, useProfileMatchesRegion } from "@/components/account/ProfileServerNotice"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ServantActionsProps {
  servantId: number
  name: string
  className: string
  rarity: number
  portrait?: string
  ascensionMaterials?: MaterialStageMap
  skillMaterials?: MaterialStageMap
  appendSkillMaterials?: MaterialStageMap
}

const OVERLAY_BUTTON_CLASS =
  "flex h-10 items-center gap-2 rounded-full bg-background/70 px-4 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-background/90"

const NOTICE_MS = 4000
const SKILL_LEVELS = Array.from({ length: 11 }, (_, index) => index)
const APPEND_LEVELS = Array.from({ length: 10 }, (_, index) => index + 1)

function LevelSelect({
  label,
  value,
  levels,
  onChange,
}: {
  label: string
  value: number
  levels: { value: number; label: string }[]
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <select
        className="w-full rounded-md border bg-background px-2 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {levels.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </label>
  )
}

const asOptions = (levels: number[]) => levels.map((level) => ({ value: level, label: String(level) }))

// Add to the material tracker from the servant art.
export function ServantActions({
  servantId,
  name,
  className,
  rarity,
  portrait,
  ascensionMaterials,
  skillMaterials,
  appendSkillMaterials,
}: ServantActionsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  // Adding edits the active profile; a JP servant belongs in a JP profile.
  const { matches } = useProfileMatchesRegion()
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ascensionLevel, setAscensionLevel] = useState(1)
  const [skillLevels, setSkillLevels] = useState<SkillLevels>([1, 1, 1])
  const [appendSkillLevels, setAppendSkillLevels] = useState<SkillLevels>([1, 1, 1])

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  const showNotice = (message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }

  // Stay on the servant page: confirm with a popup instead of navigating to Planning.
  const onSendToTracker = () => {
    const alreadyTracked = readTrackedMaterialsState().servants.some((entry) => entry.servantId === servantId)
    upsertTrackedServant({
      servantId,
      servantName: name,
      className,
      rarity,
      portrait,
      ascensionLevel,
      skillLevels,
      appendSkillLevels,
      ascensionMaterials: ascensionMaterials ?? {},
      skillMaterials: skillMaterials ?? {},
      appendSkillMaterials: appendSkillMaterials ?? {},
    })
    setPopoverOpen(false)
    showNotice(alreadyTracked ? `${name} updated in Planning` : `${name} added to Planning`)
  }

  const setAt = (values: SkillLevels, index: number, value: number) =>
    values.map((current, i) => (i === index ? value : current)) as SkillLevels

  return (
    <div className="flex items-center gap-2">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={OVERLAY_BUTTON_CLASS}>
            <PlusCircle className="size-4" aria-hidden="true" />
            Add
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-[min(30rem,calc(100vw-2rem))] space-y-4 rounded-lg p-4"
        >
          {matches ? <>
          <LevelSelect
            label="Ascension Lv"
            value={ascensionLevel}
            levels={[1, 2, 3, 4].map((level) => ({ value: level, label: String(level) })).concat({ value: 5, label: "Max" })}
            onChange={setAscensionLevel}
          />
          <div className="grid grid-cols-2 gap-3">
            {skillLevels.map((level, index) => (
              <LevelSelect
                key={`skill-${index}`}
                label={`Skill ${index + 1} Lv`}
                value={level}
                levels={asOptions(SKILL_LEVELS)}
                onChange={(value) => setSkillLevels((current) => setAt(current, index, value))}
              />
            ))}
            {appendSkillLevels.map((level, index) => (
              <LevelSelect
                key={`append-${index}`}
                label={`Append Skill ${index + 1} Lv`}
                value={level}
                levels={asOptions(APPEND_LEVELS)}
                onChange={(value) => setAppendSkillLevels((current) => setAt(current, index, value))}
              />
            ))}
          </div>
          <Button type="button" className="w-full cursor-pointer" onClick={onSendToTracker}>
            Add to Planning
          </Button>
          </> : <ProfileServerNotice />}
        </PopoverContent>
      </Popover>

      {notice ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-lg border border-emerald-400/30 bg-card px-4 py-3 text-sm text-foreground shadow-2xl"
        >
          <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <span className="min-w-0 flex-1">{notice}</span>
          <Link href="/track-materials" className="shrink-0 font-semibold text-cyan-300 underline-offset-4 hover:underline">
            View
          </Link>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
