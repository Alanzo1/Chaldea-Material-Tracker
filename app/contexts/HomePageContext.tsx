import { createContext, useContext, useState, useEffect } from "react"
import { getServantsHomePage } from "../services/api"

const ServantContext = createContext<any>(null)

export function ServantProvider({ children }: any) {
  const [servants, setServants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtered, setFiltered] = useState([])


  useEffect(() => {
    const loadServants = async () => {
      try {
        const servantData = await getServantsHomePage()
        setServants(servantData)
      } catch (err) {
        console.log(err)
      } finally {
        setLoading(false)
      }
    }

    loadServants()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }


  return (
    <ServantContext.Provider value={{ servants, setServants, filtered, setFiltered }}>
      {children}
    </ServantContext.Provider>
  )
}

export function useServants() {
  return useContext(ServantContext)
}