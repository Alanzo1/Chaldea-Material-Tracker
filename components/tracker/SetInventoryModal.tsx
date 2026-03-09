"use client"

import Image from "next/image"
import { useMemo, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

interface MaterialListItem {
  id: number
  name: string
  icon: string
}

interface AggregateMaterial {
  amount: number
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              viewBox="0 0 14 14"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
            >
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  getKey,
  renderItem,
  className,
}: {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  getKey: (item: T, index: number) => string | number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2
  const endIndex = Math.min(items.length, startIndex + visibleCount)
  const offsetY = startIndex * itemHeight
  const visibleItems = items.slice(startIndex, endIndex)

  return (
    <div
      className={cn("overflow-y-auto", className)}
      style={{ maxHeight: containerHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="relative w-full" style={{ height: totalHeight }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const absoluteIndex = startIndex + index
            return (
              <div key={getKey(item, absoluteIndex)} style={{ height: itemHeight }}>
                {renderItem(item, absoluteIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function SetInventoryModal({
  onClose,
  materials,
  aggregateByMaterialId,
  ownedByMaterialId,
  onSave,
  formatNumber,
}: {
  onClose: () => void
  materials: MaterialListItem[]
  aggregateByMaterialId: Map<number, AggregateMaterial>
  ownedByMaterialId: Record<string, number>
  onSave: (materialId: number, rawValue: string) => void
  formatNumber: (value: number) => string
}) {
  const [query, setQuery] = useState("")
  const [pendingOwnedByMaterialId, setPendingOwnedByMaterialId] = useState<Record<number, string>>({})

  const filteredMaterialResults = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return materials.slice(0, 500)
    return materials
      .filter((material) => String(material.name ?? "").toLowerCase().includes(normalized))
      .slice(0, 500)
  }, [materials, query])

  return (
    <Modal title="Set Material Inventory" onClose={onClose}>
      <input
        autoFocus
        placeholder="Search material name..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
      />
      {filteredMaterialResults.length ? (
        <VirtualizedList
          items={filteredMaterialResults}
          itemHeight={78}
          containerHeight={470}
          className="mt-3 pr-1"
          getKey={(material) => material.id}
          renderItem={(material) => {
            const agg = aggregateByMaterialId.get(material.id)
            const neededAmount = Number(agg?.amount ?? 0)
            const ownedAmount = Number(ownedByMaterialId[String(material.id)] ?? 0)
            const inputValue = pendingOwnedByMaterialId[material.id] ?? String(Math.max(0, ownedAmount))

            return (
              <div className="pb-1.5">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-2.5">
                  <Image src={material.icon} alt={material.name} width={22} height={22} className="rounded-sm flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground/90">{material.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Need {formatNumber(neededAmount)} · Owned {formatNumber(ownedAmount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={inputValue}
                      onChange={(event) =>
                        setPendingOwnedByMaterialId((prev) => ({ ...prev, [material.id]: event.target.value }))
                      }
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onSave(material.id, inputValue)}
                      className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-400 transition-all hover:border-amber-500/50 hover:bg-amber-500/15"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )
          }}
        />
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">No matching materials.</p>
      )}
    </Modal>
  )
}
