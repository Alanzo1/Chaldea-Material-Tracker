"use client"

import Image from "next/image"

import { NPInfoTable } from "@/components/servantPage/NPInfoTable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface NPEffectRow {
  label: string
  values: string[]
  icon?: string
}

interface NoblePhantasmCardProps {
  nameImage?: string
  card?: string
  name: string
  rank?: string
  npType?: string
  baseDescription: string
  overchargeDescription: string
  levelRows: NPEffectRow[]
  overchargeRows: NPEffectRow[]
}

const CARD_LABELS: Record<string, string> = {
  "1": "Arts NP",
  "2": "Buster NP",
  "3": "Quick NP",
}

export function NoblePhantasmCard({
  nameImage,
  card,
  name,
  rank,
  npType,
  baseDescription,
  overchargeDescription,
  levelRows,
  overchargeRows,
}: NoblePhantasmCardProps) {
  const title = rank ? `${name} ${rank}` : name
  const cardLabel = CARD_LABELS[String(card ?? "")] ?? "Noble Phantasm"
  const hasTable = levelRows.length > 0 || overchargeRows.length > 0

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="grid grid-cols-[auto,1fr] gap-3 px-4">
        {nameImage ? (
          <Image
            src={nameImage}
            alt={title}
            width={56}
            height={56}
            className="rounded-md"
          />
        ) : (
          <div className="h-14 w-14 rounded-md border bg-muted" />
        )}
        <div className="space-y-1.5">
          <CardTitle className="text-sm leading-tight">{title}</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{cardLabel}</span>
            {npType ? <span>{npType}</span> : null}
          </div>
          <CardDescription className="text-xs">{baseDescription}</CardDescription>
          {overchargeDescription ? (
            <p className="text-xs font-medium text-muted-foreground">
              Overcharge: {overchargeDescription}
            </p>
          ) : null}
        </div>
      </CardHeader>
      {hasTable ? (
        <CardContent className="px-4">
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
              NP values
            </summary>
            <div className="px-3 pb-3">
              <NPInfoTable levelRows={levelRows} overchargeRows={overchargeRows} />
            </div>
          </details>
        </CardContent>
      ) : null}
    </Card>
  )
}
