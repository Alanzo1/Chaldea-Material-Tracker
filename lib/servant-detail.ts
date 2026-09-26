// Normalised servant file ({region data}/servants/{id}.json) used by the servant page. Pure.

export interface ServantDetail {
  id: number
  name: string
  originalName: string | null
  className: string
  rarity: number
  portrait: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeServantDetail(raw: any): ServantDetail {
  return {
    id: Number(raw.id),
    name: String(raw.name),
    originalName: raw.originalName ? String(raw.originalName) : null,
    className: String(raw.className),
    rarity: Number(raw.rarity),
    portrait: (raw.portrait as string | null) ?? null,
    raw,
  }
}
