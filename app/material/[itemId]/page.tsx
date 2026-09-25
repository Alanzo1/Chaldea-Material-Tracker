import { notFound } from "next/navigation"

import { ItemBrowser } from "@/components/materials/ItemBrowser"
import { getMaterial, getMaterialsIndex } from "@/lib/atlas-data"

interface MaterialPageProps {
  params: Promise<{ itemId: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getMaterialsIndex().map((material) => ({ itemId: String(material.id) }))
}

export default async function MaterialPage({ params }: MaterialPageProps) {
  const { itemId } = await params
  const material = getMaterial(Number(itemId))
  if (!material) notFound()

  return <ItemBrowser items={getMaterialsIndex()} selected={material} />
}
