"use client"

import { Minus, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { holdStepAmount, parseOwnedQuantity } from "@/lib/item-usage"
import * as materialTracker from "@/lib/material-tracker"
import { computeTrackerStateInWorker } from "@/lib/material-tracker-worker-client"

const HOLD_DELAY_MS = 400
const HOLD_INTERVAL_MS = 90
const NUMBER = new Intl.NumberFormat("en-US")

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{NUMBER.format(value)}</p>
    </div>
  )
}

// Owned count for one material, shared with the Planning page (tracker ownedByMaterialId).
export function OwnedQuantityControl({ itemId }: { itemId: number }) {
  const [owned, setOwned] = useState(0)
  const [needed, setNeeded] = useState(0)
  const ownedRef = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdStartedAt = useRef(0)

  useEffect(() => {
    const trackerState = materialTracker.readTrackedMaterialsState()
    const initial = parseOwnedQuantity(trackerState.ownedByMaterialId[String(itemId)] ?? 0)
    ownedRef.current = initial
    setOwned(initial)

    let cancelled = false
    computeTrackerStateInWorker(trackerState)
      .then((payload) => {
        if (cancelled) return
        setNeeded(payload.aggregate.requiredMaterials.find((entry) => entry.id === itemId)?.amount ?? 0)
      })
      .catch(() => {
        if (cancelled) return
        const aggregate = materialTracker.calculateAggregateRequirements(trackerState)
        setNeeded(aggregate.requiredMaterials.find((entry) => entry.id === itemId)?.amount ?? 0)
      })

    return () => {
      cancelled = true
    }
  }, [itemId])

  const commit = (value: unknown) => {
    const safe = parseOwnedQuantity(value)
    ownedRef.current = safe
    setOwned(safe)
    materialTracker.setOwnedMaterialQuantity(itemId, safe)
  }

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  // Press: step once now; keep holding: repeat, stepping by 10 after 1 s.
  const startHold = (direction: 1 | -1) => {
    stopHold()
    commit(ownedRef.current + direction)
    holdStartedAt.current = Date.now()
    const tick = () => {
      commit(ownedRef.current + direction * holdStepAmount(Date.now() - holdStartedAt.current))
      holdTimer.current = setTimeout(tick, HOLD_INTERVAL_MS)
    }
    holdTimer.current = setTimeout(tick, HOLD_DELAY_MS)
  }

  // Review Focus 2: never leave a repeating timer behind.
  useEffect(() => stopHold, [])

  const stepButton = (direction: 1 | -1) => (
    <button
      type="button"
      aria-label={direction > 0 ? "Increase owned" : "Decrease owned"}
      disabled={direction < 0 && owned === 0}
      onPointerDown={(event) => {
        event.preventDefault()
        startHold(direction)
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      // Keyboard activation (Enter/Space) fires click with detail 0 and no pointer events.
      onClick={(event) => {
        if (event.detail === 0) commit(ownedRef.current + direction)
      }}
      className="grid size-10 shrink-0 select-none place-items-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
    >
      {direction > 0 ? <Plus className="size-4" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
    </button>
  )

  const remaining = Math.max(0, needed - owned)

  return (
    <section className="grid gap-4 rounded-lg bg-card/60 p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
      <div>
        <label htmlFor={`owned-${itemId}`} className="text-xs text-muted-foreground">
          Owned
        </label>
        <div className="mt-1 flex items-center gap-2">
          {stepButton(-1)}
          <input
            id={`owned-${itemId}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={owned}
            onChange={(event) => commit(event.target.value)}
            className="h-10 w-28 rounded-md border border-border bg-background px-3 text-center text-base font-semibold tabular-nums"
          />
          {stepButton(1)}
        </div>
      </div>
      <Stat label="Needed by tracked servants" value={needed} />
      <Stat label="Remaining" value={remaining} tone={remaining > 0 ? "text-rose-300" : "text-emerald-300"} />
    </section>
  )
}
