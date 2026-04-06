"use client"

import Link from "next/link"
import { CheckCircle2, LoaderCircle, PencilLine } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"
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
import {
  useEditReceiptMutation,
  useReceiptsQuery,
  useUpdateReceiptsMutation,
} from "@/lib/queries/receipts"
import { cn } from "@/lib/utils"

type ReviewStatus = StoredReceipt["reviewStatus"]
type DateRange = "all" | "30d" | "this-month"
type SortBy = "newest" | "oldest" | "amount-high" | "amount-low"
type FeedbackTone = "success" | "info"
type EditReceiptForm = {
  merchantName: string
  tinNumber: string
  officialReceiptNumber: string
  purchaseDate: string
  totalAmountDue: string
  taxableSales: string
  vatAmount: string
  reviewStatus: ReviewStatus
  category: string
  notes: string
}

const statusLabel: Record<ReviewStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  posted: "Posted",
  archived: "Archived",
}
const emptyReceipts: StoredReceipt[] = []

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
  const [errorMessage, setErrorMessage] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("info")
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditReceiptForm | null>(null)
  const [editErrorMessage, setEditErrorMessage] = useState("")

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [merchantFilter, setMerchantFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortBy>("newest")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const receiptsQuery = useReceiptsQuery()
  const updateReceiptsMutation = useUpdateReceiptsMutation()
  const editReceiptMutation = useEditReceiptMutation()
  const receipts = receiptsQuery.data ?? emptyReceipts
  const isLoading = receiptsQuery.isLoading
  const isRefreshing = receiptsQuery.isFetching && !isLoading
  const isSaving = updateReceiptsMutation.isPending
  const isEditSaving = editReceiptMutation.isPending
  const resolvedErrorMessage =
    errorMessage ||
    (receiptsQuery.error instanceof Error
      ? receiptsQuery.error.message
      : "")
  const activeFilterCount = [
    query.trim().length > 0,
    statusFilter !== "all",
    dateRange !== "all",
    merchantFilter !== "all",
    sortBy !== "newest",
  ].filter(Boolean).length
  const editingReceipt =
    receipts.find((receipt) => receipt.id === editingReceiptId) ?? null

  useEffect(() => {
    if (!feedbackMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setFeedbackMessage("")
    }, 2800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedbackMessage])

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

    setErrorMessage("")

    try {
      const affectedCount = selectedIds.length
      await updateReceiptsMutation.mutateAsync({
        ids: selectedIds,
        reviewStatus: status,
      })
      setSelectedIds([])
      setFeedbackTone("success")
      setFeedbackMessage(
        `${affectedCount} receipt${affectedCount === 1 ? "" : "s"} marked ${statusLabel[status].toLowerCase()}.`
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update selected receipts."
      )
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
    setErrorMessage("")
    setFeedbackTone("success")
    setFeedbackMessage(
      `Exported ${filteredReceipts.length} visible receipt${filteredReceipts.length === 1 ? "" : "s"}.`
    )
  }

  function closeFiltersWithFeedback() {
    setIsFilterOpen(false)
    setErrorMessage("")
    setFeedbackTone("info")
    if (activeFilterCount === 0) {
      setFeedbackMessage(`${filteredReceipts.length} receipt${filteredReceipts.length === 1 ? "" : "s"} shown.`)
      return
    }

    setFeedbackMessage(
      `Filters updated. ${filteredReceipts.length} receipt${filteredReceipts.length === 1 ? "" : "s"} shown.`
    )
  }

  function openEditDialog(receipt: StoredReceipt) {
    setEditingReceiptId(receipt.id)
    setEditForm(buildEditReceiptForm(receipt))
    setEditErrorMessage("")
  }

  function closeEditDialog() {
    if (isEditSaving) {
      return
    }

    setEditingReceiptId(null)
    setEditForm(null)
    setEditErrorMessage("")
  }

  function updateEditForm<Field extends keyof EditReceiptForm>(
    field: Field,
    value: EditReceiptForm[Field]
  ) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current))
  }

  async function saveReceiptEdits() {
    if (!editingReceiptId || !editForm) {
      return
    }

    const totalAmountDue = Number(editForm.totalAmountDue)
    const taxableSales = Number(editForm.taxableSales)
    const vatAmount = Number(editForm.vatAmount)

    if (
      Number.isNaN(totalAmountDue) ||
      Number.isNaN(taxableSales) ||
      Number.isNaN(vatAmount) ||
      totalAmountDue < 0 ||
      taxableSales < 0 ||
      vatAmount < 0
    ) {
      setEditErrorMessage("Amounts must be valid zero-or-greater numbers.")
      return
    }

    setEditErrorMessage("")

    try {
      const updatedReceipt = await editReceiptMutation.mutateAsync({
        id: editingReceiptId,
        merchantName: editForm.merchantName.trim(),
        tinNumber: editForm.tinNumber.trim(),
        officialReceiptNumber: editForm.officialReceiptNumber.trim(),
        purchaseDate: editForm.purchaseDate.trim(),
        totalAmountDue,
        taxableSales,
        vatAmount,
        notes: editForm.notes,
        reviewStatus: editForm.reviewStatus,
        category: editForm.category.trim() || "Uncategorized",
      })

      closeEditDialog()
      setErrorMessage("")
      setFeedbackTone("success")
      setFeedbackMessage(
        `Updated ${updatedReceipt.merchantName || updatedReceipt.sourceFileName}.`
      )
    } catch (error) {
      setEditErrorMessage(
        error instanceof Error ? error.message : "Could not update this receipt."
      )
    }
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
          {isLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <SummaryCard label="Total spend" value={formatCurrency(totals.totalSpend)} />
              <SummaryCard label="VAT total" value={formatCurrency(totals.vatTotal)} />
              <SummaryCard label="Need review" value={String(totals.unreviewed)} />
              <SummaryCard label="This month" value={String(totals.thisMonth)} />
            </>
          )}
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
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isSaving || selectedIds.length === 0}
                onClick={() => applyStatus("reviewed")}
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Mark reviewed
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isSaving || selectedIds.length === 0}
                onClick={() => applyStatus("posted")}
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Mark posted
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isSaving || selectedIds.length === 0}
                onClick={() => applyStatus("archived")}
              >
                {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Archive
              </Button>
              <Button size="sm" variant="outline" disabled={filteredReceipts.length === 0} onClick={exportVisibleList}>
                Export visible list
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-h-9 items-center">
                {feedbackMessage ? (
                  <div
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-all duration-200",
                      feedbackTone === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border bg-muted/60 text-muted-foreground"
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    {feedbackTone === "success" ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <LoaderCircle className="size-4" />
                    )}
                    <span>{feedbackMessage}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex min-h-9 items-center text-sm text-muted-foreground">
                {isRefreshing ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="size-4 animate-spin" />
                    Refreshing receipts...
                  </span>
                ) : (
                  <span>{selectedIds.length > 0 ? `${selectedIds.length} receipt${selectedIds.length === 1 ? "" : "s"} ready for bulk action.` : "Select receipts to run bulk actions."}</span>
                )}
              </div>
            </div>

            {isLoading ? (
              <ReceiptsTableSkeleton />
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
                    <TableRow
                      key={receipt.id}
                      className={cn(
                        "transition-colors duration-200",
                        selectedSet.has(receipt.id) && "bg-primary/5"
                      )}
                    >
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
                        <div className="flex justify-end gap-2">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => openEditDialog(receipt)}
                          >
                            <PencilLine data-icon="inline-start" />
                            Edit
                          </Button>
                          <Button size="xs" variant="outline" asChild>
                            <a href={receipt.sourceFileUrl} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {resolvedErrorMessage ? (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resolvedErrorMessage}
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
                  <Button size="sm" onClick={closeFiltersWithFeedback}>
                    Apply filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {editingReceipt && editForm ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center">
            <Card className="max-h-[90svh] w-full max-w-5xl overflow-y-auto">
              <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>Edit receipt</CardTitle>
                  <CardDescription>
                    Update the extracted bookkeeping fields for {editingReceipt.sourceFileName}.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={closeEditDialog} disabled={isEditSaving}>
                  Close
                </Button>
              </CardHeader>
              <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                <div className="grid gap-4 md:grid-cols-2">
                  <EditField label="Merchant name">
                    <Input
                      value={editForm.merchantName}
                      onChange={(event) => updateEditForm("merchantName", event.target.value)}
                      placeholder="Merchant"
                    />
                  </EditField>

                  <EditField label="TIN">
                    <Input
                      value={editForm.tinNumber}
                      onChange={(event) => updateEditForm("tinNumber", event.target.value)}
                      placeholder="TIN number"
                    />
                  </EditField>

                  <EditField label="Receipt number">
                    <Input
                      value={editForm.officialReceiptNumber}
                      onChange={(event) =>
                        updateEditForm("officialReceiptNumber", event.target.value)
                      }
                      placeholder="OR number"
                    />
                  </EditField>

                  <EditField label="Purchase date">
                    <Input
                      value={editForm.purchaseDate}
                      onChange={(event) => updateEditForm("purchaseDate", event.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </EditField>

                  <EditField label="Total amount due">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.totalAmountDue}
                      onChange={(event) => updateEditForm("totalAmountDue", event.target.value)}
                    />
                  </EditField>

                  <EditField label="Taxable sales">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.taxableSales}
                      onChange={(event) => updateEditForm("taxableSales", event.target.value)}
                    />
                  </EditField>

                  <EditField label="VAT amount">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.vatAmount}
                      onChange={(event) => updateEditForm("vatAmount", event.target.value)}
                    />
                  </EditField>

                  <FilterSelect
                    label="Review status"
                    value={editForm.reviewStatus}
                    onChange={(value) => updateEditForm("reviewStatus", value as ReviewStatus)}
                    options={[
                      { value: "new", label: "New" },
                      { value: "reviewed", label: "Reviewed" },
                      { value: "posted", label: "Posted" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />

                  <div className="md:col-span-2">
                    <EditField label="Category for line items">
                      <Input
                        value={editForm.category}
                        onChange={(event) => updateEditForm("category", event.target.value)}
                        placeholder="Uncategorized"
                      />
                    </EditField>
                  </div>

                  <div className="md:col-span-2">
                    <EditField label="Notes">
                      <textarea
                        value={editForm.notes}
                        onChange={(event) => updateEditForm("notes", event.target.value)}
                        placeholder="Add bookkeeping notes"
                        className="min-h-32 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                      />
                    </EditField>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border bg-muted/25 p-4">
                    <p className="text-sm font-medium">Current receipt context</p>
                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Source file:</span>{" "}
                        {editingReceipt.sourceFileName}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Detected items:</span>{" "}
                        {editingReceipt.items.length}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Confidence:</span>{" "}
                        {Math.round(editingReceipt.confidence)}%
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Saved:</span>{" "}
                        {formatDate(editingReceipt.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/25 p-4">
                    <p className="text-sm font-medium">Line item preview</p>
                    <div className="mt-3 grid gap-2">
                      {editingReceipt.items.length > 0 ? (
                        editingReceipt.items.slice(0, 5).map((item, index) => (
                          <div
                            key={`${item.description}-${index}`}
                            className="rounded-xl border bg-background px-3 py-2 text-sm"
                          >
                            <div className="font-medium text-foreground">
                              {item.description || "Untitled item"}
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              Qty {item.quantity} • {formatCurrency(item.price)} • {item.category || "Uncategorized"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No line items found on this receipt.</p>
                      )}
                    </div>
                  </div>

                  {editErrorMessage ? (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {editErrorMessage}
                    </div>
                  ) : null}

                  <div className="mt-auto flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={closeEditDialog} disabled={isEditSaving}>
                      Cancel
                    </Button>
                    <Button onClick={saveReceiptEdits} disabled={isEditSaving}>
                      {isEditSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                      Save changes
                    </Button>
                  </div>
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

function EditField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function SummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-7 w-28 animate-pulse rounded bg-muted" />
    </div>
  )
}

function ReceiptsTableSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-xl border bg-muted/20 p-3">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-60 animate-pulse rounded bg-muted" />
      </div>
      <div className="overflow-hidden rounded-xl border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[2.5rem_minmax(0,1.5fr)_0.8fr_0.9fr_0.7fr_0.9fr_0.8fr_0.8fr_0.7fr] gap-3 border-b px-4 py-4 last:border-b-0"
          >
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted justify-self-end" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted justify-self-end" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted justify-self-end" />
          </div>
        ))}
      </div>
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

function buildEditReceiptForm(receipt: StoredReceipt): EditReceiptForm {
  return {
    merchantName: receipt.merchantName,
    tinNumber: receipt.tinNumber,
    officialReceiptNumber: receipt.officialReceiptNumber,
    purchaseDate: receipt.purchaseDate,
    totalAmountDue: String(receipt.totalAmountDue),
    taxableSales: String(receipt.taxableSales),
    vatAmount: String(receipt.vatAmount),
    reviewStatus: receipt.reviewStatus,
    category: mainCategory(receipt),
    notes: receipt.notes,
  }
}
