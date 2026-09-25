"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ArtOption {
  id: string
  label: string
  url: string
  /** Round face icon for the switcher; options without one show `shortLabel`. */
  faceUrl?: string
  /** No face icon exists (costumes): crop the head out of the full art instead. */
  cropFaceFromArt?: boolean
  shortLabel?: string
}

interface ServantArtPanelProps {
  name: string
  options: ArtOption[]
  actions?: ReactNode
}

export function ServantArtPanel({ name, options, actions }: ServantArtPanelProps) {
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "")
  const active = options.find((option) => option.id === selectedId) ?? options[0]

  return (
    <div className="relative h-[55vh] min-h-80 overflow-clip rounded-xl border border-border bg-card lg:h-full">
      {active ? (
        <>
          {/* Blurred copy of the art as the backdrop, like the in-game profile screen. */}
          <Image
            src={active.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="scale-110 object-cover opacity-40 blur-2xl"
            aria-hidden="true"
          />
          <Image
            key={active.id}
            src={active.url}
            alt={`${name} – ${active.label}`}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-contain p-4 pt-28 sm:pt-20"
          />
        </>
      ) : null}

      {active && options.length > 1 ? (
        <p className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-background/70 px-3 py-1.5 text-sm font-medium text-foreground backdrop-blur">
          {active.label}
        </p>
      ) : null}

      <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-3">
        <Link
          href="/"
          className="flex h-10 items-center gap-2 rounded-full bg-background/70 px-4 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-background/90"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Servants
        </Link>

        {options.length > 1 ? (
          <div
            className="order-last flex w-full min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] sm:order-none sm:w-auto sm:flex-1"
            role="group"
            aria-label="Art version"
          >
            {options.map((option) => {
              const isActive = option.id === active?.id
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={isActive}
                  onClick={() => setSelectedId(option.id)}
                  className={cn(
                    "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-background/70 text-xs font-bold text-foreground backdrop-blur transition",
                    isActive ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  {option.faceUrl ? (
                    <Image src={option.faceUrl} alt="" fill sizes="40px" className="object-cover" />
                  ) : option.cropFaceFromArt ? (
                    <Image
                      src={option.url}
                      alt=""
                      fill
                      sizes="120px"
                      className="origin-[50%_8%] scale-[2.6] object-cover object-top"
                    />
                  ) : (
                    option.shortLabel
                  )}
                </button>
              )
            })}
          </div>
        ) : null}

        {actions ? <div className="ml-auto">{actions}</div> : null}
      </div>
    </div>
  )
}
