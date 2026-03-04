import { notFound } from "next/navigation"

import { getServantsHomePageIndex } from "@/app/services/api"
import { FilteredServantTablePage } from "@/components/ServantTable/FilteredServantTablePage"

const VALID_FILTERS = new Set(["trait", "alignment", "attribute"])

function normalizeValue(value: string) {
  return decodeURIComponent(value).toLowerCase()
}

function formatLabel(value: string) {
  return decodeURIComponent(value)
}

interface FilterPageProps {
  params: Promise<{
    filterType: string
    filterValue: string
  }>
}

export default async function FilterPage({ params }: FilterPageProps) {
  const { filterType, filterValue } = await params

  if (!VALID_FILTERS.has(filterType)) {
    notFound()
  }

  const servants = await getServantsHomePageIndex()
  const normalizedValue = normalizeValue(filterValue)

  const filteredServants = servants.filter((servant: any) => {
    if (filterType === "trait") {
      return (servant.traits ?? []).some(
        (trait: string) => String(trait).toLowerCase() === normalizedValue
      )
    }

    if (filterType === "alignment") {
      return (servant.alignments ?? []).some(
        (alignment: string) => String(alignment).toLowerCase() === normalizedValue
      )
    }

    return String(servant.attribute ?? "").toLowerCase() === normalizedValue
  })

  const titlePrefix =
    filterType === "trait"
      ? "Trait"
      : filterType === "alignment"
        ? "Alignment"
        : "Attribute"

  return (
    <FilteredServantTablePage
      title={`${titlePrefix}: ${formatLabel(filterValue)}`}
      count={filteredServants.length}
      data={filteredServants}
    />
  )
}
