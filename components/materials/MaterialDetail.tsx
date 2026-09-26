"use client"

import Image from "next/image"

import { itemBackgroundClass } from "@/components/materials/itemBackground"
import { MaterialSourcesList } from "@/components/materials/MaterialSourcesList"
import { MaterialUsagePanel } from "@/components/materials/MaterialUsagePanel"
import { OwnedQuantityControl } from "@/components/materials/OwnedQuantityControl"
import { ServantTabs } from "@/components/servantPage/ServantTabs"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { useItemFile } from "@/lib/use-item-file"
import { cn } from "@/lib/utils"

const RARITY_BADGE: Record<string, string> = {
  bronze: "bg-amber-800/40 text-amber-200",
  silver: "bg-slate-400/25 text-slate-100",
  gold: "bg-yellow-500/25 text-yellow-200",
}

export function MaterialDetail({ material }: { material: MaterialIndexEntry }) {
  const itemFile = useItemFile(material.id)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="space-y-2">
        <div>
          <h1 className="font-serif text-4xl font-bold italic tracking-tight text-foreground sm:text-5xl">
            {material.name}
          </h1>
          {material.originalName ? <p lang="ja" className="mt-1 text-sm text-muted-foreground">{material.originalName}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base text-foreground/85">{material.category}</span>
          {material.background ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                RARITY_BADGE[material.background] ?? "bg-muted text-foreground/80"
              )}
            >
              {material.background}
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-[6rem_1fr] gap-3 sm:grid-cols-[10rem_1fr]">
        <div className={cn("grid aspect-square place-items-center self-start rounded-lg p-2", itemBackgroundClass(material.background))}>
          <Image src={material.icon} alt={material.name} width={112} height={112} priority className="object-contain" />
        </div>
        <p className="rounded-lg bg-card/60 p-3 text-sm leading-relaxed text-foreground/90 sm:p-4 sm:text-base">
          {material.detail || "No description."}
        </p>
      </div>

      <OwnedQuantityControl itemId={material.id} />

      <ServantTabs
        tabs={[
          {
            id: "usage",
            label: "Usage",
            content: <MaterialUsagePanel usage={itemFile.usage} status={itemFile.status} onRetry={itemFile.retry} />,
          },
          {
            id: "sources",
            label: "Sources",
            content: (
              <MaterialSourcesList
                itemId={material.id}
                nodes={itemFile.nodes}
                status={itemFile.status}
                onRetry={itemFile.retry}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
