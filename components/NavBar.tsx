"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Moon, Search, Settings, Sparkles, Sun, UserRound } from "lucide-react"
import { useState } from "react"

import { useAccount } from "@/components/account/AccountProvider"
import { SiteSearch } from "@/components/SiteSearch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/servants", label: "Servants" },
  { href: "/items", label: "Items" },
  { href: "/free-quests", label: "Free Quests" },
  { href: "/track-materials", label: "Planning" },
]

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 shrink-0 items-center rounded-md px-2.5 text-sm sm:px-4 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        isActive && "bg-muted text-foreground"
      )}
    >
      {label}
    </Link>
  )
}

export function NavBar() {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const pathname = usePathname()
  const account = useAccount()
  const theme = account.profile.theme
  const toggleTheme = () => account.editProfile({ ...account.profile, theme: theme === "dark" ? "light" : "dark" })

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Chaldea Material Tracker home"
          className="mr-2 flex h-11 shrink-0 items-center gap-2 rounded-md pr-2 text-foreground transition-opacity hover:opacity-85"
        >
          <span className="grid size-9 place-items-center rounded-md border border-cyan-300/40 bg-cyan-400/10 text-cyan-200">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden font-serif text-xl font-bold leading-none tracking-tight sm:block">
            Chaldea
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          {navItems.map((item) => (
            <NavLink key={`${item.label}-${item.href}`} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href={`/account?next=${encodeURIComponent(pathname)}`} aria-label="Account" title={account.status} className="flex h-11 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <UserRound className="size-4" aria-hidden="true" />
            <span className="hidden xl:block">{account.user ? account.profile.displayName || "Account" : "Sign in"}</span>
            {account.user && <span className="hidden text-xs text-muted-foreground 2xl:block" aria-live="polite">{account.status}</span>}
          </Link>
          <div className="hidden w-[min(22rem,32vw)] lg:block">
            <SiteSearch />
          </div>

          <Popover open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                aria-label="Search"
              >
                <Search className="size-5" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] p-3">
              <SiteSearch autoFocus inlineResults onNavigate={() => setMobileSearchOpen(false)} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Settings"
              >
                <Settings className="size-5" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-60 p-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-11 w-full items-center justify-between rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span>Theme</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {theme === "dark" ? (
                    <>
                      <Moon className="size-4" aria-hidden="true" />
                      Dark
                    </>
                  ) : (
                    <>
                      <Sun className="size-4" aria-hidden="true" />
                      Light
                    </>
                  )}
                </span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  )
}
