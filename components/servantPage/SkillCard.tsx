"use client"

import Image from "next/image"

import { SkillInfoTable } from "@/components/servantPage/SkillInfoTable"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SkillInfoRow {
  label: string
  values: string[]
  icon?: string
}

interface SkillCardProps {
  icon?: string | null
  name: string
  rank?: string | null
  description: string
  unlockText: string
  rows?: SkillInfoRow[]
  levels?: string[]
}

export function SkillCard({
  icon,
  name,
  rank,
  description,
  unlockText,
  rows = [],
  levels = [],
}: SkillCardProps) {
  const title = rank ? `${name} ${rank}` : name
  const hasTable = rows.length > 0 && levels.length > 0

  return (
    <Card className="gap-4 py-4">
      <CardHeader className="grid grid-cols-[auto,1fr] gap-3 px-4">
        {icon ? (
          <Image
            src={icon}
            alt={title}
            width={40}
            height={40}
            className="rounded-md"
          />
        ) : (
          <div className="h-10 w-10 rounded-md border bg-muted" />
        )}
        <div className="space-y-1.5">
          <CardTitle className="text-sm leading-tight">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
          <p className="text-xs font-medium text-muted-foreground">{unlockText}</p>
        </div>
      </CardHeader>
      {hasTable ? (
        <CardContent className="px-4">
          <details className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
              Per-level values
            </summary>
            <div className="px-3 pb-3">
              <SkillInfoTable levels={levels} rows={rows} />
            </div>
          </details>
        </CardContent>
      ) : null}
    </Card>
  )
}
