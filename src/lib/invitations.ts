import crypto from 'crypto'

import type { InvitationType } from '@prisma/client'

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

export function getInvitationAcceptUrl(token: string, origin: string) {
  return new URL(getInvitationAcceptPath(token), origin).toString()
}

function generateInvitationToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function getExpiresAt() {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)
  return expiresAt
}

async function createUniqueInvitationToken() {
  while (true) {
    const token = generateInvitationToken()
    const existing = await prisma.invitation.findUnique({
      where: { token },
      select: { id: true },
    })

    if (!existing) return token
  }
}

export async function createTeamInvitation({
  clubId,
  teamId,
  email,
  invitedByUserId,
  type,
  origin,
}: {
  clubId: string
  teamId: string
  email: string
  invitedByUserId: string
  type: 'TEAM_COACH' | 'TEAM_ASSISTANT'
  origin: string
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

  const token = await createUniqueInvitationToken()
  await prisma.invitation.create({
    data: {
      token,
      email: displayEmail,
      normalizedEmail,
      type,
      clubId,
      teamId,
      invitedByUserId,
      expiresAt: getExpiresAt(),
    },
  })

  return { ok: true, inviteLink: getInvitationAcceptUrl(token, origin) }
}

export async function createPlayerInvitation({
  clubId,
  playerId,
  email,
  invitedByUserId,
  type,
  origin,
}: {
  clubId: string
  playerId: string
  email: string
  invitedByUserId: string
  type: 'PLAYER_PARENT' | 'PLAYER_SPECTATOR'
  origin: string
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

  const token = await createUniqueInvitationToken()
  await prisma.invitation.create({
    data: {
      token,
      email: displayEmail,
      normalizedEmail,
      type,
      clubId,
      playerId,
      invitedByUserId,
      expiresAt: getExpiresAt(),
    },
  })

  return { ok: true, inviteLink: getInvitationAcceptUrl(token, origin) }
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
