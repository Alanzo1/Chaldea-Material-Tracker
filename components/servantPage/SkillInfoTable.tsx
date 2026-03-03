"use client"

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
            <TableCell className="font-medium">{row.label}</TableCell>
            {row.values.map((value, index) => (
              <TableCell key={`${row.label}-${index}`}>{value}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
