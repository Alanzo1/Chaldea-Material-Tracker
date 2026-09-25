"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, PlusCircle } from "lucide-react"

import { isServantFavorited, toggleFavoriteServant } from "@/lib/favorites"
import {
  MaterialStageMap,
  type SkillLevels,
  upsertTrackedServant,
} from "@/lib/material-tracker"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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

// "Add" (send to material tracker) and favorite controls, overlaid on the servant art.
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
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [ascensionLevel, setAscensionLevel] = useState(1)
  const [skillLevels, setSkillLevels] = useState<SkillLevels>([1, 1, 1])
  const [appendSkillLevels, setAppendSkillLevels] = useState<SkillLevels>([1, 1, 1])

  useEffect(() => {
    setIsFavorite(isServantFavorited(servantId))
  }, [servantId])

  const onToggleFavorite = () => {
    const nextIds = toggleFavoriteServant(servantId)
    setIsFavorite(nextIds.includes(servantId))
  }

  const onSendToTracker = () => {
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
    router.push("/track-materials")
  }

  const setAt = (values: SkillLevels, index: number, value: number) =>
    values.map((current, i) => (i === index ? value : current)) as SkillLevels

  return (
    <div className="flex items-center gap-2">
      <Popover>
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
          <Button type="button" className="w-full" onClick={onSendToTracker}>
            Send to Track Materials Page
          </Button>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={cn(OVERLAY_BUTTON_CLASS, "w-10 justify-center px-0")}
      >
        <Heart className={cn("size-4", isFavorite && "fill-rose-500 text-rose-500")} aria-hidden="true" />
      </button>
    </div>
  )
}
