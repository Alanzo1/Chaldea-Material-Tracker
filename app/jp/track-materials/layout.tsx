import { PlanningRegionGuard } from "@/components/tracker/PlanningRegionGuard"

export default function PlanningLayout({ children }: { children: React.ReactNode }) {
  return <PlanningRegionGuard>{children}</PlanningRegionGuard>
}
