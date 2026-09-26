"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Shield, Zap } from "lucide-react"
import type { FreeQuestPhase } from "@/lib/atlas-types"
import { cn } from "@/lib/utils"

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const format = (value: number | null) => value === null ? "—" : (value > 0 && value < 0.01 ? value.toPrecision(2) : number.format(value))

export function QuestDetail({ quest }: { quest: FreeQuestPhase }) {
  const [waveIndex, setWaveIndex] = useState(0)
  const wave = quest.stages[waveIndex]

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{quest.warName.replace(/\s+/g, " ")}</p>
        <p className="text-lg text-foreground/80">
          {quest.spotName}
          {quest.spotOriginalName ? <span lang="ja" className="ml-2 text-sm text-muted-foreground">{quest.spotOriginalName}</span> : null}
        </p>
        <div className="flex items-end gap-6 sm:gap-10">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl font-bold italic tracking-tight sm:text-4xl">{quest.name}</h1>
            {quest.originalName ? <p lang="ja" className="mt-1 text-sm text-muted-foreground">{quest.originalName}</p> : null}
          </div>
          {/* The location's own icon from the in-game quest map. */}
          {quest.spotImage ? <Image src={quest.spotImage} alt={`${quest.spotName} on the quest map`} width={256} height={256} className="size-24 shrink-0 object-contain object-bottom sm:size-36" /> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full bg-muted px-4 py-2">Rec. Lv. {quest.recommendedLevel ?? "—"}</span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-4 py-2"><Zap className="size-4 text-emerald-400" aria-hidden="true" />{quest.apCost ?? "—"} AP</span>
          {quest.entryItems.map((item) => <span key={item.id} className="rounded-full bg-muted px-4 py-2">{item.amount} × {item.name}</span>)}
          <span className="rounded-full bg-cyan-400/10 px-4 py-2 text-cyan-600 dark:text-cyan-200">Repeatable</span>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3 rounded-xl bg-card/70 p-5">
        {[["Bond", quest.bond], ["Master EXP", quest.experience], ["QP / run", quest.qp ?? quest.drops.find((drop) => drop.id === 1 && drop.type === "item")?.perRun ?? null]].map(([label, value]) => <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{format(value as number | null)}</dd>
        </div>)}
      </dl>

      <section aria-labelledby="quest-drops-heading" className="space-y-3">
        <h2 id="quest-drops-heading" className="text-xl font-bold">Drops</h2>
        {quest.drops.length ? <>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-card/70 p-3 sm:grid-cols-3 xl:grid-cols-4">
            {quest.drops.map((drop, index) => <div key={`${drop.type}-${drop.id}-${index}`} className="flex flex-col items-center rounded-lg bg-background/40 p-3 text-center">
              {drop.icon ? <Image src={drop.icon} alt="" width={48} height={48} className="mb-2 size-12 object-contain" /> : <span className="mb-2 grid size-12 place-items-center rounded-full bg-muted text-xl" aria-hidden="true">◇</span>}
              <p className="min-h-10 text-sm font-medium">{drop.name}</p>
              <p className="mt-2 text-sm font-semibold tabular-nums text-cyan-700 dark:text-cyan-200">{format(drop.perRun)} / run</p>
              <p className="text-xs tabular-nums text-muted-foreground">{format(drop.apPerItem)} AP / item</p>
              <p className="mt-2 text-xs text-muted-foreground">{drop.runs > 0 ? `${number.format(drop.runs)} runs sampled` : "No drop statistics"}</p>
            </div>)}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Average items per run, not a guaranteed drop chance. Includes stack quantities; estimates depend on the number of sampled runs.</p>
        </> : <p className="rounded-xl bg-card/70 p-5 text-sm text-muted-foreground">Drop statistics are unavailable for this quest.</p>}
      </section>

      <section aria-label="Quest waves" className="space-y-4">
        {quest.stages.length > 0 ? <>
          <div role="tablist" aria-label="Battle waves" className="flex flex-wrap justify-center gap-2">
            {quest.stages.map((stage, index) => <button
              key={stage.wave} type="button" role="tab" id={`wave-tab-${index}`} aria-selected={waveIndex === index} aria-controls={`wave-panel-${index}`} tabIndex={waveIndex === index ? 0 : -1}
              onClick={() => setWaveIndex(index)}
              onKeyDown={(event) => {
                let next = index
                if (event.key === "ArrowRight") next = (index + 1) % quest.stages.length
                else if (event.key === "ArrowLeft") next = (index + quest.stages.length - 1) % quest.stages.length
                else if (event.key === "Home") next = 0
                else if (event.key === "End") next = quest.stages.length - 1
                else return
                event.preventDefault(); setWaveIndex(next); document.getElementById(`wave-tab-${next}`)?.focus()
              }}
              className={cn("h-11 rounded-full px-5 text-sm font-semibold transition-colors", waveIndex === index ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted")}
            >Wave {stage.wave}</button>)}
          </div>
          <div role="tabpanel" id={`wave-panel-${waveIndex}`} aria-labelledby={`wave-tab-${waveIndex}`} className="rounded-xl bg-card/70 p-4 sm:p-5">
            {wave?.enemies.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {wave.enemies.map((enemy, index) => <article key={`${enemy.deck}-${enemy.deckId}-${index}`} className="overflow-hidden rounded-lg border bg-background/50">
                <div className="relative grid h-32 place-items-center bg-gradient-to-b from-slate-600/40 to-slate-800/30">
                  {/* Most enemy icons are 63×63 in-game assets: show them near native size instead of stretching (blurry). */}
                  {enemy.icon ? <Image src={enemy.icon} alt="" width={64} height={64} className="size-16 object-contain" /> : <Shield className="size-14 text-muted-foreground" />}
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-1 text-xs font-semibold">Lv. {enemy.level ?? "—"}</span>
                  {enemy.deck && enemy.deck !== "enemy" && <span className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs">Reserve</span>}
                </div>
                <div className="space-y-2 p-3">
                  <h3 className="font-semibold leading-snug">{enemy.name}</h3>
                  <p className="text-xs capitalize text-muted-foreground">{enemy.className ?? "Unknown class"}</p>
                  <p className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-300">{format(enemy.hp)} HP</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer rounded py-1 font-medium text-muted-foreground">Traits & details</summary>
                    <p className="mt-2 capitalize">{enemy.attribute ?? "Unknown attribute"} · ATK {format(enemy.attack)}</p>
                    <ul className="mt-2 flex flex-wrap gap-1">{enemy.traits.map((trait) => <li key={trait.id} className="break-all rounded bg-muted px-2 py-1">{trait.name?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? `Trait ${trait.id}`}</li>)}</ul>
                    {!enemy.traits.length && <p className="mt-2 text-muted-foreground">No traits available.</p>}
                  </details>
                </div>
              </article>)}
            </div> : <p className="py-8 text-center text-muted-foreground">Enemy data is unavailable for this wave.</p>}
          </div>
        </> : <p className="rounded-xl bg-card/70 p-6 text-center text-muted-foreground">Wave data is unavailable for this quest.</p>}
      </section>
      <p className="text-xs text-muted-foreground">Data from <Link className="underline underline-offset-4" href={`https://apps.atlasacademy.io/db/NA/quest/${quest.questId}/${quest.phase}`}>Atlas Academy</Link>. Enemy lineups may vary between runs.</p>
    </div>
  )
}
