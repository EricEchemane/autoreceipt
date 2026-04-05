import Link from "next/link"
import type { Metadata } from "next"
import { Check } from "lucide-react"
import { getServerSession } from "@/lib/auth-session"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

export const metadata: Metadata = {
  title: "Pricing | AutoReceipt",
  description:
    "Choose the AutoReceipt plan that fits your receipt volume and review workflow.",
}

function formatPlanPrice(params: {
  amount?: string
  currency?: string
  fallback: string
}) {
  const amount = Number(params.amount)

  if (!Number.isFinite(amount) || amount <= 0) {
    return params.fallback
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: params.currency ?? "PHP",
    maximumFractionDigits: 0,
  }).format(amount)
}

const plans = [
  {
    name: "Free",
    price: "₱0",
    cadence: "/month",
    description: "Best for trying the product and handling light receipt work.",
    badge: "Start here",
    ctaLabel: "Create free account",
    signedInCtaLabel: "Stay on Free",
    ctaType: "sign-up" as const,
    variant: "outline" as const,
    features: [
      "5 guest scans without sign-in",
      "3 receipts each month after signup",
      "Receipt review workspace",
      "Saved history in your account",
    ],
    specs: {
      receiptVolume: "3 saved receipts / month",
      users: "1 user",
      teamwork: "No shared workspace",
      controls: "Basic review flow",
    },
  },
  {
    name: "Pro",
    price: "₱499",
    cadence: "/month",
    description: "For solo operators and bookkeepers with steady monthly volume.",
    badge: "Most popular",
    ctaLabel: "Start Pro plan",
    signedInCtaLabel: "Choose Pro",
    ctaType: "plan" as const,
    ctaPlan: "pro" as const,
    variant: "default" as const,
    features: [
      "500 receipts each month",
      "Faster month-end cleanup",
      "Receipt history and file access",
      "Billing and account controls",
    ],
    specs: {
      receiptVolume: "500 receipts / month",
      users: "1 user",
      teamwork: "Personal workspace only",
      controls: "Review, export, and account billing",
    },
  },
  {
    name: "Business",
    price: "Custom",
    cadence: "",
    description: "For teams that need shared receipt access, member invites, and one company billing setup.",
    badge: "Team plan",
    ctaLabel: "Start Business plan",
    signedInCtaLabel: "Upgrade to Business",
    ctaType: "plan" as const,
    ctaPlan: "business" as const,
    variant: "outline" as const,
    features: [
      "Higher monthly receipt volume",
      "Multi-user review workflows",
      "Workspace member invites",
      "Shared workspace billing",
      "Priority onboarding support",
      "Custom plan and usage setup",
    ],
    specs: {
      receiptVolume: "Custom monthly volume",
      users: "Multi-user workspace",
      teamwork: "Shared receipt access and member roles",
      controls: "Workspace billing, invites, and team workflows",
    },
  },
]

const comparisonRows = [
  {
    label: "Monthly receipt volume",
    free: "3 saved",
    pro: "500",
    business: "Custom",
  },
  {
    label: "Guest trial",
    free: "5 scans",
    pro: "5 scans",
    business: "5 scans",
  },
  {
    label: "Saved receipt history",
    free: "Yes",
    pro: "Yes",
    business: "Yes",
  },
  {
    label: "Multi-user workspace",
    free: "No",
    pro: "No",
    business: "Yes",
  },
  {
    label: "Member invites",
    free: "No",
    pro: "No",
    business: "Yes",
  },
  {
    label: "Shared billing",
    free: "No",
    pro: "No",
    business: "Yes",
  },
  {
    label: "Priority onboarding",
    free: "No",
    pro: "No",
    business: "Yes",
  },
]

function buildPlanHref(params: {
  signedIn: boolean
  plan?: "pro" | "business"
  type: "sign-up" | "plan"
}) {
  if (params.type === "sign-up") {
    return "/sign-up"
  }

  const target = params.plan ? `/billing?plan=${params.plan}` : "/billing"

  if (params.signedIn) {
    return target
  }

  return `/sign-up?callbackUrl=${encodeURIComponent(target)}`
}

