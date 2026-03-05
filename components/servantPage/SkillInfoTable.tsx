"use client"

import Image from "next/image"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface SkillInfoRow {
  label: string
  values: string[]
  icon?: string
}

interface SkillInfoTableProps {
  levels: string[]
  rows: SkillInfoRow[]
}

export function SkillInfoTable({ levels, rows }: SkillInfoTableProps) {
  if (!rows.length) return null

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Effect</TableHead>
          {levels.map((level) => (
            <TableHead key={level}>{level}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={`${row.label}-${rowIndex}`}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {row.icon ? (
                  <Image
                    src={row.icon}
                    alt={row.label}
                    width={18}
                    height={18}
                    className="rounded-sm"
                  />
                ) : null}
                <span>{row.label}</span>
              </div>
            </TableCell>
            {row.values.map((value, index) => (
              <TableCell key={`${row.label}-${index}`}>{value}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
