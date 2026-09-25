"use client"

import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"
import { useState } from "react"

import { itemBackgroundClass } from "@/components/materials/itemBackground"
import { Input } from "@/components/ui/input"
import type { MaterialIndexEntry } from "@/lib/atlas-types"
import { cn } from "@/lib/utils"

export function ItemGrid({ items, selectedId }: { items: MaterialIndexEntry[]; selectedId?: number }) {
  const [query, setQuery] = useState("")
  const search = query.trim().toLowerCase()
  const visible = search ? items.filter((item) => item.name.toLowerCase().includes(search)) : items

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-border bg-card/60">
      <div className="p-3">
        <label className="relative block">
          <span className="sr-only">Search items</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items..."
            className="h-10 rounded-full pl-9"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {visible.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/material/${item.id}`}
                  aria-current={item.id === selectedId ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-md border-2 bg-card transition-colors hover:border-foreground/40",
                    item.id === selectedId ? "border-foreground" : "border-transparent"
                  )}
                >
                  <span className={cn("relative grid aspect-square place-items-center", itemBackgroundClass(item.background))}>
                    <Image src={item.icon} alt="" width={64} height={64} className="object-contain" />
                  </span>
                  <span className="line-clamp-2 px-1 py-1 text-center text-xs font-medium leading-tight text-foreground">
                    {item.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No items match</p>
        )}
      </div>
    </div>
  )
}
