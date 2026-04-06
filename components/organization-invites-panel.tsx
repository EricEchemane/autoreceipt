"use client"

import Link from "next/link"
import { CheckCircle2, Copy, LoaderCircle, MailPlus, UserRoundPlus, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MemberRecord = {
  id: number
  role: string
  status: string
  joinedAt: string | Date
  userId: string
  name: string
  email: string
}

type InviteRecord = {
  id: number
  email: string
  role: string
  token: string
  status: string
  expiresAt: string | Date | null
  acceptedAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
}

type OrganizationInvitesPanelProps = {
  organizationName: string
  canManageInvites: boolean
  initialMembers: MemberRecord[]
  initialInvites: InviteRecord[]
  inviteBaseUrl: string
}

function formatDate(value: string | Date | null) {
  if (!value) {
    return "No date"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "No date"
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function roleTone(role: string) {
  if (role === "owner") return "success" as const
  if (role === "admin") return "secondary" as const
  return "outline" as const
}

export function OrganizationInvitesPanel({
  organizationName,
  canManageInvites,
  initialMembers,
  initialInvites,
  inviteBaseUrl,
}: OrganizationInvitesPanelProps) {
  const [members] = useState(initialMembers)
  const [invites, setInvites] = useState(initialInvites)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyInviteId, setBusyInviteId] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!message) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("")
    }, 2800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [message])

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites]
  )

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManageInvites) {
      return
    }

    setIsSubmitting(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/organization/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role,
        }),
      })

      const payload = (await response.json()) as {
        invite?: InviteRecord
        error?: string
      }

      if (!response.ok || !payload.invite) {
        throw new Error(payload.error ?? "Could not send workspace invite.")
      }

      setInvites((current) => [payload.invite!, ...current.filter((invite) => invite.id !== payload.invite!.id)])
      setEmail("")
      setRole("member")
      setMessage(`Invite created for ${payload.invite.email}.`)
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not send workspace invite."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancelInvite(inviteId: number) {
    setBusyInviteId(inviteId)
    setError("")
    setMessage("")

    try {
      const response = await fetch(`/api/organization/invites/${inviteId}`, {
        method: "DELETE",
      })

      const payload = (await response.json()) as {
        invite?: InviteRecord
        error?: string
      }

      if (!response.ok || !payload.invite) {
        throw new Error(payload.error ?? "Could not cancel workspace invite.")
      }

      setInvites((current) =>
        current.map((invite) =>
          invite.id === inviteId ? payload.invite! : invite
        )
      )
      setMessage("Invite cancelled.")
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not cancel workspace invite."
      )
    } finally {
      setBusyInviteId(null)
    }
  }

  async function handleCopyInvite(token: string) {
    const inviteUrl = `${inviteBaseUrl}/invite/${token}`

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setMessage("Invite link copied.")
      setError("")
    } catch {
      setError("Could not copy the invite link.")
    }
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Workspace members</CardTitle>
            <CardDescription>
              Invite teammates to join {organizationName} and help review receipts.
            </CardDescription>
          </div>
          <Badge variant="outline">{members.length} members</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {member.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={roleTone(member.role)}>{member.role}</Badge>
                <Badge variant="outline">{member.status}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRoundPlus className="size-4 text-primary" />
            <p className="text-sm font-medium">Invite a teammate</p>
          </div>
          {canManageInvites ? (
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleInviteSubmit}>
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="sm:flex-1"
              />
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={isSubmitting}>
                <MailPlus data-icon="inline-start" />
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {isSubmitting ? "Sending..." : "Send invite"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only workspace owners and admins can send invites.
            </p>
          )}
        </div>

        {(message || error) ? (
          <div className="rounded-2xl border px-4 py-3 text-sm">
            <span className={error ? "inline-flex items-center gap-2 text-destructive" : "inline-flex items-center gap-2 text-foreground"}>
              {error ? null : <CheckCircle2 className="size-4 text-emerald-500" />}
              {error || message}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Pending invites</p>
              <p className="text-sm text-muted-foreground">
                Copy a test invite link and open it from another account.
              </p>
            </div>
            <Badge variant="outline">{pendingInvites.length} pending</Badge>
          </div>

          {pendingInvites.length > 0 ? (
            <div className="grid gap-3">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-2xl border p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDate(invite.expiresAt)}
                      </p>
                    </div>
                    <Badge variant={roleTone(invite.role)}>{invite.role}</Badge>
                  </div>
                  <div className="rounded-2xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground break-all">
                    {inviteBaseUrl}/invite/{invite.token}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyInvite(invite.token)}
                    >
                      <Copy data-icon="inline-start" />
                      Copy invite link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link href={`/invite/${invite.token}`}>Open invite page</Link>
                    </Button>
                    {canManageInvites ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelInvite(invite.id)}
                        disabled={busyInviteId === invite.id}
                      >
                        <X data-icon="inline-start" />
                        {busyInviteId === invite.id ? <LoaderCircle className="size-4 animate-spin" /> : null}
                        {busyInviteId === invite.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              No pending invites yet.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
