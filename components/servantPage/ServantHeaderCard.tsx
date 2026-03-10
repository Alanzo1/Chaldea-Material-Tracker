"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { isServantFavorited, toggleFavoriteServant } from "@/lib/favorites"
import {
  MaterialStageMap,
  upsertTrackedServant,
} from "@/lib/material-tracker"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  CardAction,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ServantHeaderCardProps {
  servantId: number
  name: string
  className: string
  rarity: number
  portrait?: string
  ascensionMaterials?: MaterialStageMap
  skillMaterials?: MaterialStageMap
  appendSkillMaterials?: MaterialStageMap
}

function getStarColorClass(rarity: number) {
  if (rarity <= 2) return "text-amber-700"
  if (rarity === 3) return "text-slate-400"
  return "text-yellow-500"
}

export function ServantHeaderCard({
  servantId,
  name,
  className,
  rarity,
  portrait,
  ascensionMaterials,
  skillMaterials,
  appendSkillMaterials,
}: ServantHeaderCardProps) {
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [ascensionLevel, setAscensionLevel] = useState(1)
  const [skillLevel1, setSkillLevel1] = useState(1)
  const [skillLevel2, setSkillLevel2] = useState(1)
  const [skillLevel3, setSkillLevel3] = useState(1)
  const [appendSkillLevel1, setAppendSkillLevel1] = useState(1)
  const [appendSkillLevel2, setAppendSkillLevel2] = useState(1)
  const [appendSkillLevel3, setAppendSkillLevel3] = useState(1)

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
      skillLevels: [skillLevel1, skillLevel2, skillLevel3],
      appendSkillLevels: [appendSkillLevel1, appendSkillLevel2, appendSkillLevel3],
      ascensionMaterials: ascensionMaterials ?? {},
      skillMaterials: skillMaterials ?? {},
      appendSkillMaterials: appendSkillMaterials ?? {},
    })
    router.push("/track-materials")
  }

  return (
    <Card>
      <CardHeader>
        <CardAction className="flex flex-col gap-2">
          <Button type="button" variant={isFavorite ? "default" : "outline"} onClick={onToggleFavorite}>
            {isFavorite ? "★ Favorited" : "☆ Favorite"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline">
                Track Materials
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-[30rem] space-y-4 rounded-sm border-2 bg-background p-4 shadow-none"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium">Ascension Lv</p>
                <select
                  className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                  value={ascensionLevel}
                  onChange={(event) => setAscensionLevel(Number(event.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>Max</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Skill 1 Lv</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={skillLevel1}
                    onChange={(event) => setSkillLevel1(Number(event.target.value))}
                  >
                    {Array.from({ length: 11 }, (_, index) => index).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Skill 2 Lv</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={skillLevel2}
                    onChange={(event) => setSkillLevel2(Number(event.target.value))}
                  >
                    {Array.from({ length: 11 }, (_, index) => index).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Skill 3 Lv</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={skillLevel3}
                    onChange={(event) => setSkillLevel3(Number(event.target.value))}
                  >
                    {Array.from({ length: 11 }, (_, index) => index).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Append Skill 1 Lv</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={appendSkillLevel1}
                    onChange={(event) => setAppendSkillLevel1(Number(event.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Append Skill 2 Lv</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={appendSkillLevel2}
                    onChange={(event) => setAppendSkillLevel2(Number(event.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Append Skill 3 Lv</p>
                  <select
                    className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                    value={appendSkillLevel3}
                    onChange={(event) => setAppendSkillLevel3(Number(event.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="button" className="w-full" onClick={onSendToTracker}>
                Send to Track Materials Page
              </Button>
            </PopoverContent>
          </Popover>
        </CardAction>
        <CardTitle className="text-3xl">{name}</CardTitle>
        <CardDescription className="text-base">
          {className} |{" "}
          <span className={getStarColorClass(rarity)}>{"★".repeat(rarity)}</span>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
