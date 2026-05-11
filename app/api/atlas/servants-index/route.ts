import { NextResponse } from "next/server"

import { getServantsHomePageIndex } from "@/app/services/api"

export async function GET() {
  try {
    const servants = await getServantsHomePageIndex()
    return NextResponse.json({ servants })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch servants index",
      },
      { status: 500 }
    )
  }
}
