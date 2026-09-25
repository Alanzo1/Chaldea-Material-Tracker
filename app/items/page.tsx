import Image from "next/image"
import Link from "next/link"

import { getMaterialsIndex } from "@/lib/atlas-data"

export default function ItemsPage() {
  const items = getMaterialsIndex()

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Chaldea inventory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Items</h1>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/material/${item.id}?name=${encodeURIComponent(item.name)}&icon=${encodeURIComponent(item.icon)}&returnTo=${encodeURIComponent("/items")}`}
            className="flex min-h-20 items-center gap-3 rounded-md border border-border bg-card p-3 text-card-foreground transition-colors hover:bg-muted"
          >
            <Image
              src={item.icon}
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-md object-contain"
            />
            <span className="text-sm font-semibold leading-snug">{item.name}</span>
          </Link>
        ))}
      </section>
    </main>
  )
}
