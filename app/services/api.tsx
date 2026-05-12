const BASE_URL = "https://api.atlasacademy.io"

function capitalizeFirstLetter(val: string) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function normalizeEffectLabel(val?: string) {
    return String(val ?? "")
        .toLowerCase()
        .replace(/[\[\]]/g, "")
        .trim();
}

function normalizeSourceName(val?: string) {
    return normalizeEffectLabel(val).replace(/\s+(?:ex|[a-e](?:\+{1,3})?)$/i, "").trim();
}

function normalizePopupText(val?: string) {
    return String(val ?? "").replace(/\s+/g, " ").trim();
}

function shouldExcludeAttackBonusLabel(val?: string) {
    const normalized = normalizeEffectLabel(val);

    return (
        normalized.includes("bonus effect with") ||
        normalized.includes("bonus buff") ||
        normalized.includes("bonus debuff") ||
        normalized.includes("when attacking") ||
        normalized.includes("charge loss")
    );
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
]);

function toTitleCase(val?: string) {
    return String(val ?? "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function getEffectsFromDetail(val?: string) {
    const normalized = normalizeEffectLabel(val);
    const effects = new Set<string>();

    if (normalized.includes("apply evade")) effects.add("Evade");
    if (normalized.includes("apply invincible")) effects.add("Invincible");
    if (normalized.includes("apply guts")) effects.add("Guts");

    return [...effects];
}

function getCanonicalBuffEffects(buff: any, func: any) {
    if (!buff || buff.type === "upDamage") return [];

    const traitNames = [
        ...(buff.tvals ?? []),
        ...(buff.ckSelfIndv ?? []),
        ...(buff.ckOpIndv ?? []),
    ].map((trait: any) => trait?.name).filter(Boolean);

    const cardEffectLabels: Record<string, string> = {
        cardBuster: "Buster Up",
        cardArts: "Arts Up",
        cardQuick: "Quick Up",
        cardExtra: "Extra Attack Up",
        cardNP: "NP Damage Up",
    };

    const typeEffectLabels: Record<string, string> = {
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
    };

    if (buff.type === "avoidance") return ["Evade"];
    if (buff.type === "invincible") return ["Invincible"];

    if (buff.type === "selfturnendFunction" || buff.type === "commandattackAfterFunction") {
        const delayedEffects = getEffectsFromDetail(buff.detail);
        if (delayedEffects.length) return delayedEffects;
    }

    if (buff.type === "upCommandall") {
        const cardTrait = traitNames.find((trait: string) => cardEffectLabels[trait]);
        if (cardTrait) return [cardEffectLabels[cardTrait]];
    }

    if (typeEffectLabels[buff.type]) return [typeEffectLabels[buff.type]];

    const popupText = normalizePopupText(func?.funcPopupText);
    if (popupText && popupText.toLowerCase() !== "none") return [popupText];

    if (buff.name?.startsWith("Activate when")) return ["Buff (Trigger Guts)"];

    return [];
}

function transformServantsForHomePage(data: any[]) {
    return data
        .filter((servant: any) => {
            return servant.extraAssets?.faces?.ascension?.["1"];
        })
        .map((servant: any) => {
            const buffSet = new Set<string>()
            const debuffSet = new Set<string>()
            const traitNames = (servant.traits ?? [])
                .map((trait: any) => String(trait?.name ?? ""))
                .filter(Boolean);
            const alignments = traitNames
                .filter((trait: string) => trait.startsWith("alignment"))
                .map((trait: string) => toTitleCase(trait.replace(/^alignment/, "")));
            const traits = traitNames
                .filter((trait: string) =>
                    !trait.startsWith("alignment") &&
                    !trait.startsWith("class") &&
                    !trait.startsWith("attribute") &&
                    !trait.startsWith("gender") &&
                    !EXCLUDED_TRAITS.has(trait)
                )
                .map((trait: string) => toTitleCase(trait));

            const allSources = [
                ...(servant.skills ?? []),
                ...(servant.noblePhantasms ?? []),
            ];

            allSources.forEach((source: any) => {
                const sourceName = normalizeSourceName(source.name);

                source.functions?.forEach((func: any) => {
                    if (!["addState", "addStateShort", "gainHp", "gainNp", "gainStar", "regainHp", "regainNp", "regainStar", "instantDeath", "lossHpSafe"].includes(func.funcType)) return;

                    const targetType: string = func.funcTargetType ?? "";
                    const targetTeam: string = func.funcTargetTeam ?? "";
                    const isAllyTargetType =
                        targetType === "self" ||
                        targetType === "player" ||
                        targetType.startsWith("pt");

                    const targetsAlly =
                        isAllyTargetType ||
                        targetTeam === "player";
                    const targetsEnemy =
                        targetType.startsWith("enemy") ||
                        (!isAllyTargetType && targetTeam === "enemy");

                    if (func.funcType !== "addState" && func.funcType !== "addStateShort") {
                        const labels: Record<string, string> = {
                            gainHp:    "Heal",
                            gainNp:    "NP Charge",
                            gainStar:  "Critical Stars",
                            regainHp:  "HP Regen",
                            regainNp:  "NP Regen",
                            regainStar:"Star Regen",
                            instantDeath: "Death",
                            lossHpSafe: "HP Loss",
                        };
                        const name = labels[func.funcType];
                        if (name) {
                            if (targetsAlly) buffSet.add(name);
                            if (targetsEnemy) debuffSet.add(name);
                        }
                        return;
                    }

                    const buffs = func.buffs ?? [];

                    if (!buffs.length) {
                        const popupText = normalizePopupText(func.funcPopupText);
                        if (
                            popupText &&
                            popupText.toLowerCase() !== "none" &&
                            !shouldExcludeAttackBonusLabel(popupText)
                        ) {
                            if (targetsAlly) buffSet.add(popupText);
                            if (targetsEnemy) debuffSet.add(popupText);
                        }
                        return;
                    }

                    buffs.forEach((b: any) => {
                        if (!b?.name) return;

                        const buffName = normalizeEffectLabel(b.name);
                        const canonicalEffects = getCanonicalBuffEffects(b, func);

                        if (canonicalEffects.length) {
                            canonicalEffects.forEach((effect) => {
                                if (shouldExcludeAttackBonusLabel(effect)) return;
                                if (targetsAlly) buffSet.add(effect);
                                if (targetsEnemy) debuffSet.add(effect);
                            });
                            return;
                        }

                        if (shouldExcludeAttackBonusLabel(b.name)) return;

                        if (sourceName && buffName === sourceName) return;

                        if (targetsAlly) buffSet.add(b.name);
                        if (targetsEnemy) debuffSet.add(b.name);
                    });
                });
            });

            return {
                id: servant.id,
                name: servant.name,
                className: capitalizeFirstLetter(servant.className),
                attribute: toTitleCase(servant.attribute),
                rarity: servant.rarity,
                portrait: servant.extraAssets.faces.ascension["1"],
                buffs: [...buffSet],
                debuffs: [...debuffSet],
                traits,
                alignments,
                stars: `${"★".repeat(servant.rarity)} (${servant.rarity})`,
            }
        })
}

// --- Unified servants cache ---
//
// Both the servants index and servant detail endpoints derive from the same
// nice_servant.json payload. A single fetch populates both, so servant detail
// requests never need to call the individual /nice/NA/svt/{id} endpoint at all.
// This eliminates the Atlas rate-limit 500s that individual-per-servant fetches
// triggered under concurrent load.

export type ServantData = {
    id: number
    name: string
    className: string
    rarity: number
    portrait: string | null
    ascensionMaterials: Record<string, unknown>
    skillMaterials: Record<string, unknown>
    appendSkillMaterials: Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw: any
}

type ServantsCache = {
    index: ReturnType<typeof transformServantsForHomePage>
    details: Map<number, ServantData>
    expiry: number
}

function extractServantDetails(data: any[]): Map<number, ServantData> {
    const map = new Map<number, ServantData>()
    for (const s of data) {
        const id = Number(s?.id)
        if (!id) continue
        map.set(id, {
            id,
            name: s.name,
            className: s.className,
            rarity: s.rarity,
            portrait:
                s.extraAssets?.faces?.ascension?.["1"] ??
                s.extraAssets?.faces?.ascension?.[1] ??
                null,
            ascensionMaterials: s.ascensionMaterials ?? {},
            skillMaterials: s.skillMaterials ?? {},
            appendSkillMaterials: s.appendSkillMaterials ?? {},
            raw: s,
        })
    }
    return map
}

let servantsCache: ServantsCache | null = null
let servantsInflight: Promise<ServantsCache> | null = null

async function fetchServants(region: string): Promise<ServantsCache> {
    try {
        const response = await fetch(`${BASE_URL}/export/${region}/nice_servant.json`, {
            // This payload is ~50MB+ and exceeds Next.js Data Cache item limits.
            // We deliberately bypass fetch data-cache and rely on our in-memory
            // cache (servantsCache/servantsInflight) for reuse and deduping.
            cache: "no-store",
        })
        if (!response.ok) throw new Error(`Atlas returned ${response.status}`)
        const data = await response.json()
        return {
            index: transformServantsForHomePage(data),
            details: extractServantDetails(data),
            expiry: Date.now() + 3_600_000,
        }
    } catch (error) {
        console.error("Servants fetch failed:", error)
        // Short TTL on error so the next request retries promptly
        return { index: [], details: new Map(), expiry: Date.now() + 60_000 }
    }
}

function getOrFetchServants(region: string): Promise<ServantsCache> {
    if (servantsCache && Date.now() < servantsCache.expiry) {
        return Promise.resolve(servantsCache)
    }
    if (!servantsInflight) {
        servantsInflight = fetchServants(region)
            .then(cache => { servantsCache = cache; return cache })
            .finally(() => { servantsInflight = null })
    }
    return servantsInflight
}

export async function getServantsHomePageIndex(region = "NA") {
    const cache = await getOrFetchServants(region)
    return cache.index
}

export async function getServantData(svt_id: number, region = "NA") {
    const cache = await getOrFetchServants(region)
    const detail = cache.details.get(svt_id)
    if (!detail) throw new Error(`Servant ${svt_id} not found`)
    return detail
}
