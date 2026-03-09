"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { readFavoriteServantIds } from "@/lib/favorites"
import { columns, type Servant } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { PageHeader } from "@/components/PageHeader"
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
    <main className="pb-10">
      <PageHeader
        title="Favorited Servants"
        subtitle={`${favoritedServants.length} servant${favoritedServants.length === 1 ? "" : "s"} favorited.`}
        actions={
          <>
            <Button
              asChild
              className="h-9 rounded-md border-border bg-card px-3.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              <Link href="/">Homepage</Link>
            </Button>
            <Button
              asChild
              className="h-9 rounded-md border-border bg-card px-3.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
              variant="outline"
            >
              <Link href="/track-materials">Tracker</Link>
            </Button>
          </>
        }
      />
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <DataTable columns={columns} data={favoritedServants} />
      </div>
    </main>
  )
}
