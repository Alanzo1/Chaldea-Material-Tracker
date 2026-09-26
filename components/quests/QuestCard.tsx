import Image from "next/image"
import { RegionLink as Link } from "@/components/RegionLink"
import { Map as MapIcon } from "lucide-react"

import type { FreeQuestIndexEntry } from "@/lib/atlas-types"
import { cn } from "@/lib/utils"

export function QuestCard({
  quest,
  selected = false,
  onNavigate,
}: {
  quest: FreeQuestIndexEntry
  selected?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={`/free-quests/${quest.questId}`}
      onClick={onNavigate}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "block h-full overflow-hidden rounded-lg border-2 bg-background/50 transition-colors hover:border-cyan-400/60 focus-visible:outline-2 focus-visible:outline-cyan-300",
        selected ? "border-cyan-300" : "border-transparent"
      )}
    >
      <div className="relative flex h-20 items-center justify-center overflow-hidden bg-slate-700">
        {quest.spotImage ? (
          <Image src={quest.spotImage} alt="" fill sizes="160px" className="object-contain object-bottom p-1" />
        ) : (
          <MapIcon className="size-8 text-cyan-200" aria-hidden="true" />
        )}
        <span className="absolute bottom-1 right-1 rounded bg-slate-950/85 px-2 py-0.5 text-xs text-white">
          {quest.apCost ?? "—"} AP
        </span>
      </div>
      <div className="p-2">
        <p className="text-sm font-semibold leading-snug">{quest.spotName}</p>
        <p className="mt-1 text-xs text-muted-foreground">{quest.name}</p>
      </div>
    </Link>
  )
}
