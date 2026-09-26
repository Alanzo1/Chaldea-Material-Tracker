"use client"

import { useServants } from "@/app/contexts/HomePageContext"
import { JpDataState } from "@/components/jp/JpDataState"
import { FilteredServantTablePage } from "@/components/ServantTable/FilteredServantTablePage"
import { filterServantsByRoute } from "@/lib/servant-filter-route"

export function JpFilterPage({ filterType, filterValue }: { filterType: string; filterValue: string }) {
  const { servants, servantsStatus } = useServants()
  if (servantsStatus !== "ready") return <JpDataState status={servantsStatus === "error" ? "error" : "loading"} what="servant list" />
  const result = filterServantsByRoute(servants, filterType, filterValue)
  if (!result) return <JpDataState status="missing" what="filter" />
  return <FilteredServantTablePage title={result.title} count={result.servants.length} data={result.servants} />
}
