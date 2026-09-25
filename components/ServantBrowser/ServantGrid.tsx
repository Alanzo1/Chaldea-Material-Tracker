import Image from "next/image"
import Link from "next/link"

import type { ServantIndexEntry } from "@/lib/atlas-types"

function ServantCard({ servant }: { servant: ServantIndexEntry }) {
  return (
    <Link
      href={`/servantpage/${servant.id}`}
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5 hover:border-cyan-300/50"
    >
      <div className="relative aspect-square bg-muted">
        {servant.portrait ? (
          <Image
            src={servant.portrait}
            alt=""
            fill
            sizes="140px"
            className="object-cover"
          />
        ) : null}
      </div>
      <span className="truncate px-2 py-1.5 text-center text-sm font-medium text-foreground">
        {servant.name}
      </span>
    </Link>
  )
}

export function ServantGrid({ servants }: { servants: ServantIndexEntry[] }) {
  if (!servants.length) {
    return (
      <div className="grid h-60 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No servants match these filters.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] sm:gap-3">
      {servants.map((servant) => (
        <ServantCard key={servant.id} servant={servant} />
      ))}
    </div>
  )
}
