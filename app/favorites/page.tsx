import { getServantsIndex } from "@/lib/atlas-data"
import { FavoriteServantsTablePage } from "@/components/ServantTable/FavoriteServantsTablePage"

export default function FavoritesPage() {
  const servants = getServantsIndex()

  return <FavoriteServantsTablePage data={servants} />
}
