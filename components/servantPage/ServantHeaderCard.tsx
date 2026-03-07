"use client"

import { useEffect, useState } from "react"

import { isServantFavorited, toggleFavoriteServant } from "@/lib/favorites"
import { Button } from "@/components/ui/button"
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
}: ServantHeaderCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)

  useEffect(() => {
    setIsFavorite(isServantFavorited(servantId))
  }, [servantId])

  const onToggleFavorite = () => {
    const nextIds = toggleFavoriteServant(servantId)
    setIsFavorite(nextIds.includes(servantId))
  }

  return (
    <Card>
      <CardHeader>
        <CardAction>
          <Button type="button" variant={isFavorite ? "default" : "outline"} onClick={onToggleFavorite}>
            {isFavorite ? "★ Favorited" : "☆ Favorite"}
          </Button>
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
