import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function HomeMarketingSections() {
  return (
    <>
      <section className="mt-6 flex flex-col gap-3 sm:mt-8 lg:mt-10">
        <Separator />
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit">
            Why teams choose AutoReceipt
          </Badge>
          <CardTitle className="text-2xl sm:text-3xl">
            Built for everyday bookkeeping work
          </CardTitle>
          <CardDescription>
            Keep records clean, complete, and ready for posting with less manual effort.
          </CardDescription>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background px-3 py-2 text-sm">
          Secure file storage
        </div>
        <div className="rounded-xl border bg-background px-3 py-2 text-sm">
          Full receipt history
        </div>
        <div className="rounded-xl border bg-background px-3 py-2 text-sm">
          Duplicate detection
        </div>
        <div className="rounded-xl border bg-background px-3 py-2 text-sm">
          Export-ready records
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Step 1
            </Badge>
            <CardTitle className="text-xl">Upload receipts</CardTitle>
            <CardDescription>
              Add image or PDF receipts in one batch.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Step 2
            </Badge>
            <CardTitle className="text-xl">Review and confirm</CardTitle>
            <CardDescription>
              Check merchant, tax, and line details before posting.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Step 3
            </Badge>
            <CardTitle className="text-xl">Export and post</CardTitle>
            <CardDescription>
              Export clean records and complete bookkeeping faster.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Designed for real teams</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border px-3 py-3">
              <p className="text-sm font-medium">Business owners</p>
              <p className="text-sm text-muted-foreground">
                Track expenses without manual entry.
              </p>
            </div>
            <div className="rounded-xl border px-3 py-3">
              <p className="text-sm font-medium">Bookkeepers</p>
              <p className="text-sm text-muted-foreground">
                Review and correct receipts quickly.
              </p>
            </div>
            <div className="rounded-xl border px-3 py-3">
              <p className="text-sm font-medium">Finance teams</p>
              <p className="text-sm text-muted-foreground">
                Maintain clean records for month-end closing.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Common questions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-xl border px-3 py-3">
              <p className="text-sm font-medium">What files are supported?</p>
              <p className="text-sm text-muted-foreground">
                PNG, JPG, WEBP, and PDF receipts.
              </p>
            </div>
            <div className="rounded-xl border px-3 py-3">
              <p className="text-sm font-medium">Can I fix receipt details?</p>
              <p className="text-sm text-muted-foreground">
                Yes. Use the receipts page to review and update records.
              </p>
            </div>
            <div className="rounded-xl border px-3 py-3">
              <p className="text-sm font-medium">How are duplicates handled?</p>
              <p className="text-sm text-muted-foreground">
                Possible duplicates are flagged for quick checking.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl sm:text-3xl">
              Ready to clean up your receipt workflow?
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              Start with a batch upload, then manage everything from the receipts page.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/receipts">Open receipts</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/insights">Open summary</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

