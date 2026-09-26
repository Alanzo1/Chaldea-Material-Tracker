import { JpQuestPage } from "@/components/jp/JpQuestPage"

// Rendered on demand (not prerendered); the quest loads from public/data-jp in the browser.
export function generateStaticParams() {
  return []
}

export default async function JpFreeQuestPage({ params }: { params: Promise<{ questId: string }> }) {
  const { questId } = await params
  return <JpQuestPage questId={questId} />
}
