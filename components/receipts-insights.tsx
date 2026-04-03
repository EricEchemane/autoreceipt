"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)
}

function monthLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown month"
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function hasMissingFields(receipt: StoredReceipt) {
  return (
    !receipt.merchantName.trim() ||
    !receipt.tinNumber.trim() ||
    !receipt.officialReceiptNumber.trim() ||
    !receipt.purchaseDate.trim() ||
    receipt.totalAmountDue <= 0 ||
    receipt.confidence < 70
  )
}

function duplicateIds(receipts: StoredReceipt[]) {
  const counts = new Map<string, number>()
  const keys = new Map<string, string>()

  for (const receipt of receipts) {
    const merchant = receipt.merchantName.trim().toLowerCase()
    const dateKey = new Date(receipt.createdAt)
    const day = Number.isNaN(dateKey.getTime())
      ? "unknown"
      : dateKey.toISOString().slice(0, 10)
    const amount = Math.round(receipt.totalAmountDue)
    const key = `${merchant}:${day}:${amount}`

    counts.set(key, (counts.get(key) ?? 0) + 1)
    keys.set(receipt.id, key)
  }

  return new Set(
    Array.from(keys.entries())
      .filter(([, key]) => (counts.get(key) ?? 0) > 1)
      .map(([id]) => id)
  )
}

export function ReceiptsInsights() {
  const [receipts, setReceipts] = useState<StoredReceipt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/receipts")
        const payload = (await response.json()) as { receipts?: StoredReceipt[] }
        setReceipts(payload.receipts ?? [])
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load summary."
        )
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  const totals = useMemo(() => {
    const totalSpend = receipts.reduce((sum, receipt) => sum + receipt.totalAmountDue, 0)
    const vatTotal = receipts.reduce((sum, receipt) => sum + receipt.vatAmount, 0)
    const unreviewed = receipts.filter((receipt) => receipt.reviewStatus === "new").length

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthCount = receipts.filter(
      (receipt) => new Date(receipt.createdAt) >= start
    ).length

    return {
      totalSpend,
      vatTotal,
      unreviewed,
      thisMonthCount,
    }
  }, [receipts])

  const duplicates = useMemo(() => duplicateIds(receipts), [receipts])

  const monthly = useMemo(() => {
    const map = new Map<string, number>()

    for (const receipt of receipts) {
      const key = monthLabel(receipt.createdAt)
      map.set(key, (map.get(key) ?? 0) + receipt.totalAmountDue)
    }

    return Array.from(map.entries()).map(([label, amount]) => ({ label, amount }))
  }, [receipts])

  const maxMonthly = Math.max(1, ...monthly.map((item) => item.amount))

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()

    for (const receipt of receipts) {
      for (const item of receipt.items) {
        const key = item.category.trim() || "Uncategorized"
        map.set(key, (map.get(key) ?? 0) + item.price)
      }
    }

    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [receipts])

  const byMerchant = useMemo(() => {
    const map = new Map<string, number>()

    for (const receipt of receipts) {
      const key = receipt.merchantName.trim() || "Unknown merchant"
      map.set(key, (map.get(key) ?? 0) + receipt.totalAmountDue)
    }

    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
  }, [receipts])

  const uncategorizedTotal = useMemo(() => {
    return receipts.reduce((sum, receipt) => {
      const add = receipt.items
        .filter((item) => (item.category || "").trim().toLowerCase() === "uncategorized")
        .reduce((lineSum, item) => lineSum + item.price, 0)

      return sum + add
    }, 0)
  }, [receipts])

  const needsFix = useMemo(
    () => receipts.filter((receipt) => hasMissingFields(receipt)).slice(0, 10),
    [receipts]
  )

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-2">
            <Badge variant="outline" className="w-fit">
              Insights
            </Badge>
            <CardTitle className="text-3xl sm:text-5xl">
              Spend and quality overview
            </CardTitle>
            <CardDescription className="text-base">
              Track spend by time, category, and merchant while monitoring records that need attention.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/receipts">Open receipts</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to upload</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Total spend" value={formatCurrency(totals.totalSpend)} />
          <MetricCard label="VAT total" value={formatCurrency(totals.vatTotal)} />
          <MetricCard label="Unreviewed" value={String(totals.unreviewed)} />
          <MetricCard label="This month volume" value={String(totals.thisMonthCount)} />
          <MetricCard
            label="Duplicate risk"
            value={String(duplicates.size)}
            warning={duplicates.size > 0}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Spend by month</CardTitle>
              <CardDescription>Recent monthly totals from saved receipts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                monthly.map((entry) => (
                  <div key={entry.label} className="grid gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{entry.label}</span>
                      <span className="font-medium">{formatCurrency(entry.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(8, (entry.amount / maxMonthly) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receipts that need fixing</CardTitle>
              <CardDescription>
                Missing details or low clarity records to review first.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needsFix.length > 0 ? (
                    needsFix.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>{receipt.merchantName || "Unknown merchant"}</TableCell>
                        <TableCell>{formatCurrency(receipt.totalAmountDue)}</TableCell>
                        <TableCell>
                          {!receipt.merchantName || !receipt.tinNumber || !receipt.purchaseDate ? (
                            <Badge variant="warning">Missing details</Badge>
                          ) : (
                            <Badge variant="outline">
                              Clarity score {Math.round(receipt.confidence)}%
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Nothing to fix right now.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="bg-muted/20">
            <CardHeader>
              <CardTitle>Spend by category</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {byCategory.length > 0 ? (
                byCategory.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span>{entry.label}</span>
                    <span className="font-medium">{formatCurrency(entry.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No category data yet.</p>
              )}
              <div className="rounded-md border border-dashed bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">Uncategorized total: </span>
                <span className="font-medium">{formatCurrency(uncategorizedTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20">
            <CardHeader>
              <CardTitle>Spend by merchant</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {byMerchant.length > 0 ? (
                byMerchant.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <span className="truncate">{entry.label}</span>
                    <span className="font-medium">{formatCurrency(entry.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No merchant data yet.</p>
              )}
            </CardContent>
          </Card>
        </section>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  )
}

function MetricCard({
  label,
  value,
  warning = false,
}: {
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3", warning && "border-amber-300/70")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
