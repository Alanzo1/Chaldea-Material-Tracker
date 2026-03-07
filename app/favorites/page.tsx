import { getServantsHomePageIndex } from "@/app/services/api"
import { FavoriteServantsTablePage } from "@/components/ServantTable/FavoriteServantsTablePage"

export default async function FavoritesPage() {
  const servants = await getServantsHomePageIndex()

  return <FavoriteServantsTablePage data={servants} />
}
