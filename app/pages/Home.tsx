import { useState, useEffect } from "react"
import { getServantsHomePage } from "../services/api"
import { columns } from "@/components/ServantTable/columns";
import { DataTable } from "@/components/ServantTable/dataTable";
import { useServants } from "../contexts/HomePageContext";


function Homepage (){

  const {servants} = useServants()
    
    return(
  <>
    <DataTable columns={columns} data={servants} />
  </>
)
}

export default Homepage