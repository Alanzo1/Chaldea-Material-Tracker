import { LoadingState } from "@/components/ui/spinner"

// Shared loading / not-found / error states for JP pages that load their data in the browser.
export function JpDataState({ status, what }: { status: "loading" | "missing" | "error"; what: string }) {
  if (status === "loading") return <LoadingState label={`Loading ${what}…`} className="min-h-[50vh]" />
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-20 text-center text-sm text-muted-foreground">
      {status === "missing" ? `This ${what} isn't in the JP data.` : `Couldn't load this ${what}. Refresh to try again.`}
    </div>
  )
}
