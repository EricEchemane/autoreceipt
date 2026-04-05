import { redirect } from "next/navigation"

import { BillingActions } from "@/components/billing-actions"
import { BillingUsageSimulator } from "@/components/billing-usage-simulator"
import { OrganizationInvitesPanel } from "@/components/organization-invites-panel"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getServerOrganizationSession } from "@/lib/auth-organization"
import { isBusinessPlan, syncBillingStatusForOrganization } from "@/lib/billing"
import { listOrganizationInvites, listOrganizationMembers } from "@/lib/organization"

function formatBillingStatus(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "Active"
    case "trialing":
      return "Trial active"
    case "pending":
      return "Processing payment"
    case "requires_action":
      return "Action needed: finish payment setup"
    case "cancelled":
    case "canceled":
      return "Cancelled"
    case "inactive":
    default:
      return "Not active"
  }
}

function getBillingStatusHelp(status: string | null | undefined) {
  if (status === "requires_action") {
    return "Please tap Continue setup to finish payment authorization and activate your plan."
  }

  if (status === "pending") {
    return "Your payment is being processed. This usually updates automatically."
  }

  return null
}

function normalizeCurrentPlan(plan: string | null | undefined) {
  const lower = (plan ?? "").toLowerCase()

  if (lower.includes("business")) {
    return "business" as const
  }

  if (lower.includes("pro")) {
    return "pro" as const
  }

  return "free" as const
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan: requestedPlanParam } = await searchParams
  const { session, organization, membership } = await getServerOrganizationSession()

  if (!session?.user || !organization) {
    redirect("/sign-in")
  }

  let billing = await syncBillingStatusForOrganization(organization.id)

  if (
    billing?.providerSubscriptionId &&
    (billing.status === "pending" || billing.status === "requires_action")
  ) {
    billing = await syncBillingStatusForOrganization(organization.id)
  }

  const hasActiveBilling =
    billing?.status === "active" || billing?.status === "trialing"
  const hasPendingBilling =
    billing?.status === "pending" || billing?.status === "requires_action"
  const needsAction = billing?.status === "requires_action"
  const canCancelBilling =
    Boolean(billing?.providerCustomerId && billing?.providerSubscriptionId) &&
    (hasActiveBilling || hasPendingBilling)
  const businessPlanEnabled = isBusinessPlan(billing?.plan)
  const currentPlan = normalizeCurrentPlan(billing?.plan)
  const requestedPlan =
    requestedPlanParam?.toLowerCase() === "business" ? "business" : "pro"
  const statusLabel = formatBillingStatus(billing?.status)
  const statusHelp = getBillingStatusHelp(billing?.status)
  const [members, invites] = businessPlanEnabled
    ? await Promise.all([
        listOrganizationMembers(organization.id),
        listOrganizationInvites(organization.id),
      ])
    : [[], []]
  const inviteBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  const primaryCheckoutAction =
    currentPlan === "pro" && !hasPendingBilling
      ? {
          plan: "business" as const,
          label: "Upgrade to Business",
          enabled: true,
        }
      : currentPlan === "business"
        ? undefined
        : requestedPlan === "business"
          ? {
              plan: "business" as const,
              label: "Start Business plan",
              enabled: !hasActiveBilling && !hasPendingBilling,
            }
          : {
              plan: "pro" as const,
              label: "Start Pro plan",
              enabled: !hasActiveBilling && !hasPendingBilling,
            }
  const secondaryCheckoutAction =
    currentPlan === "free"
      ? requestedPlan === "business"
        ? {
            plan: "pro" as const,
            label: "Start Pro plan",
            enabled: !hasActiveBilling && !hasPendingBilling,
          }
        : {
            plan: "business" as const,
            label: "Start Business plan",
            enabled: !hasActiveBilling && !hasPendingBilling,
          }
      : undefined

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Account info</CardTitle>
          <CardDescription>
            Basic account details used for your plan and receipts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>
            Name:{" "}
            <span className="font-medium text-foreground">
              {session.user.name || "Not set"}
            </span>
          </p>
          <p>
            Email:{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>
          </p>
          <p>
            Account ID:{" "}
            <span className="font-medium text-foreground">{session.user.id}</span>
          </p>
          <p>
            Workspace:{" "}
            <span className="font-medium text-foreground">{organization.name}</span>
          </p>
          <p>
            Role:{" "}
            <span className="font-medium text-foreground">{membership?.role ?? "member"}</span>
          </p>
          <p>
            Billing profile:{" "}
            <span className="font-medium text-foreground">
              {billing?.providerCustomerId ? "Connected" : "Not connected"}
            </span>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              Manage your plan and unlock higher receipt volume.
            </CardDescription>
          </div>
          <Badge variant={hasActiveBilling ? "success" : "outline"}>
            {hasActiveBilling ? "Active plan" : "Free plan"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              Current plan: <span className="font-medium text-foreground">{billing?.plan ?? "free"}</span>
            </p>
            <p>
              Status: <span className="font-medium text-foreground">{statusLabel}</span>
            </p>
            {statusHelp ? (
              <p className="text-xs text-foreground/80">{statusHelp}</p>
            ) : null}
          </div>
          <BillingActions
            primaryCheckoutAction={primaryCheckoutAction}
            secondaryCheckoutAction={secondaryCheckoutAction}
            canCancelBilling={canCancelBilling}
            canResumeAction={needsAction}
            canRefreshStatus={Boolean(billing?.providerSubscriptionId)}
          />
          <BillingUsageSimulator devMode={process.env.NODE_ENV !== "production"} />
        </CardContent>
      </Card>
      {businessPlanEnabled ? (
        <OrganizationInvitesPanel
          organizationName={organization.name}
          canManageInvites={
            membership?.role === "owner" || membership?.role === "admin"
          }
          initialMembers={members}
          initialInvites={invites}
          inviteBaseUrl={inviteBaseUrl}
        />
      ) : null}
    </main>
  )
}
