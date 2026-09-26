"use client"

import { useEffect, useState } from "react"

// Large indexes (servants, free quests) are fetched from public/data once per browser session
// instead of being embedded in every pre-rendered page. Embedding them made each page carry
// ~0.4–1.7 MB of duplicated JSON and each deployment ~1.8 GB.
const cache = new Map<string, Promise<unknown>>()

function load(url: string): Promise<unknown> {
  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`)
      return response.json()
    })
    // Let a failed request be retried on the next mount instead of caching the failure.
    pending.catch(() => cache.delete(url))
    cache.set(url, pending)
  }
  return pending
}

export type StaticJsonStatus = "loading" | "ready" | "error"

export function useStaticJson<T>(url: string, fallback: T): { data: T; status: StaticJsonStatus } {
  const [state, setState] = useState<{ data: T; status: StaticJsonStatus }>({ data: fallback, status: "loading" })

  useEffect(() => {
    let cancelled = false
    load(url)
      .then((data) => {
        if (!cancelled) setState({ data: data as T, status: "ready" })
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, status: "error" }))
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return state
}
