"use client"

import { columns } from "@/components/ServantTable/columns"
import { DataTable } from "@/components/ServantTable/dataTable"
import { useServants } from "../contexts/HomePageContext"


function Homepage (){

  const { filtered } = useServants()


    
    return(
   <>
    <DataTable columns={columns} data={filtered} />
  </>
  
)
}

export default Homepage
