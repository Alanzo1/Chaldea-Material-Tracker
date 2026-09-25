function capitalizeFirstLetter(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1)
}

function normalizeEffectLabel(val) {
  return String(val ?? "")
    .toLowerCase()
    .replace(/[\[\]]/g, "")
    .trim()
}

function normalizeSourceName(val) {
  return normalizeEffectLabel(val).replace(/\s+(?:ex|[a-e](?:\+{1,3})?)$/i, "").trim()
}

function normalizePopupText(val) {
  return String(val ?? "").replace(/\s+/g, " ").trim()
}

function shouldExcludeAttackBonusLabel(val) {
  const normalized = normalizeEffectLabel(val)

  return (
    normalized.includes("bonus effect with") ||
    normalized.includes("bonus buff") ||
    normalized.includes("bonus debuff") ||
    normalized.includes("when attacking") ||
    normalized.includes("charge loss")
  )
}

const EXCLUDED_TRAITS = new Set([
  "servant",
  "canBeInBattle",
  "weakToEnumaElish",
  "standardClassServant",
  "hominidaeServant",
  "oneStarServant",
  "twoStarServant",
  "threeStarServant",
  "fourStarServant",
  "fiveStarServant",
  "unknown",
])

const STATE_FUNC_TYPES = [
  "addState",
  "addStateShort",
  "gainHp",
  "gainNp",
  "gainStar",
  "regainHp",
  "regainNp",
  "regainStar",
  "instantDeath",
  "lossHpSafe",
]

const NON_STATE_LABELS = {
  gainHp: "Heal",
  gainNp: "NP Charge",
  gainStar: "Critical Stars",
  regainHp: "HP Regen",
  regainNp: "NP Regen",
  regainStar: "Star Regen",
  instantDeath: "Death",
  lossHpSafe: "HP Loss",
}

const CARD_EFFECT_LABELS = {
  cardBuster: "Buster Up",
  cardArts: "Arts Up",
  cardQuick: "Quick Up",
  cardExtra: "Extra Attack Up",
  cardNP: "NP Damage Up",
}

const TYPE_EFFECT_LABELS = {
  gutsFunction: "Buff (Trigger Guts)",
  guts: "Guts",
  gutsRatio: "Guts",
  upAtk: "ATK Up",
  upDefence: "DEF Up",
  upTolerance: "Debuff Resist Up",
  upCriticaldamage: "Critical Up",
  upCriticalrate: "Critical Hit Rate Up",
  upCriticalpoint: "C. Star Drop Rate Up",
  avoidState: "Debuff Immune",
  avoidInstantdeath: "Immune to Death",
  regainHp: "HP Regen",
  regainNp: "NP Regen",
  regainStar: "Star Regen",
}

