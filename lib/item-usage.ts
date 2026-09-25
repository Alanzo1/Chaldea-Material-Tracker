// Pure helpers for the material page. No `@/` imports: loaded directly by `node --test`.
import type { ItemUsageEntry } from "./atlas-types"

export type UsageFilter = "all" | "tracked" | "favorites"

export const MAX_OWNED_QUANTITY = 9_999_999

export function filterUsage(
  usage: ItemUsageEntry[],
  filter: UsageFilter,
  ctx: { trackedIds: number[]; favoriteIds: number[]; knownServantIds: Iterable<number> }
): ItemUsageEntry[] {
  const known = new Set(ctx.knownServantIds)
  const picked =
    filter === "tracked" ? new Set(ctx.trackedIds) : filter === "favorites" ? new Set(ctx.favoriteIds) : null

  return usage.filter((entry) => known.has(entry.servantId) && (!picked || picked.has(entry.servantId)))
}

const BREAKDOWN_LABELS: [keyof ItemUsageEntry, string][] = [
  ["ascension", "Ascension"],
  ["skill", "Skill"],
  ["append", "Append"],
  ["costume", "Costume"],
]

export function formatUsageBreakdown(entry: ItemUsageEntry): string {
  return BREAKDOWN_LABELS.filter(([key]) => entry[key] > 0)
    .map(([key, label]) => `${label} ${entry[key].toLocaleString("en-US")}`)
    .join(" · ")
}

export function parseOwnedQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim() || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(MAX_OWNED_QUANTITY, Math.max(0, Math.floor(parsed)))
}

/**
 * Text shown in the owned field while editing: digits only, no leading zeros, capped.
 * Empty stays empty so the field can be cleared before typing a new value.
 */
export function normalizeOwnedDraft(input: string): string {
  const digits = input.replace(/\D/g, "")
  if (!digits) return ""
  return String(Math.min(MAX_OWNED_QUANTITY, Number(digits.replace(/^0+(?=\d)/, ""))))
}
