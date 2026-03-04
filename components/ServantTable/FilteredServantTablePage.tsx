"use client"

import Link from "next/link"

import { columns, type Servant } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { Button } from "@/components/ui/button"

interface FilteredServantTablePageProps {
  title: string
  count: number
  data: Servant[]
}

export function FilteredServantTablePage({
  title,
  count,
  data,
}: FilteredServantTablePageProps) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <Button asChild variant="outline">
          <Link href="/">Back to Homepage</Link>
        </Button>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {count} servant{count === 1 ? "" : "s"} matched this filter.
        </p>
      </div>
      <DataTable columns={columns} data={data} />
    </main>
  )
}
