"use client"

import { columns, type Servant } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { PageHeader } from "@/components/PageHeader"

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pt-6">
        <PageHeader
          title={title}
          subtitle={`${count} servant${count === 1 ? "" : "s"} matched this filter.`}
        />
        <DataTable columns={columns} data={data} />
      </div>
    </main>
  )
}
