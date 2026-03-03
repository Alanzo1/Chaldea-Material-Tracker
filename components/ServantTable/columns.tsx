"use client"

import { ColumnDef } from "@tanstack/react-table"
import Image from "next/image"



export interface Servant {
  id: number;
  name: string;
  className: string;
  rarity: number;
  portrait: string;
}

function getStarColorClass(rarity: number) {
  if (rarity <= 2) return "text-amber-700"
  if (rarity === 3) return "text-slate-400"
  return "text-yellow-500"
}

export const columns: ColumnDef<Servant>[] = [
   {
    accessorKey: "portrait",
    header: "Portrait",
    cell: ({ row }) => (
      <Image
        src={row.getValue("portrait")}
        alt={row.getValue("name")}
        width={80}
        height={86}
      />
    ),
  },
    {
        accessorKey: "name",
        header:"Name"  
},
    {
        accessorKey: "className",
        header:"Class"
    },
    {
        accessorKey: "rarity",
        header: () => <div className="text-center">Rarity</div>,
        cell: ({ row }) => {
            const rarity = row.getValue("rarity") as number
            return (
              <div className={`text-center ${getStarColorClass(rarity)}`}>
                {"★".repeat(rarity)}
              </div>
            )
        }
    }

]
