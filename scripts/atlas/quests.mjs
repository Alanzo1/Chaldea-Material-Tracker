import { originalName } from "./names.mjs"
// Keep phases separate: first-clear battles can differ from the repeatable phase.
export function selectFreeQuestJobs(wars) {
  const jobs = new Map()
  for (const war of wars ?? []) {
    for (const spot of war.spots ?? []) {
      for (const quest of spot.quests ?? []) {
        if (quest.type !== "free") continue
        for (const phase of quest.phases ?? []) {
          if (!(quest.id > 0 && phase > 0)) continue
          jobs.set(`${quest.id}/${phase}`, {
            questId: quest.id,
            phase,
            name: quest.name,
            ...originalName(quest),
            repeatable: quest.afterClear === "repeatLast" && phase === Math.max(...quest.phases),
            banner: war.banner || null,
            warId: war.id,
            warName: war.longName || war.name,
            spotId: spot.id,
            spotName: spot.name,
            ...originalName(spot, "spotOriginalName"),
            // Unique isometric icon for this location on the in-game quest map (256×256 PNG).
            spotImage: spot.image || null,
            apCost: ["ap", "apAndItem"].includes(quest.consumeType) ? quest.consume : null,
            entryItems: (quest.consumeItem ?? []).map(({ item, amount }) => ({
              id: item.id, name: item.name, amount,
            })),
          })
        }
      }
    }
  }
  return [...jobs.values()].sort((a, b) => a.questId - b.questId || a.phase - b.phase)
}

export function trimFreeQuestPhase(job, detail, items = []) {
  const stages = (detail?.stages ?? []).map((stage) => ({
    wave: stage.wave,
    enemies: (stage.enemies ?? []).map((enemy) => ({
      id: enemy.svt?.id ?? null,
      name: enemy.name || enemy.svt?.name || "Unknown enemy",
      className: enemy.svt?.className ?? null,
      attribute: enemy.svt?.attribute ?? null,
      icon: enemy.svt?.face ?? null,
      level: enemy.lv ?? null,
      hp: enemy.hp ?? null,
      attack: enemy.atk ?? null,
      // Preserve reserve/extra enemies without presenting them as starting enemies.
      deck: enemy.deck ?? null,
      deckId: enemy.deckId ?? null,
      traits: [...new Map([...(enemy.svt?.traits ?? []), ...(enemy.traits ?? [])]
        .map((trait) => [trait.id, trait])).values()].sort((a, b) => a.id - b.id),
    })),
  })).sort((a, b) => a.wave - b.wave)

  const itemById = new Map(items.map((item) => [item.id, item]))
  const drops = (detail?.drops ?? []).map((drop) => {
    const item = itemById.get(drop.objectId)
    const runs = Number(drop.runs ?? 0)
    const count = Number(drop.dropCount ?? 0)
    const quantity = Number(drop.num ?? 1)
    const perRun = runs > 0 ? count / runs * quantity : null
    return {
      id: drop.objectId, type: drop.type, name: item?.name ?? `Item ${drop.objectId}`,
      icon: item?.icon ?? null, runs, perRun,
      apPerItem: perRun > 0 && job.apCost !== null ? job.apCost / perRun : null,
    }
  })
  return {
    ...job,
    status: detail ? "available" : "unavailable",
    enemyDataAvailable: stages.some((stage) => stage.enemies.length > 0),
    recommendedLevel: detail?.recommendLv ?? null,
    bond: detail?.bond ?? null,
    experience: detail?.exp ?? null,
    qp: detail?.qp ?? null,
    enemyHash: detail?.enemyHash ?? null,
    drops,
    stages,
  }
}

// Class/attribute traits duplicate the class and attribute filters, so they are left out here.
const FILTER_HIDDEN_TRAIT = /^(class|attribute)[A-Z]/

const sortedUnique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))

// Compact per-quest facts for the free-quest browser filters (lives on each index entry).
export function summarizeQuestPhase(file) {
  const enemies = (file.stages ?? []).flatMap((stage) => stage.enemies ?? [])
  return {
    enemyClasses: sortedUnique(enemies.map((enemy) => enemy.className)),
    enemyAttributes: sortedUnique(enemies.map((enemy) => enemy.attribute)),
    enemyTraits: sortedUnique(
      enemies.flatMap((enemy) => (enemy.traits ?? []).map((trait) => trait.name)).filter((name) => !FILTER_HIDDEN_TRAIT.test(name))
    ),
    drops: (file.drops ?? []).map(({ id, name, icon }) => ({ id, name, icon })),
  }
}

export function buildFreeQuestData(jobs, results, items = []) {
  const details = new Map(results.filter(Boolean).map(({ job, detail }) => [
    `${job.questId}/${job.phase}`, detail,
  ]))
  const phases = {}
  const index = jobs.map((job) => {
    const key = `${job.questId}/${job.phase}`
    if (!details.has(key)) throw new Error(`Missing free quest fetch result: ${key}`)
    const file = trimFreeQuestPhase(job, details.get(key), items)
    phases[key] = file
    return { ...job, status: file.status, enemyDataAvailable: file.enemyDataAvailable, ...summarizeQuestPhase(file) }
  })
  return { index, phases }
}
