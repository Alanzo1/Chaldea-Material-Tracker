import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-10 text-primary" />
        <p className="text-sm text-muted-foreground">Loading servant...</p>
      </div>
    </div>
  )
}
