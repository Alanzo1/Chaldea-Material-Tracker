import Link from "next/link"

import MaterialFarmingCard from "@/components/materials/MaterialFarmingCard"
import { Button } from "@/components/ui/button"

interface MaterialPageProps {
  params: Promise<{
    itemId: string
  }>
  searchParams: Promise<{
    name?: string
    icon?: string
    detail?: string
    returnTo?: string
  }>
}

function decodeParam(value?: string) {
  if (!value) return ""
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default async function MaterialPage({
  params,
  searchParams,
}: MaterialPageProps) {
  const { itemId } = await params
  const resolvedSearchParams = await searchParams

  const parsedItemId = Number(itemId)
  const itemName = decodeParam(resolvedSearchParams.name) || `Material ${itemId}`
  const itemIcon = decodeParam(resolvedSearchParams.icon)
  const itemDescription = decodeParam(resolvedSearchParams.detail)
  const returnTo = decodeParam(resolvedSearchParams.returnTo)
  const backHref = returnTo.startsWith("/") ? returnTo : "/"

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div>
        <Button asChild variant="outline">
          <Link href={backHref}>Back to Servant</Link>
        </Button>
      </div>

      <MaterialFarmingCard
        itemId={Number.isFinite(parsedItemId) ? parsedItemId : 0}
        itemName={itemName}
        itemIcon={itemIcon}
        itemDescription={itemDescription}
      />
    </main>
  )
}
