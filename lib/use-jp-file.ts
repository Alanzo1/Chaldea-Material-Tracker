"use client"

import { useEffect, useState } from "react"

export type JpFileState<T> = { status: "loading" | "missing" | "error"; data: null } | { status: "ready"; data: T }

// One JSON file from public/data-jp for a JP detail page (not prerendered, so loaded here).
export function useJpFile<T>(path: string | null, transform: (raw: unknown) => T = (raw) => raw as T): JpFileState<T> {
  const [state, setState] = useState<{ path: string | null; value: JpFileState<T> }>({ path, value: { status: "loading", data: null } })

  useEffect(() => {
    if (!path) return
    let cancelled = false
    fetch(`/data-jp/${path}`, { cache: "force-cache" })
      .then(async (response) => {
        if (response.status === 404) return { status: "missing", data: null } as const
        if (!response.ok) throw new Error(String(response.status))
        return { status: "ready", data: transform(await response.json()) } as const
      })
      .then((value) => { if (!cancelled) setState({ path, value }) })
      .catch(() => { if (!cancelled) setState({ path, value: { status: "error", data: null } }) })
    return () => { cancelled = true }
    // transform is a pure mapping supplied inline; the file path is the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  return state.path === path ? state.value : { status: "loading", data: null }
}
