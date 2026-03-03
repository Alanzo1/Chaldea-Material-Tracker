"use client"

import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
}

export function Spinner({ className }: SpinnerProps) {
  return <LoaderCircle className={cn("size-8 animate-spin", className)} />
}
