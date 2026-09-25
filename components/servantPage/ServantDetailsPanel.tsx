import Link from "next/link"
import { Globe, Heart, Layers, Swords } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface ServantDetailsPanelProps {
  maxHp: number
  maxAtk: number
  /** Card letters in deck order, e.g. ["Q", "A", "A", "B", "B"]. */
  deck: string[]
  attribute: string
  alignments: string[]
  traits: string[]
}

const CARD_COLORS: Record<string, string> = {
  Q: "bg-emerald-500/20 text-emerald-300",
  A: "bg-sky-500/20 text-sky-300",
  B: "bg-rose-500/20 text-rose-300",
}

function StatRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground/90">{label}</span>
      <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">{children}</span>
    </div>
  )
}

function ChipLinks({ title, values, filterType }: { title: string; values: string[]; filterType: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Link
              key={value}
              href={`/filter/${filterType}/${encodeURIComponent(value)}`}
              prefetch={false}
              className="rounded-full bg-muted px-3 py-1.5 text-sm text-foreground/85 transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {value}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None</p>
      )}
    </section>
  )
}

export function ServantDetailsPanel({
  maxHp,
  maxAtk,
  deck,
  attribute,
  alignments,
  traits,
}: ServantDetailsPanelProps) {
  return (
    <div className="space-y-5">
      <div className="grid overflow-hidden rounded-lg bg-card/60 sm:grid-cols-2 [&>*]:border-b [&>*]:border-border/60">
        <StatRow icon={<Heart className="size-4" />} label="Max HP">
          {maxHp.toLocaleString()}
        </StatRow>
        <StatRow icon={<Swords className="size-4" />} label="Max ATK">
          {maxAtk.toLocaleString()}
        </StatRow>
        <StatRow icon={<Layers className="size-4" />} label="Deck">
          <span className="flex gap-1">
            {deck.map((card, index) => (
              <span
                key={`${card}-${index}`}
                className={cn("grid size-6 place-items-center rounded text-xs font-bold", CARD_COLORS[card] ?? "bg-muted")}
              >
                {card}
              </span>
            ))}
          </span>
        </StatRow>
        <StatRow icon={<Globe className="size-4" />} label="Attribute">
          <Link
            href={`/filter/attribute/${encodeURIComponent(attribute)}`}
            prefetch={false}
            className="underline-offset-4 hover:underline"
          >
            {attribute}
          </Link>
        </StatRow>
      </div>

      <ChipLinks title="Alignment" values={alignments} filterType="alignment" />
      <ChipLinks title="Traits" values={traits} filterType="trait" />
    </div>
  )
}
