"use client"

import { Check } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { ProfileServerNotice, useProfileMatchesRegion } from "@/components/account/ProfileServerNotice"
import { normalizeOwnedDraft, parseOwnedQuantity } from "@/lib/item-usage"
import * as materialTracker from "@/lib/material-tracker"
import { computeTrackerStateInWorker } from "@/lib/material-tracker-worker-client"
import { cn } from "@/lib/utils"

const SAVED_FLASH_MS = 1500
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
// The user types a quantity and presses Save (or Enter); nothing is stored before that.
// It edits the active profile, so it only shows when that profile plays on this page's region.
export function OwnedQuantityControl({ itemId }: { itemId: number }) {
  const { matches } = useProfileMatchesRegion()
  return matches ? <OwnedQuantityEditor itemId={itemId} /> : <ProfileServerNotice />
}

function OwnedQuantityEditor({ itemId }: { itemId: number }) {
  const [saved, setSaved] = useState(0)
  const [draft, setDraft] = useState("0")
  const [needed, setNeeded] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepSelectionOnMouseUp = useRef(false)

  useEffect(() => {
    let generation = 0
    const update = () => {
      const current = ++generation
      const trackerState = materialTracker.readTrackedMaterialsState()
      const initial = parseOwnedQuantity(trackerState.ownedByMaterialId[String(itemId)] ?? 0)
      setSaved(initial)
      setDraft(String(initial))
      computeTrackerStateInWorker(trackerState).then((payload) => {
        if (current === generation) setNeeded(payload.aggregate.requiredMaterials.find((entry) => entry.id === itemId)?.amount ?? 0)
      }).catch(() => {
        if (current === generation) setNeeded(materialTracker.calculateAggregateRequirements(trackerState).requiredMaterials.find((entry) => entry.id === itemId)?.amount ?? 0)
      })
    }
    update()
    const unsubscribe = materialTracker.subscribeTracker(update)
    return () => { generation++; unsubscribe(); if (flashTimer.current) clearTimeout(flashTimer.current) }
  }, [itemId])

  const draftValue = parseOwnedQuantity(draft)
  const dirty = draftValue !== saved
  const afterPlannedUpgrades = saved - needed

  const save = () => {
    materialTracker.setOwnedMaterialQuantity(itemId, draftValue)
    setSaved(draftValue)
    setDraft(String(draftValue))
    setJustSaved(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setJustSaved(false), SAVED_FLASH_MS)
  }

  return (
    <section className="grid gap-4 rounded-lg bg-card/60 p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (dirty) save()
        }}
      >
        <label htmlFor={`owned-${itemId}`} className="text-xs text-muted-foreground">
          Quantity owned
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={`owned-${itemId}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            onChange={(event) => {
              setDraft(normalizeOwnedDraft(event.target.value))
              setJustSaved(false)
            }}
            // Select all on focus so typing replaces the number; the mouseup that follows a
            // click-to-focus would otherwise collapse the selection.
            onFocus={(event) => {
              event.target.select()
              keepSelectionOnMouseUp.current = true
            }}
            onMouseUp={(event) => {
              if (keepSelectionOnMouseUp.current) event.preventDefault()
              keepSelectionOnMouseUp.current = false
            }}
            className="h-10 w-32 rounded-md border border-border bg-background px-3 text-center text-base font-semibold tabular-nums"
          />
          <button
            type="submit"
            disabled={!dirty}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors",
              dirty ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground",
              justSaved && "text-emerald-300"
            )}
          >
            {justSaved ? <Check className="size-4" aria-hidden="true" /> : null}
            {justSaved ? "Updated" : "Save"}
          </button>
        </div>
        <p className="mt-1 h-4 text-xs text-amber-300" aria-live="polite">
          {dirty ? `Not saved yet — saved amount: ${NUMBER.format(saved)}` : ""}
        </p>
      </form>
      <Stat label="Needed by tracked servants" value={needed} />
      <div aria-live="polite">
        <Stat
          label="Left over after tracked servants"
          value={afterPlannedUpgrades}
          tone={afterPlannedUpgrades < 0 ? "text-rose-300" : "text-emerald-300"}
        />
      </div>
    </section>
  )
}
