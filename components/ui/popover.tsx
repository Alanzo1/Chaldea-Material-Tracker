"use client"

import * as React from "react"
import { Popover } from "radix-ui"

import { cn } from "@/lib/utils"

function PopoverRoot(props: React.ComponentProps<typeof Popover.Root>) {
  return <Popover.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: React.ComponentProps<typeof Popover.Trigger>) {
  return <Popover.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-96 rounded-md border bg-background p-4 text-foreground shadow-md outline-none",
          className
        )}
        {...props}
      />
    </Popover.Portal>
  )
}

export { PopoverRoot as Popover, PopoverTrigger, PopoverContent }
