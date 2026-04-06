"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { StoredReceipt } from "@/lib/receipt-schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { formatCurrency } from "./shared"

type RecentReceiptsSectionProps = {
  receipts: StoredReceipt[]
}

export function RecentReceiptsSection({ receipts }: RecentReceiptsSectionProps) {
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(
    receipts[0]?.id ?? null
  )

  const selectedRecentReceipt = useMemo(() => {
    if (activeReceiptId) {
      const match = receipts.find((receipt) => receipt.id === activeReceiptId)
      if (match) {
        return match
      }
    }

    return receipts[0] ?? null
  }, [activeReceiptId, receipts])

  return (
    <section id="recent-receipts" className='scroll-mt-20'>
      <Card className="border-border">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Recent receipts</CardTitle>
            <CardDescription>
              Quick view of your latest saved receipts.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{`${receipts.length} saved`}</Badge>
            <Button size="sm" variant="outline" asChild>
              <Link href="/receipts">Open full receipts page</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid pt-2 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-x-auto rounded-2xl border border-r-0 rounded-r-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length > 0 ? (
                  receipts.slice(0, 6).map((savedReceipt) => (
                    <TableRow
                      key={savedReceipt.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedRecentReceipt?.id === savedReceipt.id && "bg-accent/45"
                      )}
                      onClick={() => setActiveReceiptId(savedReceipt.id)}
                    >
                      <TableCell className="font-medium">
                        {savedReceipt.merchantName || "Unknown merchant"}
                      </TableCell>
                      <TableCell>{savedReceipt.purchaseDate || "Unknown"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(savedReceipt.totalAmountDue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {savedReceipt.sourceFileUrl ? (
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={savedReceipt.sourceFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Open file
                              </a>
                            </Button>
                          ) : (
                            <span className="self-center text-xs text-muted-foreground">
                              Not saved
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No receipts saved yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div
            className={cn(
              "rounded-2xl border border-l-0 rounded-l-none p-4",
              selectedRecentReceipt ? "border-primary/10 bg-accent/45" : "bg-muted/20"
            )}
          >
            {selectedRecentReceipt ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold">
                  {selectedRecentReceipt.merchantName || "Unknown merchant"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    TIN: {selectedRecentReceipt.tinNumber || "Not found"}
                  </Badge>
                  <Badge variant="secondary">
                    Receipt #: {selectedRecentReceipt.officialReceiptNumber || "Not found"}
                  </Badge>
                  <Badge variant="secondary">
                    VAT: {formatCurrency(selectedRecentReceipt.vatAmount)}
                  </Badge>
                </div>
                <div className="rounded-xl border bg-background/85 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                    Line items
                  </p>
                  <div className="grid gap-2">
                    {selectedRecentReceipt.items.slice(0, 4).map((item, index) => (
                      <div
                        key={`${item.description}-${index}`}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Qty {item.quantity} · {item.category || "Uncategorized"}
                          </p>
                        </div>
                        <span className="shrink-0 font-medium">
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                    {selectedRecentReceipt.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No line items found.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a receipt row to view a quick snapshot.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
