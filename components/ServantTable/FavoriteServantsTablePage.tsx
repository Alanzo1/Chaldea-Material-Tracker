"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { readFavoriteServantIds } from "@/lib/favorites"
import { columns, type Servant } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { Button } from "@/components/ui/button"

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
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <Button asChild variant="outline">
          <Link href="/">Back to Homepage</Link>
        </Button>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Favorited Servants</h1>
        <p className="text-sm text-muted-foreground">
          {favoritedServants.length} servant{favoritedServants.length === 1 ? "" : "s"} favorited.
        </p>
      </div>
      <DataTable columns={columns} data={favoritedServants} />
    </main>
  )
}
