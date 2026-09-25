import { getServantDetail, getServantsIndex } from "@/lib/atlas-data"
import { MaterialsSection, MaterialsSummarySection } from "@/components/servantPage/MaterialsSection"
import { ServantActions } from "@/components/servantPage/ServantActions"
import { ServantArtPanel, type ArtOption } from "@/components/servantPage/ServantArtPanel"
import { ServantDetailsPanel } from "@/components/servantPage/ServantDetailsPanel"
import { ServantTabs, type ServantTab } from "@/components/servantPage/ServantTabs"
import {
  ActiveSkillsSection,
  AppendSkillsSection,
  ClassSkillsSection,
  NoblePhantasmSection,
} from "@/components/servantPage/SkillsSection"

const CARD_LABELS: Record<string, string> = {
  "1": "A",
  "2": "B",
  "3": "Q",
  "4": "E",
}

const HIDDEN_TRAITS = new Set([
  "servant",
  "canBeInBattle",
  "standardClassServant",
  "weakToEnumaElish",
  "hominidaeServant",
  "unknown",
])

function toTitleCase(value?: string) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getStarColorClass(rarity: number) {
  if (rarity <= 2) return "text-amber-700"
  if (rarity === 3) return "text-slate-400"
  return "text-yellow-500"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getArtOptions(raw: any, portrait: string | null): ArtOption[] {
  const faces: Record<string, string> = raw?.extraAssets?.faces?.ascension ?? {}
  const costumeFaces: Record<string, string> = raw?.extraAssets?.faces?.costume ?? {}
  const ascension = Object.entries<string>(raw?.extraAssets?.charaGraph?.ascension ?? {})
    .filter(([, url]) => Boolean(url))
    .map(([stage, url]) => ({
      id: `ascension-${stage}`,
      label: `Ascension ${stage}`,
      url,
      faceUrl: faces[stage],
      shortLabel: stage,
    }))
  const costumes = Object.entries<string>(raw?.extraAssets?.charaGraph?.costume ?? {})
    .filter(([, url]) => Boolean(url))
    .map(([costumeId, url], index) => ({
      id: `costume-${costumeId}`,
      label: `Costume ${index + 1}`,
      url,
      faceUrl: costumeFaces[costumeId],
      // Fallback for costumes Atlas has no face icon for.
      cropFaceFromArt: !costumeFaces[costumeId],
      shortLabel: `C${index + 1}`,
    }))

  const options: ArtOption[] = [...ascension, ...costumes]
  if (!options.length && portrait) {
    options.push({ id: "portrait", label: "Portrait", url: portrait, faceUrl: portrait, shortLabel: "1" })
  }
  return options
}

interface ServantPageProps {
  params: Promise<{
    id: string
  }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return getServantsIndex().map((servant) => ({ id: String(servant.id) }))
}

export default async function ServantPage({ params }: ServantPageProps) {
  const { id } = await params
  const servant = await getServantDetail(Number(id))
  const raw = servant.raw ?? {}

  const traitNames: string[] = (raw.traits ?? []).map((trait: { name?: string }) => String(trait?.name ?? ""))
  const visibleTraits = traitNames
    .filter(
      (trait) =>
        trait &&
        !trait.startsWith("class") &&
        !trait.startsWith("alignment") &&
        !trait.startsWith("attribute") &&
        !trait.startsWith("gender") &&
        !HIDDEN_TRAITS.has(trait)
    )
    .map((trait) => toTitleCase(trait))
  const alignments = traitNames
    .filter((trait) => trait.startsWith("alignment"))
    .map((trait) => toTitleCase(trait.replace(/^alignment/, "")))
  const deck: string[] = (raw.cards ?? []).map((card: string) => CARD_LABELS[String(card)] ?? String(card))

  const skills = raw.skills ?? []
  const noblePhantasms = raw.noblePhantasms ?? []
  const appendPassive = raw.appendPassive ?? []
  const classPassive = raw.classPassive ?? []
  const materials = {
    ascensionMaterials: raw.ascensionMaterials ?? {},
    skillMaterials: raw.skillMaterials ?? {},
    appendSkillMaterials: raw.appendSkillMaterials ?? {},
    costumeMaterials: raw.costumeMaterials ?? {},
    // Summary multiplies per-level costs by the number of skill slots.
    skillMultiplier: Math.max(new Set(skills.map((skill: { num?: number }) => skill.num)).size, 1),
    appendSkillMultiplier: Math.max(appendPassive.length, 1),
  }
  const hasMaterials = [
    materials.ascensionMaterials,
    materials.skillMaterials,
    materials.appendSkillMaterials,
    materials.costumeMaterials,
  ].some((stageMap) => Object.keys(stageMap).length > 0)

  const tabCandidates: (ServantTab | false)[] = [
    {
      id: "details",
      label: "Details",
      content: (
        <ServantDetailsPanel
          maxHp={Number(raw.hpMax ?? 0)}
          maxAtk={Number(raw.atkMax ?? 0)}
          deck={deck}
          attribute={toTitleCase(raw.attribute)}
          alignments={alignments}
          traits={visibleTraits}
        />
      ),
    },
    skills.length > 0 && {
      id: "skills",
      label: "Skills",
      content: <ActiveSkillsSection skills={skills} />,
    },
    noblePhantasms.length > 0 && {
      id: "noble-phantasm",
      label: "Noble Phantasm",
      content: <NoblePhantasmSection noblePhantasms={noblePhantasms} />,
    },
    appendPassive.length > 0 && {
      id: "append-skills",
      label: "Append Skills",
      content: <AppendSkillsSection appendPassive={appendPassive} />,
    },
    classPassive.length > 0 && {
      id: "class-skills",
      label: "Class Skills",
      content: <ClassSkillsSection classPassive={classPassive} />,
    },
    hasMaterials && {
      id: "materials",
      label: "Materials",
      content: <MaterialsSection {...materials} returnTab="materials" />,
    },
    hasMaterials && {
      id: "summary",
      label: "Mat Summary",
      content: <MaterialsSummarySection {...materials} returnTab="summary" />,
    },
  ]
  const tabs = tabCandidates.filter((tab): tab is ServantTab => Boolean(tab))

  return (
    <main className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] lg:items-start lg:px-8">
      <aside className="lg:sticky lg:top-22 lg:h-[calc(100vh-7rem)]">
        <ServantArtPanel
          name={servant.name}
          options={getArtOptions(raw, servant.portrait)}
          actions={
            <ServantActions
              servantId={Number(servant.id)}
              name={servant.name}
              className={servant.className}
              rarity={servant.rarity}
              portrait={servant.portrait ?? undefined}
              ascensionMaterials={materials.ascensionMaterials}
              skillMaterials={materials.skillMaterials}
              appendSkillMaterials={materials.appendSkillMaterials}
            />
          }
        />
      </aside>

      <section className="flex min-w-0 flex-col gap-4">
        <header className="space-y-3">
          <h1 className="font-serif text-4xl font-bold italic tracking-tight text-foreground sm:text-5xl">
            {servant.name}
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="flex h-9 items-center rounded-full bg-muted px-4 text-sm font-medium">
              <span className={getStarColorClass(servant.rarity)}>
                {servant.rarity > 0 ? "★".repeat(servant.rarity) : "0★"}
              </span>
            </span>
            <span className="flex h-9 items-center rounded-full bg-cyan-400/15 px-4 text-sm font-bold uppercase tracking-wide text-cyan-200">
              {toTitleCase(servant.className)}
            </span>
          </div>
        </header>

        <ServantTabs tabs={tabs} />
      </section>
    </main>
  )
}
