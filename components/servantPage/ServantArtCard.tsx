"use client"

import { useState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ArtOption {
  label: string
  url: string
}

interface ServantArtCardProps {
  name: string
  options: ArtOption[]
}

export function ServantArtCard({ name, options }: ServantArtCardProps) {
  const [selected, setSelected] = useState(options[0]?.url ?? "")
  const activeOption = options.find((option) => option.url === selected) ?? options[0]

  if (!activeOption) return null

  return (
    <Card className="w-fit">
      <CardHeader className="gap-3">
      </CardHeader>
      <CardContent className="space-y-4">
        <Image
          src={activeOption.url}
          alt={`${name} ${activeOption.label}`}
          width={320}
          height={320}
          priority
          className="rounded-md"
        />
        <div className="flex max-w-[320px] flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.url}
              variant={option.url === activeOption.url ? "default" : "outline"}
              size="sm"
              onClick={() => setSelected(option.url)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
