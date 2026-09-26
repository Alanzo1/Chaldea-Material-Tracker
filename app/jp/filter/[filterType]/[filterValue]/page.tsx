import { JpFilterPage } from "@/components/jp/JpFilterPage"

export function generateStaticParams() {
  return []
}

export default async function JpFilterRoute({ params }: { params: Promise<{ filterType: string; filterValue: string }> }) {
  const { filterType, filterValue } = await params
  return <JpFilterPage filterType={filterType} filterValue={filterValue} />
}
