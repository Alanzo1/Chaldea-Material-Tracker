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
    <Card>
      <CardHeader className="grid grid-cols-[auto,1fr] gap-4">
        {icon ? (
          <Image
            src={icon}
            alt={title}
            width={48}
            height={48}
            className="rounded-md"
          />
        ) : (
          <div className="h-12 w-12 rounded-md border bg-muted" />
        )}
        <div className="space-y-2">
          <CardTitle className="text-base leading-tight">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
          <p className="text-xs font-medium text-muted-foreground">{unlockText}</p>
        </div>
      </CardHeader>
      {hasTable ? (
        <CardContent>
          <details className="rounded-md border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Per-level values
            </summary>
            <div className="px-4 pb-4">
              <SkillInfoTable levels={levels} rows={rows} />
            </div>
          </details>
        </CardContent>
      ) : null}
    </Card>
  )
}
