import { getServantsHomePageIndex } from "./services/api"
import { ServantProvider } from "./contexts/HomePageContext"
import Homepage from "./pages/Home"
import { NavBar } from "@/components/NavBar"

export default async function Home() {
  const servants = await getServantsHomePageIndex()

  return (<>
  <ServantProvider initialServants={servants}>
     <NavBar />
    <Homepage />  
  </ServantProvider>
   
  </>

  )
}
