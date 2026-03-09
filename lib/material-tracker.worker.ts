import {
  calculateAggregateRequirements,
  calculateServantRequirements,
  type RequirementTotals,
  type TrackedMaterialsState,
  type TrackedServantEntry,
} from "@/lib/material-tracker"

interface ComputeStateRequest {
  id: number
  type: "computeState"
  state: TrackedMaterialsState
}

interface ComputeServantRequest {
  id: number
  type: "computeServant"
  servant: TrackedServantEntry
  ownedByMaterialId: Record<string, number>
}

type WorkerRequest = ComputeStateRequest | ComputeServantRequest

interface ComputeStateResponse {
  id: number
  type: "computeState"
  aggregate: RequirementTotals
  perServantSummaryById: Record<string, { progressPercent: number; remainingCount: number }>
}

interface ComputeServantResponse {
  id: number
  type: "computeServant"
  totals: RequirementTotals
}

interface ErrorResponse {
  id: number
  error: string
}

type WorkerResponse = ComputeStateResponse | ComputeServantResponse | ErrorResponse

function postResponse(response: WorkerResponse) {
  self.postMessage(response)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data

  try {
    if (payload.type === "computeState") {
      const aggregate = calculateAggregateRequirements(payload.state)
      const perServantSummaryById: Record<string, { progressPercent: number; remainingCount: number }> = {}

      payload.state.servants.forEach((servant) => {
        const totals = calculateServantRequirements(
          servant,
          payload.state.ownedByMaterialId
        )
        perServantSummaryById[String(servant.servantId)] = {
          progressPercent: totals.progressPercent,
          remainingCount: totals.materialsWithOwned.filter((item) => item.remaining > 0).length,
        }
      })

      postResponse({
        id: payload.id,
        type: "computeState",
        aggregate,
        perServantSummaryById,
      })
      return
    }

    const totals = calculateServantRequirements(payload.servant, payload.ownedByMaterialId)
    postResponse({
      id: payload.id,
      type: "computeServant",
      totals,
    })
  } catch (error) {
    postResponse({
      id: payload.id,
      error: error instanceof Error ? error.message : "Failed to compute tracker requirements",
    })
  }
}
