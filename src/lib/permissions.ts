import type { ClubRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type PermissionResult =
  | { ok: true }
  | { ok: false; reason: string }

const roleCanRecord = (role: ClubRole) =>
  role === 'OWNER' || role === 'COACH' || role === 'ASSISTANT_COACH'

const roleCanManage = (role: ClubRole) => role === 'OWNER' || role === 'COACH'

export async function getClubMembership(userId: string, clubId: string) {
  return prisma.clubMembership.findUnique({
    where: {
      userId_clubId: { userId, clubId },
    },
    include: {
      teamAssignments: true,
    },
  })
}

export async function isOwnerForClub(userId: string, clubId: string) {
  const membership = await getClubMembership(userId, clubId)
  return membership?.role === 'OWNER'
}

export async function canViewTeam(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { clubId: true },
  })
  if (!team) return false

  const membership = await getClubMembership(userId, team.clubId)
  if (!membership) return false
  if (membership.role === 'OWNER' || membership.role === 'VIEWER') return true

  return membership.teamAssignments.some((assignment) => assignment.teamId === teamId)
}

export async function canManageTeamData(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { clubId: true },
  })
  if (!team) return false

  const membership = await getClubMembership(userId, team.clubId)
  if (!membership || !roleCanManage(membership.role)) return false
  if (membership.role === 'OWNER') return true

  return membership.teamAssignments.some((assignment) => assignment.teamId === teamId)
}

export async function canRecordTeamData(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { clubId: true },
  })
  if (!team) return false

  const membership = await getClubMembership(userId, team.clubId)
  if (!membership || !roleCanRecord(membership.role)) return false
  if (membership.role === 'OWNER') return true

  return membership.teamAssignments.some((assignment) => assignment.teamId === teamId)
}

export async function canViewPlayer(userId: string, playerId: string) {
  const spectatorAccess = await prisma.spectatorAccess.findFirst({
    where: { userId, playerId },
    select: { playerId: true },
  })
  if (spectatorAccess) return true

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  })
  if (!player) return false

  return canViewTeam(userId, player.teamId)
}

export async function canManagePlayer(userId: string, playerId: string) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  })
  if (!player) return false

  return canManageTeamData(userId, player.teamId)
}

export async function canViewFitnessSession(userId: string, sessionId: string) {
  const session = await prisma.fitnessTestSession.findUnique({
    where: { id: sessionId },
    select: { teamId: true },
  })
  if (!session) return false

  return canViewTeam(userId, session.teamId)
}

export async function canManageFitnessSession(userId: string, sessionId: string) {
  const session = await prisma.fitnessTestSession.findUnique({
    where: { id: sessionId },
    select: { teamId: true },
  })
  if (!session) return false

  return canManageTeamData(userId, session.teamId)
}

export async function canRecordFitnessSession(userId: string, sessionId: string) {
  const session = await prisma.fitnessTestSession.findUnique({
    where: { id: sessionId },
    select: { teamId: true },
  })
  if (!session) return false

  return canRecordTeamData(userId, session.teamId)
}

export async function canViewMatchDay(userId: string, matchDayId: string) {
  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    select: { teamId: true },
  })
  if (!matchDay) return false

  return canViewTeam(userId, matchDay.teamId)
}

export async function canManageMatchDay(userId: string, matchDayId: string) {
  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    select: { teamId: true },
  })
  if (!matchDay) return false

  return canManageTeamData(userId, matchDay.teamId)
}

export async function canRunMatchDay(userId: string, matchDayId: string) {
  const matchDay = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    select: { teamId: true },
  })
  if (!matchDay) return false

  return canRecordTeamData(userId, matchDay.teamId)
}

export const actionDenied = (reason = 'You do not have permission to do that.'): PermissionResult => ({
  ok: false,
  reason,
})
