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
  const featureCardClassName =
    "flex h-full min-h-[22rem] flex-col border-border bg-card/70 shadow-none"
  const featureCardHeaderClassName = "min-h-[8.5rem] gap-3"
  const stackItemClassName =
    "flex flex-1 flex-col justify-center rounded-2xl border bg-background/70 px-4 py-4"

  const outcomes = [
    {
      title: "Faster intake",
      description:
        "Move from scattered receipt photos to structured records in one working flow.",
    },
    {
      title: "Safer review",
      description:
        "Check merchant, tax, totals, and line details before anything reaches your books.",
    },
    {
      title: "Cleaner recordkeeping",
      description:
        "Keep original files, extracted data, and saved receipt history together.",
    },
  ]

  const audiences = [
    {
      title: "Bookkeepers",
      description: "Review more receipts with less manual entry and fewer follow-ups.",
    },
    {
      title: "Accounting officers",
      description: "Catch missing or suspicious details before posting and reconciliation.",
    },
    {
      title: "Admins and finance leads",
      description: "Keep receipt records organized, reviewable, and easier to audit.",
    },
  ]

  const workflow = [
    {
      step: "Step 1",
      title: "Upload receipts",
      description: "Add receipt images or PDFs in one batch to start the workflow quickly.",
    },
    {
      step: "Step 2",
      title: "Review extracted details",
      description: "Check merchant, totals, tax, and line items before finalizing records.",
    },
    {
      step: "Step 3",
      title: "Save and manage records",
      description: "Keep receipts ready for follow-up, export, reimbursement, or posting.",
    },
  ]

  const objections = [
    {
      question: "What files are supported?",
      answer: "PNG, JPG, WEBP, and PDF receipts are supported in the workspace.",
    },
    {
      question: "Can we correct receipt details?",
      answer: "Yes. Teams can review and update saved receipt records from the receipts page.",
    },
    {
      question: "How are duplicates handled?",
      answer: "Duplicate checks run before saving so repeated uploads do not clutter records.",
    },
  ]

  return (
    <>
      <section className="mt-6 flex flex-col gap-4 sm:mt-8 lg:mt-10">
        <Separator />
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit">
            Why teams choose AutoReceipt
          </Badge>
          <CardTitle className="text-2xl sm:text-3xl">
            Built for the part of bookkeeping that usually slows teams down
          </CardTitle>
          <CardDescription className="max-w-3xl leading-7">
            The homepage should make one thing clear: AutoReceipt helps teams start
            quickly, review confidently, and keep records organized after the batch is done.
          </CardDescription>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {outcomes.map((item) => (
          <Card key={item.title} className="border-border bg-card/70 shadow-none">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                Outcome
              </Badge>
              <CardTitle className="text-xl">{item.title}</CardTitle>
              <CardDescription className="leading-7">
                {item.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className={featureCardClassName}>
          <CardHeader className={featureCardHeaderClassName}>
            <Badge variant="outline" className="w-fit">
              Who it&apos;s for
            </Badge>
            <CardTitle className="text-2xl">Designed for the people who actually close the books</CardTitle>
            <CardDescription className="leading-7">
              AutoReceipt is most useful when the first screen supports real accounting work,
              not just a marketing demo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3">
            {audiences.map((item) => (
              <div key={item.title} className={stackItemClassName}>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={featureCardClassName}>
          <CardHeader className={featureCardHeaderClassName}>
            <Badge variant="outline" className="w-fit">
              How it works
            </Badge>
            <CardTitle className="text-2xl">One workflow from upload to saved records</CardTitle>
            <CardDescription className="leading-7">
              Keep the path simple: upload a batch, review extracted details, then move into saved receipts.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3">
            {workflow.map((item) => (
              <div key={item.step} className={stackItemClassName}>
                <Badge variant="secondary" className="w-fit">
                  {item.step}
                </Badge>
                <p className="mt-3 text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={featureCardClassName}>
          <CardHeader className={featureCardHeaderClassName}>
            <Badge variant="outline" className="w-fit">
              Common questions
            </Badge>
            <CardTitle>Answers that remove hesitation</CardTitle>
            <CardDescription className="leading-7">
              The goal here is to help someone feel ready to try the workspace, not to overload them with features.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3">
            {objections.map((item) => (
              <div key={item.question} className={stackItemClassName}>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={featureCardClassName}>
          <CardHeader className={featureCardHeaderClassName}>
            <Badge variant="outline" className="w-fit">
              Ready to try
            </Badge>
            <CardTitle>Start with one batch and see the workflow immediately</CardTitle>
            <CardDescription className="leading-7">
              Use the workspace to test the process, then continue to saved receipts when the batch is complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <div className={`${stackItemClassName} text-sm leading-7 text-muted-foreground`}>
              Start by uploading a few receipts below. The workspace gives you the
              clearest picture of how AutoReceipt fits into real bookkeeping work.
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button asChild>
                <Link href="#workspace">Try the workspace</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/receipts">Open receipts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
