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

interface NPEffectRow {
  label: string
  values: string[]
  icon?: string
}

interface NPInfoTableProps {
  levelRows: NPEffectRow[]
  overchargeRows: NPEffectRow[]
}

export function NPInfoTable({ levelRows, overchargeRows }: NPInfoTableProps) {
  if (!levelRows.length && !overchargeRows.length) return null

  return (
    <div className="space-y-4">
      {levelRows.length ? (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>NP Level</TableHead>
              <TableHead>1</TableHead>
              <TableHead>2</TableHead>
              <TableHead>3</TableHead>
              <TableHead>4</TableHead>
              <TableHead>5</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {levelRows.map((row, rowIndex) => (
              <TableRow key={`np-level-${row.label}-${rowIndex}`}>
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
                {row.values.map((value, valueIndex) => (
                  <TableCell key={`np-level-${row.label}-${valueIndex}`}>{value}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {overchargeRows.length ? (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>OC</TableHead>
              <TableHead>1</TableHead>
              <TableHead>2</TableHead>
              <TableHead>3</TableHead>
              <TableHead>4</TableHead>
              <TableHead>5</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overchargeRows.map((row, rowIndex) => (
              <TableRow key={`np-oc-${row.label}-${rowIndex}`}>
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
                {row.values.map((value, valueIndex) => (
                  <TableCell key={`np-oc-${row.label}-${valueIndex}`}>{value}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}
