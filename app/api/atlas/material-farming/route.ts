import { NextRequest, NextResponse } from "next/server"
import dropData from "@/data/drop-data.json"

interface FarmingNode {
  id: number
  questName: string
  apCost: number
  dropRate: number
  apPerDrop: number
  runs: number
  warName?: string
  locationName?: string
  questTitle?: string
}

const data = dropData as Record<string, FarmingNode[]>
const CLASS_NAMES = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker"]
const WARS_URL = "https://api.atlasacademy.io/export/NA/nice_war.json"

interface QuestMeta {
  warName: string
  locationName: string
  questTitle: string
}

let questMetaByIdPromise: Promise<Map<number, QuestMeta>> | null = null

const DEFAULT_LIMIT = 3
const MAX_LIMIT = 100
const DEFAULT_MIN_RUNS = 200
const MAX_ALL_RESULTS = 500

function toNumber(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function sanitizeLabel(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  if (/^[-‐‑‒–—―ー－\s]+$/u.test(normalized)) return ""
  return normalized
}

function pickPreferredLabel(primary: unknown, fallback: unknown) {
  const normalizedPrimary = sanitizeLabel(primary)
  if (normalizedPrimary) return normalizedPrimary
  return sanitizeLabel(fallback)
}

function getTrainingGroundNodes(itemId: number): FarmingNode[] {
  const itemGroups = [
    [6001, 6007], // Gem of <Class>
    [6101, 6107], // Magic Gem of <Class>
    [6201, 6207], // Secret Gem of <Class>
    [7001, 7007], // <Class> Piece
    [7101, 7107], // <Class> Monument
  ] as const

  const range = itemGroups.find(([start, end]) => itemId >= start && itemId <= end)
  if (!range) return []

  const classIndex = itemId % 10
  if (classIndex < 1 || classIndex > CLASS_NAMES.length) return []
  const className = CLASS_NAMES[classIndex - 1]

  // APD values follow the benchmark table requested for class materials.
  const templates: Array<{ tier: string; apCost: number; apPerDrop: number }> = [
    { tier: "Intermediate", apCost: 20, apPerDrop: 30 },
    { tier: "Advanced", apCost: 30, apPerDrop: 30 },
    { tier: "Novice", apCost: 10, apPerDrop: 45 },
    { tier: "Expert", apCost: 40, apPerDrop: 55 },
  ]

  return templates.map((template, index) => {
    const dropRate = template.apCost / template.apPerDrop
    return {
      id: -(classIndex * 100 + index + 1),
      questName: `${className} Training Ground - ${template.tier} (Sunday - Chaldea Gate)`,
      apCost: template.apCost,
      dropRate,
      apPerDrop: template.apPerDrop,
      // synthetic rows: large runs value so they are not removed by minRuns filtering
      runs: 999999,
      warName: "Chaldea Gate",
      locationName: `Sunday ${className} Training Ground`,
      questTitle: template.tier,
    }
  })
}

function isPinnedTrainingNode(node: FarmingNode) {
  return Number(node.id) < 0 || node.warName === "Chaldea Gate"
}

function normalizeNode(node: FarmingNode): FarmingNode {
  const normalizedLocationName = sanitizeLabel(node.locationName)
  const normalizedQuestTitle = sanitizeLabel(node.questTitle)
  const normalizedWarName = sanitizeLabel(node.warName)

  if (normalizedLocationName && normalizedQuestTitle) {
    return node
  }

  const rawQuestName = String(node.questName ?? "").trim()
  const separatorIndex = rawQuestName.indexOf(" - ")
  if (separatorIndex < 0) {
    return {
      ...node,
      warName: normalizedWarName || undefined,
      questTitle: normalizedQuestTitle || sanitizeLabel(rawQuestName),
      locationName: normalizedLocationName || "",
    }
  }

  const locationName = sanitizeLabel(rawQuestName.slice(0, separatorIndex))
  const questTitle = sanitizeLabel(rawQuestName.slice(separatorIndex + 3))
  return {
    ...node,
    warName: normalizedWarName || undefined,
    locationName: normalizedLocationName || locationName,
    questTitle: normalizedQuestTitle || questTitle,
  }
}

async function getQuestMetaById() {
  if (!questMetaByIdPromise) {
    questMetaByIdPromise = (async () => {
      try {
        const response = await fetch(WARS_URL, {
          next: { revalidate: 86400 },
        })
        if (!response.ok) {
          return new Map<number, QuestMeta>()
        }

        const wars = await response.json()
        const questMetaById = new Map<number, QuestMeta>()

        for (const war of toArray<Record<string, unknown>>(wars)) {
          const warName = sanitizeLabel(war?.name) || sanitizeLabel(war?.longName)
          for (const spot of toArray<Record<string, unknown>>(war?.spots)) {
            const locationName = sanitizeLabel(spot?.name) || sanitizeLabel(spot?.longName)
            for (const quest of toArray<Record<string, unknown>>(spot?.quests)) {
              const questId = Number(quest?.id)
              if (!Number.isFinite(questId) || questId <= 0 || questMetaById.has(questId)) {
                continue
              }

              const questTitle = sanitizeLabel(quest?.name)
              questMetaById.set(questId, {
                warName,
                locationName,
                questTitle,
              })
            }
          }
        }

        return questMetaById
      } catch {
        return new Map<number, QuestMeta>()
      }
    })()
  }

  return questMetaByIdPromise
}

function enrichWithQuestMeta(node: FarmingNode, questMetaById: Map<number, QuestMeta>) {
  const questId = Number(node.id)
  if (!Number.isFinite(questId) || questId <= 0) return node

  const metadata = questMetaById.get(questId)
  if (!metadata) return node

  return {
    ...node,
    warName: pickPreferredLabel(node.warName, metadata.warName) || undefined,
    locationName: pickPreferredLabel(node.locationName, metadata.locationName) || undefined,
    questTitle: pickPreferredLabel(node.questTitle, metadata.questTitle) || undefined,
  }
}

export async function GET(request: NextRequest) {
  const itemId = request.nextUrl.searchParams.get("itemId")

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 })
  }

  const numericItemId = toNumber(itemId, 0)
  if (!Number.isInteger(numericItemId) || numericItemId <= 0) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400 })
  }

  if (numericItemId === 6999) {
    return NextResponse.json({ nodes: [] })
  }

  const all = ["1", "true", "yes"].includes(
    String(request.nextUrl.searchParams.get("all") ?? "").toLowerCase()
  )
  const limit = clamp(
    toNumber(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT),
    1,
    MAX_LIMIT
  )
  const minRuns = Math.max(0, toNumber(request.nextUrl.searchParams.get("minRuns"), DEFAULT_MIN_RUNS))

  const rawNodes = Array.isArray(data[itemId]) ? [...data[itemId]] : []
  const trainingGroundNodes = getTrainingGroundNodes(numericItemId)
  trainingGroundNodes.forEach((trainingNode) => {
    if (!rawNodes.some((node) => node.questName === trainingNode.questName)) {
      rawNodes.push(trainingNode)
    }
  })

  if (!rawNodes.length) {
    return NextResponse.json({ nodes: [] })
  }

  const normalizedNodes = rawNodes.map(normalizeNode)
  const needsQuestMeta = normalizedNodes.some((node) => Number(node.id) > 0)
  const questMetaById = needsQuestMeta ? await getQuestMetaById() : null
  const enrichedNodes = questMetaById
    ? normalizedNodes.map((node) => enrichWithQuestMeta(node, questMetaById))
    : normalizedNodes
  const sortedNodes = [...enrichedNodes].sort((a, b) => {
    const aApPerDrop = Number.isFinite(a.apPerDrop) ? a.apPerDrop : Number.POSITIVE_INFINITY
    const bApPerDrop = Number.isFinite(b.apPerDrop) ? b.apPerDrop : Number.POSITIVE_INFINITY
    return aApPerDrop - bApPerDrop
  })
  const filteredNodes = all
    ? sortedNodes
    : sortedNodes.filter((node) => Number(node.runs ?? 0) >= minRuns || Number(node.id) <= 0)

  let nodes: FarmingNode[] = []
  if (all) {
    nodes = filteredNodes.slice(0, MAX_ALL_RESULTS)
  } else {
    const pinnedNodes = filteredNodes.filter(isPinnedTrainingNode)
    const normalNodes = filteredNodes.filter((node) => !isPinnedTrainingNode(node))
    const targetCount = Math.max(limit, pinnedNodes.length)
    nodes = [...pinnedNodes, ...normalNodes].slice(0, targetCount)
  }

  return NextResponse.json({ nodes })
}
