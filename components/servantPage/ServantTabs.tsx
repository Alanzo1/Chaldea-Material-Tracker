"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ServantTab {
  id: string
  label: string
  content: ReactNode
}

// Active tab lives in the URL hash (#skills, #materials, ...) so links and the
// material page's Back button can return to a specific tab of a static page.
export function ServantTabs({ tabs }: { tabs: ServantTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "")

  useEffect(() => {
    const syncFromHash = () => {
      const hashId = window.location.hash.slice(1)
      if (tabs.some((tab) => tab.id === hashId)) setActiveId(hashId)
    }

    syncFromHash()
    window.addEventListener("hashchange", syncFromHash)
    return () => window.removeEventListener("hashchange", syncFromHash)
  }, [tabs])

  const selectTab = (id: string) => {
    setActiveId(id)
    window.history.replaceState(null, "", `#${id}`)
  }

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Servant sections"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {active ? (
        <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
          {active.content}
        </div>
      ) : null}
    </div>
  )
}
