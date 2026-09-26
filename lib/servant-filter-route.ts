// /filter/{type}/{value} (and /jp/filter/...): servants sharing one trait, alignment or attribute. Pure.

interface FilterableServant {
  attribute?: string
  alignments?: string[]
  traits?: string[]
}

const TITLES: Record<string, string> = { trait: "Trait", alignment: "Alignment", attribute: "Attribute" }

export function filterServantsByRoute<T extends FilterableServant>(servants: T[], filterType: string, filterValue: string) {
  if (!TITLES[filterType]) return null
  const label = decodeURIComponent(filterValue)
  const wanted = label.toLowerCase()
  const matches = (values: string[] | undefined) => (values ?? []).some((value) => String(value).toLowerCase() === wanted)
  return {
    title: `${TITLES[filterType]}: ${label}`,
    servants: servants.filter((servant) =>
      filterType === "trait"
        ? matches(servant.traits)
        : filterType === "alignment"
          ? matches(servant.alignments)
          : String(servant.attribute ?? "").toLowerCase() === wanted
    ),
  }
}
