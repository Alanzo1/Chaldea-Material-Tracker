"use client"

import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return <LoaderCircle className={cn("size-8 animate-spin", className)} />
}

// Inline loading placeholder: a spinner with a short label, announced to screen readers.
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground", className)}>
      <Spinner className="size-8 text-primary" />
      <span>{label}</span>
    </div>
  )
}
