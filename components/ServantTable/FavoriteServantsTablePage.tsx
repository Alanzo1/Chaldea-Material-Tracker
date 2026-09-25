"use client"

import { useEffect, useMemo, useState } from "react"

import { readFavoriteServantIds } from "@/lib/favorites"
import { columns, type Servant } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { PageHeader } from "@/components/PageHeader"

interface FavoriteServantsTablePageProps {
  data: Servant[]
}

export function FavoriteServantsTablePage({ data }: FavoriteServantsTablePageProps) {
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])

  useEffect(() => {
    setFavoriteIds(readFavoriteServantIds())
  }, [])

  const favoritedServants = useMemo(
    () => data.filter((servant) => favoriteIds.includes(Number(servant.id))),
    [data, favoriteIds]
  )

  return (
    <main className="pb-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pt-6">
        <PageHeader
          title="Favorited Servants"
          subtitle={`${favoritedServants.length} servant${favoritedServants.length === 1 ? "" : "s"} favorited.`}
        />
        <DataTable columns={columns} data={favoritedServants} />
      </div>
    </main>
  )
}
