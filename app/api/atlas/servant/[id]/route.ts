import { NextResponse } from "next/server"

import { getServantData } from "@/app/services/api"

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const servantId = Number(id)

  if (!Number.isFinite(servantId) || servantId <= 0) {
    return NextResponse.json({ error: "Invalid servant id" }, { status: 400 })
  }

  try {
    const servant = await getServantData(servantId)

    return NextResponse.json({
      id: servant.id,
      name: servant.name,
      className: servant.className,
      rarity: servant.rarity,
      portrait: servant.portrait,
      ascensionMaterials: servant.raw?.ascensionMaterials ?? {},
      skillMaterials: servant.raw?.skillMaterials ?? {},
      appendSkillMaterials: servant.raw?.appendSkillMaterials ?? {},
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch servant",
      },
      { status: 500 }
    )
  }
}
