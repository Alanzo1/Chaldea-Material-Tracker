"use client"

import { Boxes } from "lucide-react"
import { useState } from "react"

import { ItemGrid } from "@/components/materials/ItemGrid"
import { MaterialDetail } from "@/components/materials/MaterialDetail"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { cn } from "@/lib/utils"

export function ItemBrowser({ items, selected }: { items: MaterialIndexEntry[]; selected?: MaterialIndexEntry }) {
  // Mobile: the grid is the page when nothing is selected, otherwise it collapses behind a toggle.
  const [mobileGridOpen, setMobileGridOpen] = useState(!selected)

  return (
    <main className="mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-6 lg:px-8">
      {selected ? (
        <button
          type="button"
          aria-expanded={mobileGridOpen}
          onClick={() => setMobileGridOpen((open) => !open)}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium lg:hidden"
        >
          <Boxes className="size-4" aria-hidden="true" />
          {mobileGridOpen ? "Hide items" : "All items"}
        </button>
      ) : null}

      <aside
        className={cn(
          "max-h-[70vh] lg:sticky lg:top-22 lg:flex lg:h-[calc(100vh-7rem)] lg:max-h-none",
          mobileGridOpen ? "flex" : "hidden"
        )}
      >
        <ItemGrid items={items} selectedId={selected?.id} />
      </aside>

      <section className="min-w-0">
        {selected ? (
          <MaterialDetail key={selected.id} material={selected} />
        ) : (
          <div className="hidden h-60 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground lg:grid">
            Pick an item to see its usage and sources
          </div>
        )}
      </section>
    </main>
  )
}
