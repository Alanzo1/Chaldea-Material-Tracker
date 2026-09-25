import { getServantsIndex } from "@/lib/atlas-data"
import { ServantProvider } from "./contexts/HomePageContext"
import Homepage from "./pages/Home"
import { NavBar } from "@/components/NavBar"

export default function Home() {
  const servants = getServantsIndex()

  return (<>
  <ServantProvider initialServants={servants}>
     <NavBar />
    <Homepage />  
  </ServantProvider>
   
  </>

  )
}
