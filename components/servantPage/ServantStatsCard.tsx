"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ServantStatsCardProps {
  maxHp: number
  maxAtk: number
  traits: string[]
  attribute: string
  alignment: string
  deck: string
}

function formatValue(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function ServantStatsCard({
  maxHp,
  maxAtk,
  traits,
  attribute,
  alignment,
  deck,
}: ServantStatsCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Servant Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-muted-foreground">Max HP</p>
            <p>{maxHp.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Max ATK</p>
            <p>{maxAtk.toLocaleString()}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Attribute</p>
            <p>{formatValue(attribute)}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Alignment</p>
            <p>{alignment}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Deck</p>
            <p>{deck}</p>
          </div>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Traits</p>
          <p className="mt-1">
            {traits.length ? traits.join(", ") : "None"}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
