"use client"

import { useEffect, useMemo, useState } from "react"
import { Home, ListChecks } from "lucide-react"

import { readFavoriteServantIds } from "@/lib/favorites"
import { HeaderActionLink } from "@/components/HeaderActionLink"
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
      <PageHeader
        title="Favorited Servants"
        subtitle={`${favoritedServants.length} servant${favoritedServants.length === 1 ? "" : "s"} favorited.`}
        actions={
          <>
            <HeaderActionLink href="/" icon={<Home className="size-3.5" />} label="Homepage" />
            <HeaderActionLink href="/track-materials" icon={<ListChecks className="size-3.5" />} label="Tracker" />
          </>
        }
      />
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <DataTable columns={columns} data={favoritedServants} />
      </div>
    </main>
  )
}
