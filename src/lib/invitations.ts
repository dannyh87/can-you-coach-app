import crypto from 'crypto'

import { Prisma, type InvitationType } from '@prisma/client'

import { getAppUrl } from '@/lib/appUrl'
import { isOwnerForClub } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export type InvitationActionResult =
  | { ok: true; inviteLink: string }
  | { ok: false; reason: string }

export type InvitationAcceptResult =
  | { status: 'invalid' }
  | { status: 'accepted'; type: InvitationType }
  | { status: 'already_accepted' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'email_mismatch'; invitedEmail: string; signedInEmail: string }
  | { status: 'error'; reason: string }

const INVITATION_EXPIRY_DAYS = 14

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const getInvitationAcceptPath = (token: string) => `/invite/accept?token=${encodeURIComponent(token)}`

export function getInvitationAcceptUrl(token: string) {
  return getAppUrl(getInvitationAcceptPath(token))
}

function generateInvitationToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function getExpiresAt() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)
  return expiresAt
}

type InvitationTarget = {
  clubId: string
  teamId?: string | null
  playerId?: string | null
}

type InvitationCreateInput = InvitationTarget & {
  email: string
  normalizedEmail: string
  type: InvitationType
  invitedByUserId: string
}

async function createUniqueInvitationToken(db: Pick<typeof prisma, 'invitation'> = prisma) {
  while (true) {
    const token = generateInvitationToken()
    const existing = await db.invitation.findUnique({
      where: { token },
      select: { id: true },
    })

    if (!existing) return token
  }
}

function getActiveInvitationWhere({ clubId, teamId = null, playerId = null, normalizedEmail, type }: InvitationCreateInput, now: Date) {
  return {
    clubId,
    teamId,
    playerId,
    normalizedEmail,
    type,
    status: 'PENDING' as const,
    expiresAt: { gt: now },
  }
}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

async function createOrReuseActiveInvitation(input: InvitationCreateInput) {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date()
        const existing = await tx.invitation.findFirst({
          where: getActiveInvitationWhere(input, now),
          orderBy: { createdAt: 'desc' },
          select: { token: true },
        })
        if (existing) return existing

        const token = await createUniqueInvitationToken(tx)
        return tx.invitation.create({
          data: {
            token,
            email: input.email,
            normalizedEmail: input.normalizedEmail,
            type: input.type,
            clubId: input.clubId,
            teamId: input.teamId ?? null,
            playerId: input.playerId ?? null,
            invitedByUserId: input.invitedByUserId,
            expiresAt: getExpiresAt(),
          },
          select: { token: true },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (attempt < maxAttempts && isSerializationConflict(error)) continue
      throw error
    }
  }

  throw new Error('Could not create invite safely.')
}

export async function createTeamInvitation({
  clubId,
  teamId,
  email,
  invitedByUserId,
  type,
}: {
  clubId: string
  teamId: string
  email: string
  invitedByUserId: string
  type: 'TEAM_COACH' | 'TEAM_ASSISTANT'
}): Promise<InvitationActionResult> {
  const displayEmail = email.trim()
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return { ok: false, reason: 'Email is required.' }
  if (!(await isOwnerForClub(invitedByUserId, clubId))) {
    return { ok: false, reason: 'You cannot create invites for this club.' }
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, clubId },
    select: { id: true },
  })
  if (!team) return { ok: false, reason: 'Selected team is invalid.' }

  const invitation = await createOrReuseActiveInvitation({
    clubId,
    teamId,
    email: displayEmail,
    normalizedEmail,
    type,
    invitedByUserId,
  })

  return { ok: true, inviteLink: getInvitationAcceptUrl(invitation.token) }
}

export async function createPlayerInvitation({
  clubId,
  playerId,
  email,
  invitedByUserId,
  type,
}: {
  clubId: string
  playerId: string
  email: string
  invitedByUserId: string
  type: 'PLAYER_PARENT' | 'PLAYER_SPECTATOR'
}): Promise<InvitationActionResult> {
  const displayEmail = email.trim()
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return { ok: false, reason: 'Email is required.' }
  if (!(await isOwnerForClub(invitedByUserId, clubId))) {
    return { ok: false, reason: 'You cannot create invites for this club.' }
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, team: { clubId } },
    select: { id: true },
  })
  if (!player) return { ok: false, reason: 'Selected player is invalid.' }

  const invitation = await createOrReuseActiveInvitation({
    clubId,
    playerId,
    email: displayEmail,
    normalizedEmail,
    type,
    invitedByUserId,
  })

  return { ok: true, inviteLink: getInvitationAcceptUrl(invitation.token) }
}

