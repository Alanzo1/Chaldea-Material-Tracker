import { notFound } from "next/navigation"

import { getServantsIndex } from "@/lib/atlas-data"
import { FilteredServantTablePage } from "@/components/ServantTable/FilteredServantTablePage"
import { filterServantsByRoute } from "@/lib/servant-filter-route"

interface FilterPageProps {
  params: Promise<{
    filterType: string
    filterValue: string
  }>
}

export default async function FilterPage({ params }: FilterPageProps) {
  const { filterType, filterValue } = await params
  const result = filterServantsByRoute(getServantsIndex(), filterType, filterValue)
  if (!result) notFound()

  return <FilteredServantTablePage title={result.title} count={result.servants.length} data={result.servants} />
}