function toTitleCase(val) {
  return String(val ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getEffectsFromDetail(val) {
  const normalized = normalizeEffectLabel(val)
  const effects = new Set()

  if (normalized.includes("apply evade")) effects.add("Evade")
  if (normalized.includes("apply invincible")) effects.add("Invincible")
  if (normalized.includes("apply guts")) effects.add("Guts")

  return [...effects]
}

function getCanonicalBuffEffects(buff, func) {
  if (!buff || buff.type === "upDamage") return []

  const traitNames = [
    ...(buff.tvals ?? []),
    ...(buff.ckSelfIndv ?? []),
    ...(buff.ckOpIndv ?? []),
  ].map((trait) => trait?.name).filter(Boolean)

  if (buff.type === "avoidance") return ["Evade"]
  if (buff.type === "invincible") return ["Invincible"]

  if (buff.type === "selfturnendFunction" || buff.type === "commandattackAfterFunction") {
    const delayedEffects = getEffectsFromDetail(buff.detail)
    if (delayedEffects.length) return delayedEffects
  }

  if (buff.type === "upCommandall") {
    const cardTrait = traitNames.find((trait) => CARD_EFFECT_LABELS[trait])
    if (cardTrait) return [CARD_EFFECT_LABELS[cardTrait]]
  }

  if (TYPE_EFFECT_LABELS[buff.type]) return [TYPE_EFFECT_LABELS[buff.type]]

  const popupText = normalizePopupText(func?.funcPopupText)
  if (popupText && popupText.toLowerCase() !== "none") return [popupText]

  if (buff.name?.startsWith("Activate when")) return ["Buff (Trigger Guts)"]

  return []
}

function collectEffects(servant) {
  const buffSet = new Set()
  const debuffSet = new Set()
  const allSources = [...(servant.skills ?? []), ...(servant.noblePhantasms ?? [])]

  allSources.forEach((source) => {
    const sourceName = normalizeSourceName(source.name)

    source.functions?.forEach((func) => {
      if (!STATE_FUNC_TYPES.includes(func.funcType)) return

      const targetType = func.funcTargetType ?? ""
      const targetTeam = func.funcTargetTeam ?? ""
      const isAllyTargetType =
        targetType === "self" || targetType === "player" || targetType.startsWith("pt")
      const targetsAlly = isAllyTargetType || targetTeam === "player"
      const targetsEnemy =
        targetType.startsWith("enemy") || (!isAllyTargetType && targetTeam === "enemy")

      if (func.funcType !== "addState" && func.funcType !== "addStateShort") {
        const name = NON_STATE_LABELS[func.funcType]
        if (name) {
          if (targetsAlly) buffSet.add(name)
          if (targetsEnemy) debuffSet.add(name)
        }
        return
      }

      const buffs = func.buffs ?? []

      if (!buffs.length) {
        const popupText = normalizePopupText(func.funcPopupText)
        if (popupText && popupText.toLowerCase() !== "none" && !shouldExcludeAttackBonusLabel(popupText)) {
          if (targetsAlly) buffSet.add(popupText)
          if (targetsEnemy) debuffSet.add(popupText)
        }
        return
      }

      buffs.forEach((b) => {
        if (!b?.name) return

        const buffName = normalizeEffectLabel(b.name)
        const canonicalEffects = getCanonicalBuffEffects(b, func)

        if (canonicalEffects.length) {
          canonicalEffects.forEach((effect) => {
            if (shouldExcludeAttackBonusLabel(effect)) return
            if (targetsAlly) buffSet.add(effect)
            if (targetsEnemy) debuffSet.add(effect)
          })
          return
        }

        if (shouldExcludeAttackBonusLabel(b.name)) return
        if (sourceName && buffName === sourceName) return

        if (targetsAlly) buffSet.add(b.name)
        if (targetsEnemy) debuffSet.add(b.name)
      })
    })
  })

  return { buffs: [...buffSet], debuffs: [...debuffSet] }
}

export function buildServantsIndex(servants) {
  return (Array.isArray(servants) ? servants : [])
    .filter((servant) => servant.extraAssets?.faces?.ascension?.["1"])
    .map((servant) => {
      const traitNames = (servant.traits ?? [])
        .map((trait) => String(trait?.name ?? ""))
        .filter(Boolean)
      const alignments = traitNames
        .filter((trait) => trait.startsWith("alignment"))
        .map((trait) => toTitleCase(trait.replace(/^alignment/, "")))
      const traits = traitNames
        .filter((trait) =>
          !trait.startsWith("alignment") &&
          !trait.startsWith("class") &&
          !trait.startsWith("attribute") &&
          !trait.startsWith("gender") &&
          !EXCLUDED_TRAITS.has(trait)
        )
        .map((trait) => toTitleCase(trait))
      const { buffs, debuffs } = collectEffects(servant)

      return {
        id: servant.id,
        name: servant.name,
        className: capitalizeFirstLetter(servant.className),
        attribute: toTitleCase(servant.attribute),
        rarity: servant.rarity,
        portrait: servant.extraAssets.faces.ascension["1"],
        buffs,
        debuffs,
        traits,
        alignments,
        stars: `${"★".repeat(servant.rarity)} (${servant.rarity})`,
      }
    })
    .sort((a, b) => a.id - b.id)
}

const DETAIL_KEYS = [
  "id",
  "name",
  "className",
  "rarity",
  "attribute",
  "traits",
  "cards",
  "hpMax",
  "atkMax",
  "skills",
  "noblePhantasms",
  "appendPassive",
  "classPassive",
  "ascensionMaterials",
  "skillMaterials",
  "appendSkillMaterials",
  "costumeMaterials",
]

export function trimServantDetail(servant) {
  const detail = {}
  for (const key of DETAIL_KEYS) {
    if (servant[key] !== undefined) detail[key] = servant[key]
  }

  const faces = servant.extraAssets?.faces?.ascension ?? {}
  const charaGraph = servant.extraAssets?.charaGraph ?? {}
  detail.extraAssets = {
    faces: { ascension: faces },
    charaGraph: {
      ascension: charaGraph.ascension ?? {},
      costume: charaGraph.costume ?? {},
    },
  }
  detail.portrait = faces["1"] ?? faces[1] ?? null

  return detail
}
