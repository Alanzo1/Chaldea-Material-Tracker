import { Spinner } from "@/components/ui/spinner"

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="size-10 text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </main>
  )
}
