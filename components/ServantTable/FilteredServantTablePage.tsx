"use client"

import { Home } from "lucide-react"

import { HeaderActionLink } from "@/components/HeaderActionLink"
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
      <PageHeader
        title={title}
        subtitle={`${count} servant${count === 1 ? "" : "s"} matched this filter.`}
        actions={
          <HeaderActionLink href="/" icon={<Home className="size-3.5" />} label="Homepage" />
        }
      />
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <DataTable columns={columns} data={data} />
      </div>
    </main>
  )
}
