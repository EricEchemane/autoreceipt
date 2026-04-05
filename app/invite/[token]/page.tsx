import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { AcceptInviteCard } from "@/components/accept-invite-card"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getServerSession } from "@/lib/auth-session"
import { db } from "@/lib/db"
import { organizations } from "@/lib/db/schema"
import { getOrganizationInviteByToken } from "@/lib/organization"
import { eq } from "drizzle-orm"

export const metadata: Metadata = {
  title: "Workspace invite | AutoReceipt",
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await getOrganizationInviteByToken(token)

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>
              This invite link is invalid or no longer available.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, invite.organizationId),
  })
  const session = await getServerSession()

  if (!session?.user) {
    const signInHref = `/sign-in?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`
    const signUpHref = `/sign-up?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`

    return (
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl">
          <CardHeader className="gap-3">
            <Badge variant="outline" className="w-fit">
              Workspace invite
            </Badge>
            <CardTitle>Sign in to accept this invite</CardTitle>
            <CardDescription>
              You were invited to join {organization?.name ?? "an AutoReceipt workspace"} as a{" "}
              {invite.role}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href={signInHref}
              className="inline-flex h-9 items-center rounded-3xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Sign in
            </Link>
            <Link
              href={signUpHref}
              className="inline-flex h-9 items-center rounded-3xl border px-4 text-sm font-medium"
            >
              Create account
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (invite.status === "accepted") {
    redirect("/billing")
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <AcceptInviteCard
        token={token}
        organizationName={organization?.name ?? "AutoReceipt workspace"}
        invitedEmail={invite.email}
        role={invite.role}
        signedInEmail={session.user.email}
        status={invite.status}
        expiresAt={invite.expiresAt?.toISOString() ?? null}
      />
    </main>
  )
}
