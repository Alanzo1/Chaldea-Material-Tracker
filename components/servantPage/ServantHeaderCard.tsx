"use client"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ServantHeaderCardProps {
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
  name,
  className,
  rarity,
}: ServantHeaderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">{name}</CardTitle>
        <CardDescription className="text-base">
          {className} |{" "}
          <span className={getStarColorClass(rarity)}>{"★".repeat(rarity)}</span>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
