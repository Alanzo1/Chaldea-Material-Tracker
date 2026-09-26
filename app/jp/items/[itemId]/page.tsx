import { JpItemBrowser } from "@/components/jp/JpItemBrowser"

// Rendered on demand (not prerendered); items load from public/data-jp in the browser.
export function generateStaticParams() {
  return []
}

export default async function JpItemPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  return <JpItemBrowser itemId={itemId} />
}
