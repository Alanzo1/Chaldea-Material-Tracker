"use client"

import { ServantProvider } from "./contexts/HomePageContext"
import Homepage from "./pages/Home"
import { NavBar } from "@/components/NavBar"

export default function Home() {
  return (<>
  <ServantProvider>
     <NavBar />
    <Homepage />  
  </ServantProvider>
   
  </>

  )
}
