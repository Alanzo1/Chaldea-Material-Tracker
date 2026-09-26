import "./globals.css"
import { AccountProvider } from "@/components/account/AccountProvider"
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
                  document.documentElement.classList.toggle("dark", localStorage.getItem("theme") !== "light");
                } catch (e) {}
              })();
            `,
          }}
        />
        <AccountProvider>
        <ServantProvider initialServants={servants}>
          <NavBar />
          <ItemSearchProvider>{children}</ItemSearchProvider>
        </ServantProvider>
        </AccountProvider>
        <Analytics />
      </body>
    </html>
  )
}
