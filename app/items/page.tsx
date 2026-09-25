import Image from "next/image"
import Link from "next/link"

import { HeaderActionLink } from "@/components/HeaderActionLink"

const ITEMS_URL = "https://api.atlasacademy.io/export/NA/nice_item.json"

interface AtlasItem {
  id?: number
  name?: string
  icon?: string
  uses?: string[]
}

function shouldIncludeItem(item: AtlasItem) {
  const id = Number(item.id ?? 0)
  if (!id || id === 6999) return true

  const uses = Array.isArray(item.uses) ? item.uses : []
  return uses.some((use) =>
    ["skill", "appendSkill", "ascension", "costume"].includes(String(use))
  )
}

async function getItems() {
  const response = await fetch(ITEMS_URL, {
    next: { revalidate: 86400, tags: ["atlas:materials-index"] },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch items (${response.status})`)
  }

  const payload = (await response.json()) as AtlasItem[]
  const seen = new Set<number>()

  return payload
    .filter(shouldIncludeItem)
    .map((item) => ({
      id: Number(item.id ?? 0),
      name: String(item.name ?? "").trim(),
      icon: String(item.icon ?? "").trim(),
    }))
    .filter((item) => item.id > 0 && item.name && item.icon)
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export default async function ItemsPage() {
  const items = await getItems()

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Chaldea inventory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Items</h1>
        </div>
        <div className="flex gap-2">
          <HeaderActionLink href="/" label="Servants" />
          <HeaderActionLink href="/track-materials" label="Planning" />
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
