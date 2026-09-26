import { ServantPageView } from "@/components/servantPage/ServantPageView"
import { getServantDetail, getServantsIndex } from "@/lib/atlas-data"

interface ServantPageProps {
  params: Promise<{
    id: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getServantsIndex().map((servant) => ({ id: String(servant.id) }))
}

export default async function ServantPage({ params }: ServantPageProps) {
  const { id } = await params
  return <ServantPageView servant={await getServantDetail(Number(id))} />
}
