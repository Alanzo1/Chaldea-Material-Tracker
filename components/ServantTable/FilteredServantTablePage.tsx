"use client"

import Link from "next/link"

import { columns, type Servant } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { PageHeader } from "@/components/PageHeader"
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
    <main className="pb-10">
      <PageHeader
        title={title}
        subtitle={`${count} servant${count === 1 ? "" : "s"} matched this filter.`}
        actions={
          <Button
            asChild
            className="h-9 rounded-md border-border bg-card px-3.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
            variant="outline"
          >
            <Link href="/">Homepage</Link>
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <DataTable columns={columns} data={data} />
      </div>
    </main>
  )
}
