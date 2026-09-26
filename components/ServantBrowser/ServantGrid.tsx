import Image from "next/image"
import { RegionLink as Link } from "@/components/RegionLink"
import type { ReactNode } from "react"

import type { ServantIndexEntry } from "@/lib/atlas-types"

interface ServantGridProps {
  servants: ServantIndexEntry[]
  /** Card link; defaults to the servant page. */
  getHref?: (servant: ServantIndexEntry) => string
  /** Extra content under the name (e.g. Planning progress). */
  renderFooter?: (servant: ServantIndexEntry) => ReactNode
  /** Content layered over the portrait's top-right corner (e.g. a remove button). */
  renderOverlay?: (servant: ServantIndexEntry) => ReactNode
  emptyMessage?: ReactNode
}

function ServantCard({
  servant,
  href,
  footer,
  overlay,
}: {
  servant: ServantIndexEntry
  href: string
  footer?: ReactNode
  overlay?: ReactNode
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5 hover:border-cyan-300/50"
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
        {footer}
      </Link>
      {overlay ? <div className="absolute right-1 top-1">{overlay}</div> : null}
    </div>
  )
}

export function ServantGrid({
  servants,
  getHref = (servant) => `/servantpage/${servant.id}`,
  renderFooter,
  renderOverlay,
  emptyMessage = "No servants match these filters.",
}: ServantGridProps) {
  if (!servants.length) {
    return (
      <div className="grid h-60 place-items-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] sm:gap-3">
      {servants.map((servant) => (
        <ServantCard
          key={servant.id}
          servant={servant}
          href={getHref(servant)}
          footer={renderFooter?.(servant)}
          overlay={renderOverlay?.(servant)}
        />
      ))}
    </div>
  )
}
