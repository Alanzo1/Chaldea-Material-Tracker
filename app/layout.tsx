import "./globals.css"
import { Analytics } from "@vercel/analytics/next"

import { ServantProvider } from "@/app/contexts/HomePageContext"
import { ItemSearchProvider } from "@/app/contexts/ItemSearchContext"
import { NavBar } from "@/components/NavBar"
import { getServantsIndex } from "@/lib/atlas-data"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const servants = getServantsIndex()

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  localStorage.setItem("theme", "dark");
                  document.documentElement.classList.add("dark");
                } catch (e) {}
              })();
            `,
          }}
        />
        <ServantProvider initialServants={servants}>
          <NavBar />
          <ItemSearchProvider>{children}</ItemSearchProvider>
        </ServantProvider>
        <Analytics />
      </body>
    </html>
  )
}
