import { unstable_cache } from "next/cache"

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
                        if (popupText && popupText.toLowerCase() !== "none") {
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
                                if (targetsAlly) buffSet.add(effect);
                                if (targetsEnemy) debuffSet.add(effect);
                            });
                            return;
                        }

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

export const getServantsHomePageIndex = unstable_cache(
    async (region = "NA") => {
        const response = await fetch(`${BASE_URL}/export/${region}/nice_servant.json`, {
            next: {
                revalidate: 3600,
            },
        })

        if (!response.ok) {
            throw new Error("Failed to fetch servants.")
        }

        const data = await response.json()
        return transformServantsForHomePage(data)
    },
    ["servants-homepage-index"],
    {
        revalidate: 3600,
    }
)

export const getServantData = async (svt_id: number, region = "NA") => {
    const response = await fetch(`${BASE_URL}/nice/${region}/svt/${svt_id}`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch servant.");
    }
    const servant = await response.json();

    return {
        id: servant.id,
        name: servant.name,
        className: servant.className,
        rarity: servant.rarity,
        portrait:
            servant.extraAssets?.faces?.ascension?.["1"] ??
            servant.extraAssets?.faces?.ascension?.[1] ??
            null,
        raw: servant,
    };
}
