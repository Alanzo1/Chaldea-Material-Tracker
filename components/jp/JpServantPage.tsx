"use client"

import { JpDataState } from "@/components/jp/JpDataState"
import { ServantPageView } from "@/components/servantPage/ServantPageView"
import { normalizeServantDetail } from "@/lib/servant-detail"
import { useJpFile } from "@/lib/use-jp-file"

export function JpServantPage({ id }: { id: string }) {
  const file = useJpFile(/^\d+$/.test(id) ? `servants/${id}.json` : null, normalizeServantDetail)
  if (!/^\d+$/.test(id)) return <JpDataState status="missing" what="servant" />
  if (file.status !== "ready") return <JpDataState status={file.status} what="servant" />
  return <ServantPageView servant={file.data} />
}
