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
  perServantById: Record<string, RequirementTotals>
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
      const perServantById: Record<string, RequirementTotals> = {}

      payload.state.servants.forEach((servant) => {
        perServantById[String(servant.servantId)] = calculateServantRequirements(
          servant,
          payload.state.ownedByMaterialId
        )
      })

      postResponse({
        id: payload.id,
        type: "computeState",
        aggregate,
        perServantById,
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
