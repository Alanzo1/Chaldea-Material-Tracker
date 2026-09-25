import { ItemBrowser } from "@/components/materials/ItemBrowser"
import { getMaterialsIndex } from "@/lib/atlas-data"

export default function ItemsPage() {
  return <ItemBrowser items={getMaterialsIndex()} />
}
