import Link from "next/link"

import { getServantData } from "@/app/services/api"
import { ServantArtCard } from "@/components/servantPage/ServantArtCard"
import { ServantHeaderCard } from "@/components/servantPage/ServantHeaderCard"
import { SkillsSection } from "@/components/servantPage/SkillsSection"
import { ServantStatsCard } from "@/components/servantPage/ServantStatsCard"
import { Button } from "@/components/ui/button"

const CARD_LABELS: Record<string, string> = {
  "1": "A",
  "2": "B",
  "3": "Q",
  "4": "E",
}

function toTitleCase(value?: string) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

interface ServantPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ServantPage({ params }: ServantPageProps) {
  const { id } = await params
  const servant = await getServantData(Number(id))
  const ascensionOptions = Object.entries(
    servant.raw?.extraAssets?.charaGraph?.ascension ?? {}
  )
    .filter(([, url]) => Boolean(url))
    .map(([stage, url]) => ({
      label: `Ascension ${stage}`,
      url: String(url),
    }))

  const costumeOptions = Object.entries(
    servant.raw?.extraAssets?.charaGraph?.costume ?? {}
  )
    .filter(([, url]) => Boolean(url))
    .map(([costumeId, url]) => ({
      label: `Costume ${costumeId}`,
      url: String(url),
    }))

  const artOptions = [...ascensionOptions, ...costumeOptions]

  if (!artOptions.length && servant.portrait) {
    artOptions.push({
      label: "Default Portrait",
      url: servant.portrait,
    })
  }

  const visibleTraits = (servant.raw?.traits ?? [])
    .map((trait: any) => String(trait?.name ?? ""))
    .filter(
      (trait: string) =>
        trait &&
        !trait.startsWith("class") &&
        !trait.startsWith("alignment") &&
        !trait.startsWith("attribute") &&
        !trait.startsWith("gender") &&
        trait !== "servant" &&
        trait !== "canBeInBattle" &&
        trait !== "standardClassServant" &&
        trait !== "weakToEnumaElish" &&
        trait !== "hominidaeServant" &&
        trait !== "unknown"
    )
    .map((trait: string) => toTitleCase(trait))

  const deck = (servant.raw?.cards ?? [])
    .map((card: string) => CARD_LABELS[String(card)] ?? String(card))
    .join(" ")

  const alignment = (servant.raw?.traits ?? [])
    .map((trait: any) => String(trait?.name ?? ""))
    .filter((trait: string) => trait.startsWith("alignment"))
    .map((trait: string) => toTitleCase(trait.replace(/^alignment/, "")))
    .join(" / ")

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <div>
        <Button asChild variant="outline">
          <Link href="/">Back to Homepage</Link>
        </Button>
      </div>
      <ServantHeaderCard
        name={servant.name}
        className={servant.className}
        rarity={servant.rarity}
      />
      <section className="flex items-start gap-8">
        <div className="shrink-0">
          <ServantArtCard name={servant.name} options={artOptions} />
        </div>
        <div className="min-w-0 flex-1">
          <ServantStatsCard
            maxHp={Number(servant.raw?.hpMax ?? 0)}
            maxAtk={Number(servant.raw?.atkMax ?? 0)}
            traits={visibleTraits}
            attribute={String(servant.raw?.attribute ?? "")}
            alignment={alignment}
            deck={deck}
          />
        </div>
      </section>
      <SkillsSection
        skills={servant.raw?.skills ?? []}
        appendPassive={servant.raw?.appendPassive ?? []}
        classPassive={servant.raw?.classPassive ?? []}
      />
    </main>
  )
}
