import { Toggle } from "radix-ui"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group"
import { useState } from "react"
import { useServants } from "@/app/contexts/HomePageContext"

export function NavBar (){

    const {servants} = useServants()


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
            <ToggleGroup type="multiple" variant="outline" spacing={2}>
                <ToggleGroupItem value="saber">Saber</ToggleGroupItem>
                <ToggleGroupItem value="b">Archer</ToggleGroupItem>
                <ToggleGroupItem value="c">Lancer</ToggleGroupItem>
                <ToggleGroupItem value="c">D</ToggleGroupItem>
                <ToggleGroupItem value="c">E</ToggleGroupItem>
                <ToggleGroupItem value="c">F</ToggleGroupItem>
                <ToggleGroupItem value="c">G</ToggleGroupItem>

            </ToggleGroup>
        </div>
        </>
        
    )
}