export default async function PricingPage() {
  const session = await getServerSession()
  const signedIn = Boolean(session?.user)
  const businessPlanPrice = formatPlanPrice({
    amount: process.env.XENDIT_BUSINESS_PLAN_AMOUNT,
    currency: process.env.XENDIT_BUSINESS_PLAN_CURRENCY,
    fallback: "Custom",
  })
  const renderedPlans = plans.map((plan) =>
    plan.name === "Business"
      ? {
          ...plan,
          price: businessPlanPrice,
          cadence: businessPlanPrice === "Custom" ? "" : "/month",
        }
      : plan
  )

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="flex flex-col gap-4">
        <Badge variant="outline" className="w-fit">
          Pricing
        </Badge>
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple pricing for receipt-heavy bookkeeping work.
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
            Start free, prove the workflow on real receipts, and upgrade when you
            need more monthly volume.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {signedIn
              ? "You're signed in, so you can choose a plan and continue straight to billing."
              : "Create an account when you're ready to save receipts and start a paid plan."}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-muted/20 p-5">
          <p className="text-sm font-medium text-foreground">Pro is for individual work</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Best when one person handles receipt cleanup, review, and exports.
          </p>
        </div>
        <div className="rounded-3xl border bg-muted/20 p-5">
          <p className="text-sm font-medium text-foreground">Business is for shared workspaces</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Best when your team needs member invites, role-based access, shared billing,
            and one workspace for company receipts.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {renderedPlans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.name === "Pro" ? "border-primary/40 shadow-sm" : undefined}
          >
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{plan.name}</CardTitle>
                <Badge variant={plan.name === "Pro" ? "secondary" : "outline"}>
                  {plan.badge}
                </Badge>
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                {plan.cadence ? (
                  <span className="pb-1 text-sm text-muted-foreground">
                    {plan.cadence}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-2 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                <p>
                  Receipt volume:{" "}
                  <span className="font-medium text-foreground">
                    {plan.specs.receiptVolume}
                  </span>
                </p>
                <p>
                  Users:{" "}
                  <span className="font-medium text-foreground">{plan.specs.users}</span>
                </p>
                <p>
                  Team setup:{" "}
                  <span className="font-medium text-foreground">
                    {plan.specs.teamwork}
                  </span>
                </p>
                <p>
                  Included controls:{" "}
                  <span className="font-medium text-foreground">
                    {plan.specs.controls}
                  </span>
                </p>
              </div>
              <ul className="grid gap-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.variant}
                asChild
              >
                <Link
                  href={buildPlanHref({
                    signedIn,
                    plan: plan.ctaPlan,
                    type: plan.ctaType,
                  })}
                >
                  {signedIn && "signedInCtaLabel" in plan
                    ? plan.signedInCtaLabel
                    : plan.ctaLabel}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Pro vs Business
            </Badge>
            <CardTitle>When to move from Pro to Business</CardTitle>
            <CardDescription>
              Pro is built for one person. Business is built for shared bookkeeping work.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Choose Pro if:</p>
              <p className="mt-1 leading-6">
                You manage receipts on your own, need a higher monthly limit, and
                do not need shared access for teammates.
              </p>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="font-medium text-foreground">Choose Business if:</p>
              <p className="mt-1 leading-6">
                Your team needs member invites, shared workspace access, team roles,
                and one billing setup for the whole company.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan comparison</CardTitle>
            <CardDescription>
              A quick side-by-side view of the limits and workspace features.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Free</TableHead>
                  <TableHead>Pro</TableHead>
                  <TableHead>Business</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell>{row.free}</TableCell>
                    <TableCell>{row.pro}</TableCell>
                    <TableCell>{row.business}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border bg-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Not ready to create an account yet?
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              You can still try up to 5 receipts on the homepage before signing up.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">Try the workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
