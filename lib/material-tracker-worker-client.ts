"use client"

import type {
  RequirementTotals,
  TrackedMaterialsState,
  TrackedServantEntry,
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
type WorkerRequestInput = Omit<ComputeStateRequest, "id"> | Omit<ComputeServantRequest, "id">

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

interface PendingRequest {
  resolve: (value: any) => void
  reject: (error: Error) => void
}

let workerInstance: Worker | null = null
let requestId = 0
const pending = new Map<number, PendingRequest>()

function getWorker() {
  if (typeof window === "undefined") return null
  if (workerInstance) return workerInstance

  workerInstance = new Worker(new URL("./material-tracker.worker.ts", import.meta.url), { type: "module" })
  workerInstance.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const payload = event.data
    const request = pending.get(payload.id)
    if (!request) return
    pending.delete(payload.id)

    if ("error" in payload) {
      request.reject(new Error(payload.error))
      return
    }

    request.resolve(payload)
  }
  workerInstance.onerror = () => {
    pending.forEach(({ reject }) => reject(new Error("Tracker worker error")))
    pending.clear()
  }

  return workerInstance
}

function callWorker<T extends WorkerResponse>(message: WorkerRequestInput): Promise<T> {
  const worker = getWorker()
  if (!worker) return Promise.reject(new Error("Worker unavailable"))

  return new Promise<T>((resolve, reject) => {
    const id = ++requestId
    pending.set(id, { resolve, reject })
    worker.postMessage({ ...message, id } as WorkerRequest)
  })
}

export async function computeTrackerStateInWorker(state: TrackedMaterialsState) {
  const response = await callWorker<ComputeStateResponse>({
    type: "computeState",
    state,
  })

  return {
    aggregate: response.aggregate,
    perServantById: response.perServantById,
  }
}

export async function computeServantRequirementsInWorker(
  servant: TrackedServantEntry,
  ownedByMaterialId: Record<string, number>
) {
  const response = await callWorker<ComputeServantResponse>({
    type: "computeServant",
    servant,
    ownedByMaterialId,
  })
  return response.totals
}
