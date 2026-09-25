"use client"

import { useEffect, useState } from "react"

import type { ItemFile } from "@/lib/atlas-types"

const EMPTY: ItemFile = { nodes: [], usage: [] }

type Status = "loading" | "ready" | "error"

// Loads public/data/items/{id}.json (Sources + Usage for one material).
export function useItemFile(itemId: number) {
  const [state, setState] = useState<{ status: Status; file: ItemFile }>({ status: "loading", file: EMPTY })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading", file: EMPTY })

    fetch(`/data/items/${itemId}.json`, { cache: "force-cache" })
      .then(async (response) => {
        if (response.status === 404) return EMPTY
        if (!response.ok) throw new Error(`Item data request failed (${response.status})`)
        return (await response.json()) as Partial<ItemFile>
      })
      .then((file) => {
        if (cancelled) return
        setState({
          status: "ready",
          file: {
            nodes: Array.isArray(file.nodes) ? file.nodes : [],
            usage: Array.isArray(file.usage) ? file.usage : [],
          },
        })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", file: EMPTY })
      })

    return () => {
      cancelled = true
    }
  }, [itemId, attempt])

  return { ...state.file, status: state.status, retry: () => setAttempt((count) => count + 1) }
}
