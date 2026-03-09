import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"

import { getServantsHomePageIndex } from "@/app/services/api"

const getCachedServantsIndex = unstable_cache(
  async () => getServantsHomePageIndex(),
  ["atlas:servants-index"],
  {
    revalidate: 86400,
    tags: ["atlas:servants-index"],
  }
)

export async function GET() {
  try {
    const servants = await getCachedServantsIndex()
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
