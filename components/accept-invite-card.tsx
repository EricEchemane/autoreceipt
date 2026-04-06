"use client"

import Link from "next/link"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AcceptInviteCardProps = {
  token: string
  organizationName: string
  invitedEmail: string
  signedInEmail: string
  role: string
  status: string
  expiresAt: string | null
}

function formatDate(value: string | null) {
  if (!value) {
    return "No expiry date"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "No expiry date"
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function AcceptInviteCard({
  token,
  organizationName,
  invitedEmail,
  signedInEmail,
  role,
  status,
  expiresAt,
}: AcceptInviteCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const canAccept = status === "pending"

  async function handleAccept() {
    setIsSubmitting(true)
    setError("")
    setMessage("Verifying your invite and preparing the workspace...")

    try {
      const response = await fetch("/api/organization/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not accept workspace invite.")
      }

      window.location.href = "/billing"
    } catch (nextError) {
      setMessage("")
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not accept workspace invite."
      )
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="gap-3">
        <Badge variant="outline" className="w-fit">
          Workspace invite
        </Badge>
        <CardTitle>Join {organizationName}</CardTitle>
        <CardDescription>
          This invite is for <span className="font-medium text-foreground">{invitedEmail}</span> as a{" "}
          <span className="font-medium text-foreground">{role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 rounded-2xl border p-4 text-sm text-muted-foreground">
          <p>
            Signed in as:{" "}
            <span className="font-medium text-foreground">{signedInEmail}</span>
          </p>
          <p>
            Invite status:{" "}
            <span className="font-medium text-foreground">{status}</span>
          </p>
          <p>
            Expires:{" "}
            <span className="font-medium text-foreground">{formatDate(expiresAt)}</span>
          </p>
        </div>

        {error ? (
          <p className="rounded-2xl border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="inline-flex items-center gap-2 rounded-2xl border border-border/70 px-4 py-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAccept} disabled={!canAccept || isSubmitting}>
            {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {isSubmitting ? "Joining..." : "Accept invite"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
