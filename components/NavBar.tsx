import { Toggle } from "radix-ui"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group"
import { useState } from "react"
import { useServants } from "@/app/contexts/HomePageContext"
import { useRouter } from "next/navigation"

export function NavBar (){
    const router = useRouter()


const { filtered, setFiltered, servants } = useServants()
    
   const handleFilter = (values: string[]) => {
  if (values.length === 0) {
    setFiltered(servants)
  } else {
    setFiltered(servants.filter((s: { className: string }) => values.includes(s.className.toLowerCase())))
  }
}


    return (
        <>
        <div>
            <h3 className="bg-primary text-primary-foreground">
                FGO Database
            </h3>
        </div>
        <div>
            <h2 >
                Filter By: 
            </h2>
        </div>
        <div>
            <ToggleGroup type="multiple" variant="outline" spacing={2} onValueChange={handleFilter}>
                <ToggleGroupItem value="saber">Saber</ToggleGroupItem>
                <ToggleGroupItem value="archer">Archer</ToggleGroupItem>
                <ToggleGroupItem value="lancer">Lancer</ToggleGroupItem>
                <ToggleGroupItem value="rider">Rider</ToggleGroupItem>
                <ToggleGroupItem value="caster">Caster</ToggleGroupItem>
                <ToggleGroupItem value="assassin">Assassin</ToggleGroupItem>
                <ToggleGroupItem value="extra">Extra</ToggleGroupItem>
            </ToggleGroup>
        </div>
        <button onClick={() => router.push("/pages/about")}>Go to Test</button>

        </>
        
    )
}