import Link from "next/link"

import MaterialFarmingCard from "@/components/materials/MaterialFarmingCard"
import { PageHeader } from "@/components/PageHeader"
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
    <main className="pb-10">
      <PageHeader
        title={itemName}
        subtitle={itemDescription || "Material details and farming locations"}
        actions={
          <Button
            asChild
            className="h-9 rounded-md border-border bg-card px-3.5 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
            variant="outline"
          >
            <Link href={backHref}>Back</Link>
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-6">
        <MaterialFarmingCard
          itemId={Number.isFinite(parsedItemId) ? parsedItemId : 0}
          itemName={itemName}
          itemIcon={itemIcon}
          itemDescription={itemDescription}
          showOwnershipControls
        />
      </div>
    </main>
  )
}