export async function revokeInvitation({
  invitationId,
  userId,
}: {
  invitationId: string
  userId: string
}) {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { clubId: true, status: true },
  })
  if (!invitation?.clubId) return { ok: false as const, reason: 'Invite was not found.' }
  if (!(await isOwnerForClub(userId, invitation.clubId))) {
    return { ok: false as const, reason: 'You cannot revoke this invite.' }
  }
  if (invitation.status !== 'PENDING') {
    return { ok: false as const, reason: 'Only pending invites can be revoked.' }
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })

  return { ok: true as const }
}

export async function acceptInvitation({
  token,
  userId,
  userEmail,
}: {
  token: string
  userId: string
  userEmail: string
}): Promise<InvitationAcceptResult> {
  const invitation = await prisma.invitation.findUnique({ where: { token } })
  if (!invitation) return { status: 'invalid' }
  if (invitation.status === 'ACCEPTED') return { status: 'already_accepted' }
  if (invitation.status === 'REVOKED') return { status: 'revoked' }
  if (invitation.status === 'EXPIRED') return { status: 'expired' }

  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    })
    return { status: 'expired' }
  }

  const signedInEmail = normalizeEmail(userEmail)
  if (signedInEmail !== invitation.normalizedEmail) {
    return {
      status: 'email_mismatch',
      invitedEmail: invitation.email,
      signedInEmail,
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pendingInvitation = await tx.invitation.findFirst({
        where: { id: invitation.id, status: 'PENDING' },
      })
      if (!pendingInvitation) return

      if (pendingInvitation.type === 'TEAM_COACH' || pendingInvitation.type === 'TEAM_ASSISTANT') {
        if (!pendingInvitation.clubId || !pendingInvitation.teamId) {
          throw new Error('This team invite is missing its target.')
        }

        const team = await tx.team.findFirst({
          where: { id: pendingInvitation.teamId, clubId: pendingInvitation.clubId },
          select: { id: true },
        })
        if (!team) throw new Error('The invited team no longer exists.')

        const existingMembership = await tx.clubMembership.findUnique({
          where: {
            userId_clubId: {
              userId,
              clubId: pendingInvitation.clubId,
            },
          },
        })
        const role = getAcceptedTeamRole(pendingInvitation.type, existingMembership?.role)
        const membership = await tx.clubMembership.upsert({
          where: {
            userId_clubId: {
              userId,
              clubId: pendingInvitation.clubId,
            },
          },
          update: { role },
          create: { userId, clubId: pendingInvitation.clubId, role },
        })

        await tx.teamAssignment.createMany({
          data: [{ membershipId: membership.id, teamId: pendingInvitation.teamId }],
          skipDuplicates: true,
        })
      } else {
        if (!pendingInvitation.clubId || !pendingInvitation.playerId) {
          throw new Error('This player invite is missing its target.')
        }

        const player = await tx.player.findFirst({
          where: { id: pendingInvitation.playerId, team: { clubId: pendingInvitation.clubId } },
          select: { id: true },
        })
        if (!player) throw new Error('The invited player no longer exists.')

        await tx.spectatorAccess.createMany({
          data: [{ userId, clubId: pendingInvitation.clubId, playerId: pendingInvitation.playerId }],
          skipDuplicates: true,
        })
      }

      await tx.invitation.update({
        where: { id: pendingInvitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedByUserId: userId,
          acceptedAt: new Date(),
        },
      })
    })
  } catch (error) {
    return {
      status: 'error',
      reason: error instanceof Error ? error.message : 'Invite could not be accepted.',
    }
  }

  return { status: 'accepted', type: invitation.type }
}

function getAcceptedTeamRole(
  type: 'TEAM_COACH' | 'TEAM_ASSISTANT',
  existingRole?: 'OWNER' | 'COACH' | 'ASSISTANT_COACH' | 'VIEWER'
) {
  if (existingRole === 'OWNER') return 'OWNER'
  if (type === 'TEAM_COACH') return 'COACH'
  if (existingRole === 'COACH') return 'COACH'
  return 'ASSISTANT_COACH'
}
