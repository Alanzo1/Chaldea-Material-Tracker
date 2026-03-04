"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ServantStatsCardProps {
  maxHp: number
  maxAtk: number
  deck: string
}

export function ServantStatsCard({
  maxHp,
  maxAtk,
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
            <p className="font-medium text-muted-foreground">Deck</p>
            <p>{deck}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
