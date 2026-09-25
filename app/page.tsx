import Link from "next/link"
import { ClipboardList, Gem, Map, Sparkles, Swords } from "lucide-react"

const destinations = [
  {
    href: "/free-quests",
    title: "Free Quests",
    description: "Explore farming locations, compare drops, and inspect enemy waves.",
    icon: Map,
    color: "bg-emerald-300/20 text-emerald-200",
  },
  {
    href: "/servants",
    title: "Servants",
    description: "Explore stats, skills, Noble Phantasms, and materials for your servants.",
    icon: Swords,
    color: "bg-sky-300/20 text-sky-200",
  },
  {
    href: "/items",
    title: "Items",
    description: "Browse materials, see where to farm them, and find who needs them.",
    icon: Gem,
    color: "bg-amber-300/20 text-amber-200",
  },
  {
    href: "/track-materials",
    title: "Planning",
    description: "Plan servant upgrades and keep track of the materials you need.",
    icon: ClipboardList,
    color: "bg-cyan-300/20 text-cyan-200",
  },
]

export default function Home() {
  return (
    <main className="min-h-[calc(100svh-4rem)] bg-[radial-gradient(ellipse_at_70%_0%,#626a72_0%,#46586a_55%,#3c4c5e_100%)] text-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="text-center">
          <div className="mb-8 flex items-center justify-center gap-3 sm:gap-5">
            <Sparkles className="size-14 shrink-0 text-cyan-400 sm:size-20" strokeWidth={1.5} aria-hidden="true" />
            <h1 className="text-left">
              <span className="block text-4xl font-black italic tracking-tight sm:text-6xl lg:text-7xl">CHALDEA</span>
              <span className="mt-1 block text-xs font-bold tracking-[0.2em] text-cyan-300 sm:text-lg sm:tracking-[0.24em]">MATERIAL TRACKER</span>
            </h1>
          </div>
          <p className="mx-auto max-w-5xl text-base leading-relaxed text-slate-100 sm:text-lg lg:text-xl">
            <strong>Chaldea Material Tracker</strong> is an unofficial companion for <span className="font-semibold text-cyan-300">Fate/Grand Order</span>.
            <br className="hidden sm:block" />{" "}
            Explore servants, find materials, and plan your next upgrades.
          </p>
        </div>

        <nav aria-label="Explore Chaldea" className="mt-10 grid gap-3 md:grid-cols-2 lg:mt-12">
          {destinations.map(({ href, title, description, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-lg bg-slate-900/35 p-5 transition-colors hover:bg-slate-900/55 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 motion-safe:transition-transform motion-safe:hover:-translate-y-1 lg:gap-5 lg:p-6"
            >
              <span className={`grid size-16 shrink-0 place-items-center rounded-full lg:size-20 ${color}`}>
                <Icon className="size-8 lg:size-10" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight group-hover:text-cyan-200">{title}</h2>
                <p className="mt-1 text-base leading-relaxed text-slate-200 lg:text-lg">{description}</p>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  )
}
