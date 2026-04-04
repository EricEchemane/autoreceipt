"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { utils as xlsxUtils, writeFile as writeXlsxFile } from "xlsx"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ReviewStatus = StoredReceipt["reviewStatus"]
type DateRange = "all" | "30d" | "this-month"
type SortBy = "newest" | "oldest" | "amount-high" | "amount-low"

const statusLabel: Record<ReviewStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  posted: "Posted",
  archived: "Archived",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(value)
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(parsed)
}

function mainCategory(receipt: StoredReceipt) {
  const counts = new Map<string, number>()
  for (const item of receipt.items) {
    const key = item.category?.trim() || "Uncategorized"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Uncategorized"
}

function duplicateIds(receipts: StoredReceipt[]) {
  const counts = new Map<string, number>()
  const keys = new Map<string, string>()

  for (const receipt of receipts) {
    const merchant = (receipt.merchantName || "unknown").trim().toLowerCase()
    const created = new Date(receipt.createdAt)
    const dayKey = Number.isNaN(created.getTime())
      ? "unknown"
      : created.toISOString().slice(0, 10)
    const amountKey = Math.round(receipt.totalAmountDue)
    const key = `${merchant}:${dayKey}:${amountKey}`

    counts.set(key, (counts.get(key) ?? 0) + 1)
    keys.set(receipt.id, key)
  }

  return new Set(
    Array.from(keys.entries())
      .filter(([, key]) => (counts.get(key) ?? 0) > 1)
      .map(([id]) => id)
  )
}

export function ReceiptsWorkspace() {
  const [receipts, setReceipts] = useState<StoredReceipt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [merchantFilter, setMerchantFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortBy>("newest")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  useEffect(() => {
    async function loadReceipts() {
      try {
        const response = await fetch("/api/receipts")
        const payload = (await response.json()) as { receipts?: StoredReceipt[] }
        setReceipts(payload.receipts ?? [])
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load saved receipts."
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadReceipts()
  }, [])

  const merchants = useMemo(
    () =>
      Array.from(
        new Set(
          receipts
            .map((receipt) => receipt.merchantName.trim())
            .filter((value) => value.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [receipts]
  )

  const nearDuplicates = useMemo(() => duplicateIds(receipts), [receipts])

  const filteredReceipts = useMemo(() => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const lowerQuery = query.trim().toLowerCase()

    const filtered = receipts.filter((receipt) => {
      if (statusFilter !== "all" && receipt.reviewStatus !== statusFilter) {
        return false
      }

      if (
        merchantFilter !== "all" &&
        receipt.merchantName.toLowerCase() !== merchantFilter.toLowerCase()
      ) {
        return false
      }

      const created = new Date(receipt.createdAt)
      if (dateRange === "30d" && created < last30Days) {
        return false
      }
      if (dateRange === "this-month" && created < thisMonth) {
        return false
      }

      if (!lowerQuery) {
        return true
      }

      const haystack = [
        receipt.merchantName,
        receipt.tinNumber,
        receipt.officialReceiptNumber,
        receipt.sourceFileName,
        receipt.totalAmountDue.toString(),
        ...receipt.items.map((item) => item.description),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(lowerQuery)
    })

    filtered.sort((left, right) => {
      if (sortBy === "oldest") {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      }
      if (sortBy === "amount-high") {
        return right.totalAmountDue - left.totalAmountDue
      }
      if (sortBy === "amount-low") {
        return left.totalAmountDue - right.totalAmountDue
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    })

    return filtered
  }, [dateRange, merchantFilter, query, receipts, sortBy, statusFilter])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const totals = useMemo(() => {
    const totalSpend = filteredReceipts.reduce(
      (sum, receipt) => sum + receipt.totalAmountDue,
      0
    )
    const vatTotal = filteredReceipts.reduce((sum, receipt) => sum + receipt.vatAmount, 0)
    const unreviewed = filteredReceipts.filter(
      (receipt) => receipt.reviewStatus === "new"
    ).length
    const thisMonth = filteredReceipts.filter((receipt) => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return new Date(receipt.createdAt) >= start
    }).length

    return { totalSpend, vatTotal, unreviewed, thisMonth }
  }, [filteredReceipts])

  async function applyStatus(status: ReviewStatus) {
    if (selectedIds.length === 0) {
      setErrorMessage("Select one or more receipts first.")
      return
    }

    setIsSaving(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, reviewStatus: status }),
      })
      const data = (await response.json()) as { receipts?: StoredReceipt[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update selected receipts.")
      }

      setReceipts(data.receipts ?? [])
      setSelectedIds([])
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update selected receipts."
      )
    } finally {
      setIsSaving(false)
    }
  }

  function toggleSelection(id: string, checked: boolean | "indeterminate") {
    setSelectedIds((current) => {
      if (checked === true) {
        if (current.includes(id)) {
          return current
        }
        return [...current, id]
      }

      return current.filter((value) => value !== id)
    })
  }

  function exportVisibleList() {
    if (filteredReceipts.length === 0) {
      setErrorMessage("No receipts available to export.")
      return
    }

    const rows = filteredReceipts.map((receipt) => ({
      Merchant: receipt.merchantName,
      TIN: receipt.tinNumber,
      "Receipt Number": receipt.officialReceiptNumber,
      "Purchase Date": receipt.purchaseDate,
      "Total Amount": receipt.totalAmountDue,
      VAT: receipt.vatAmount,
      "Main Category": mainCategory(receipt),
      Stage: statusLabel[receipt.reviewStatus],
      "Saved Date": receipt.createdAt,
      File: receipt.sourceFileName,
    }))

    const worksheet = xlsxUtils.json_to_sheet(rows)
    const workbook = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(workbook, worksheet, "Receipts")
    writeXlsxFile(workbook, `receipts-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-3xl flex-col gap-2">
            <Badge variant="outline" className="w-fit">
              Receipts
            </Badge>
            <CardTitle className="text-3xl sm:text-5xl">
              Manage saved receipts
            </CardTitle>
            <CardDescription className="text-base">
              Search, review, and update receipts before posting.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/insights">Open summary</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to upload</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total spend" value={formatCurrency(totals.totalSpend)} />
          <SummaryCard label="VAT total" value={formatCurrency(totals.vatTotal)} />
          <SummaryCard label="Need review" value={String(totals.unreviewed)} />
          <SummaryCard label="This month" value={String(totals.thisMonth)} />
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>Receipts list</CardTitle>
              <CardDescription>
                {filteredReceipts.length} shown • {selectedIds.length} selected
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsFilterOpen(true)}>
                Find & filter
              </Button>
              <Button size="sm" variant="outline" disabled={isSaving} onClick={() => applyStatus("reviewed")}>
                Mark reviewed
              </Button>
              <Button size="sm" variant="outline" disabled={isSaving} onClick={() => applyStatus("posted")}>
                Mark posted
              </Button>
              <Button size="sm" variant="outline" disabled={isSaving} onClick={() => applyStatus("archived")}>
                Archive
              </Button>
              <Button size="sm" variant="outline" onClick={exportVisibleList}>
                Export visible list
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading receipts...</p>
            ) : filteredReceipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No receipts found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Pick</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total amount due</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Duplicate</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(receipt.id)}
                          onCheckedChange={(checked) => toggleSelection(receipt.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-44 flex-col gap-1">
                          <span className="font-medium">
                            {receipt.merchantName || "Unknown merchant"}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {receipt.sourceFileName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(receipt.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(receipt.totalAmountDue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(receipt.vatAmount)}
                      </TableCell>
                      <TableCell>{mainCategory(receipt)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge(receipt.reviewStatus)}>
                          {statusLabel[receipt.reviewStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {nearDuplicates.has(receipt.id) ? (
                          <Badge variant="warning">Possible</Badge>
                        ) : (
                          <Badge variant="outline">Low</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" asChild>
                          <a href={receipt.sourceFileUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {errorMessage ? (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isFilterOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
            <Card className="max-h-[90svh] w-full max-w-4xl overflow-y-auto">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>Find receipts</CardTitle>
                  <CardDescription>
                    Filter the list without leaving this page.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setIsFilterOpen(false)}>
                  Close
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="xl:col-span-2">
                  <label className="mb-1.5 block text-xs text-muted-foreground">Search</label>
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Merchant, TIN, amount, item, file"
                  />
                </div>

                <FilterSelect
                  label="Stage"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                  options={[
                    { value: "all", label: "All stages" },
                    { value: "new", label: "New" },
                    { value: "reviewed", label: "Reviewed" },
                    { value: "posted", label: "Posted" },
                    { value: "archived", label: "Archived" },
                  ]}
                />

                <FilterSelect
                  label="Date"
                  value={dateRange}
                  onChange={(value) => setDateRange(value as DateRange)}
                  options={[
                    { value: "all", label: "All time" },
                    { value: "30d", label: "Last 30 days" },
                    { value: "this-month", label: "This month" },
                  ]}
                />

                <FilterSelect
                  label="Sort"
                  value={sortBy}
                  onChange={(value) => setSortBy(value as SortBy)}
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "oldest", label: "Oldest first" },
                    { value: "amount-high", label: "Amount high to low" },
                    { value: "amount-low", label: "Amount low to high" },
                  ]}
                />

                <div className="md:col-span-2 xl:col-span-5">
                  <FilterSelect
                    label="Merchant"
                    value={merchantFilter}
                    onChange={setMerchantFilter}
                    options={[
                      { value: "all", label: "All merchants" },
                      ...merchants.map((merchant) => ({ value: merchant, label: merchant })),
                    ]}
                  />
                </div>

                <div className="md:col-span-2 xl:col-span-5 flex justify-end">
                  <Button size="sm" onClick={() => setIsFilterOpen(false)}>
                    Apply filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  )
}

function statusBadge(status: ReviewStatus) {
  if (status === "posted") return "success" as const
  if (status === "archived") return "secondary" as const
  if (status === "reviewed") return "outline" as const
  return "warning" as const
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
