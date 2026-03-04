"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ServantMetaCardProps {
  traits: string[]
  attribute: string
  alignments: string[]
}

function formatValue(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function ServantMetaCard({
  traits,
  attribute,
  alignments,
}: ServantMetaCardProps) {
  const formattedAttribute = formatValue(attribute)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Traits & Alignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="font-medium text-muted-foreground">Attribute</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/filter/attribute/${encodeURIComponent(formattedAttribute)}`}
                  prefetch={false}
                >
                  {formattedAttribute}
                </Link>
              </Button>
            </div>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Alignment</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {alignments.length ? (
                alignments.map((alignment) => (
                  <Button asChild key={alignment} size="sm" variant="outline">
                    <Link
                      href={`/filter/alignment/${encodeURIComponent(alignment)}`}
                      prefetch={false}
                    >
                      {alignment}
                    </Link>
                  </Button>
                ))
              ) : (
                <p>None</p>
              )}
            </div>
          </div>
        </div>
        <div>
          <p className="font-medium text-muted-foreground">Traits</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {traits.length ? (
              traits.map((trait) => (
                <Button asChild key={trait} size="sm" variant="outline">
                  <Link
                    href={`/filter/trait/${encodeURIComponent(trait)}`}
                    prefetch={false}
                  >
                    {trait}
                  </Link>
                </Button>
              ))
            ) : (
              <p>None</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
