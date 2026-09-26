import { JpServantPage } from "@/components/jp/JpServantPage"

// Rendered on demand (not prerendered) and cached; the page loads public/data-jp in the browser.
export function generateStaticParams() {
  return []
}

export default async function JpServantRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JpServantPage id={id} />
}
