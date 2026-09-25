// Tile/icon backdrop by Atlas item rarity frame.
export const ITEM_BACKGROUND_CLASS: Record<string, string> = {
  bronze: "bg-gradient-to-b from-amber-800/50 to-amber-950/40",
  silver: "bg-gradient-to-b from-slate-300/35 to-slate-500/20",
  gold: "bg-gradient-to-b from-yellow-400/40 to-amber-600/25",
}

export function itemBackgroundClass(background: string) {
  return ITEM_BACKGROUND_CLASS[background] ?? "bg-muted"
}
