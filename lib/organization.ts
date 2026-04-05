import crypto from "node:crypto"

import { and, asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  organizationInvites,
  organizationMembers,
  organizations,
  users,
} from "@/lib/db/schema"

export type OrganizationRole = "owner" | "admin" | "reviewer" | "member"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildDefaultOrganizationSeed(user: {
  id: string
  name: string
}) {
  const baseName = user.name.trim() || "Workspace"
  const baseSlug = slugify(baseName) || "workspace"

  return {
    id: `user-org:${user.id}`,
    name: `${baseName} Workspace`,
    slug: `${baseSlug}-${user.id.slice(0, 8)}`,
  }
}

export async function ensureDefaultOrganizationForUser(user: {
  id: string
  name: string
}) {
  const existingMembership = await db.query.organizationMembers.findFirst({
    where: eq(organizationMembers.userId, user.id),
  })

  if (existingMembership) {
    const existingOrganization = await db.query.organizations.findFirst({
      where: eq(organizations.id, existingMembership.organizationId),
    })

    if (existingOrganization) {
      return {
        organization: existingOrganization,
        membership: existingMembership,
      }
    }
  }

  const seed = buildDefaultOrganizationSeed(user)

  await db
    .insert(organizations)
    .values(seed)
    .onConflictDoNothing()

  await db
    .insert(organizationMembers)
    .values({
      organizationId: seed.id,
      userId: user.id,
      role: "owner",
      status: "active",
    })
    .onConflictDoNothing()

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, seed.id),
  })

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, seed.id),
      eq(organizationMembers.userId, user.id)
    ),
  })

  if (!organization || !membership) {
    throw new Error("Could not create a default organization for this user.")
  }

  return {
    organization,
    membership,
  }
}

export async function getCurrentOrganizationForUser(user: {
  id: string
  name: string
}, preferredOrganizationId?: string | null) {
  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, user.id),
    orderBy: [desc(organizationMembers.createdAt)],
  })

  if (memberships.length === 0) {
    return ensureDefaultOrganizationForUser(user)
  }

  const membership =
    (preferredOrganizationId
      ? memberships.find(
          (candidate) => candidate.organizationId === preferredOrganizationId
        )
      : undefined) ?? memberships[0]

  if (!membership) {
    return ensureDefaultOrganizationForUser(user)
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, membership.organizationId),
  })

  if (!organization) {
    return ensureDefaultOrganizationForUser(user)
  }

  return {
    organization,
    membership,
  }
}

export async function createOrganizationInviteToken() {
  return crypto.randomUUID()
}

export async function userHasOrganizationMembership(params: {
  userId: string
  organizationId: string
}) {
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, params.userId),
      eq(organizationMembers.organizationId, params.organizationId)
    ),
  })

  return Boolean(membership)
}

export async function listOrganizationMembers(organizationId: string) {
  const rows = await db
    .select({
      id: organizationMembers.id,
      role: organizationMembers.role,
      status: organizationMembers.status,
      joinedAt: organizationMembers.createdAt,
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(
      asc(
        organizationMembers.role
      ),
      asc(users.name)
    )

  return rows
}

export async function listOrganizationInvites(organizationId: string) {
  return db.query.organizationInvites.findMany({
    where: eq(organizationInvites.organizationId, organizationId),
    orderBy: [desc(organizationInvites.createdAt)],
  })
}

export async function createOrganizationInvite(params: {
  organizationId: string
  email: string
  role: OrganizationRole
}) {
  const normalizedEmail = params.email.trim().toLowerCase()

  const existingMember = await db
    .select({
      id: organizationMembers.id,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, params.organizationId),
        eq(users.email, normalizedEmail)
      )
    )
    .limit(1)

  if (existingMember[0]) {
    throw new Error("That email is already a member of this workspace.")
  }

  const existingInvite = await db.query.organizationInvites.findFirst({
    where: and(
      eq(organizationInvites.organizationId, params.organizationId),
      eq(organizationInvites.email, normalizedEmail),
      eq(organizationInvites.status, "pending")
    ),
  })

  if (existingInvite) {
    return existingInvite
  }

  const token = await createOrganizationInviteToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      organizationId: params.organizationId,
      email: normalizedEmail,
      role: params.role,
      token,
      expiresAt,
    })
    .returning()

  return invite
}

export async function cancelOrganizationInvite(params: {
  organizationId: string
  inviteId: number
}) {
  const [invite] = await db
    .update(organizationInvites)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationInvites.organizationId, params.organizationId),
        eq(organizationInvites.id, params.inviteId)
      )
    )
    .returning()

  return invite ?? null
}

export async function getOrganizationInviteByToken(token: string) {
  return db.query.organizationInvites.findFirst({
    where: eq(organizationInvites.token, token),
  })
}

export async function acceptOrganizationInvite(params: {
  token: string
  userId: string
  userEmail: string
}) {
  const invite = await getOrganizationInviteByToken(params.token)

  if (!invite) {
    throw new Error("This invite could not be found.")
  }

  if (invite.status !== "pending") {
    throw new Error("This invite is no longer available.")
  }

  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    throw new Error("This invite has expired.")
  }

  if (invite.email.toLowerCase() !== params.userEmail.trim().toLowerCase()) {
    throw new Error("Sign in with the invited email address to join this workspace.")
  }

  await db
    .insert(organizationMembers)
    .values({
      organizationId: invite.organizationId,
      userId: params.userId,
      role: invite.role,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: {
        role: invite.role,
        status: "active",
        updatedAt: new Date(),
      },
    })

  const [acceptedInvite] = await db
    .update(organizationInvites)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizationInvites.id, invite.id))
    .returning()

  return acceptedInvite ?? invite
}
