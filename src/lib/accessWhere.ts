import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export async function getAccessibleTeamIds(userId: string) {
  const memberships = await prisma.clubMembership.findMany({
    where: { userId },
    include: {
      club: {
        include: {
          teams: { select: { id: true } },
        },
      },
      teamAssignments: { select: { teamId: true } },
    },
  })

  const teamIds = new Set<string>()

  for (const membership of memberships) {
    if (membership.role === 'OWNER' || membership.role === 'VIEWER') {
      membership.club.teams.forEach((team) => teamIds.add(team.id))
    } else {
      membership.teamAssignments.forEach((assignment) => teamIds.add(assignment.teamId))
    }
  }

  return [...teamIds]
}

export async function getRecordableTeamIds(userId: string) {
  const memberships = await prisma.clubMembership.findMany({
    where: {
      userId,
      role: { in: ['OWNER', 'COACH', 'ASSISTANT_COACH'] },
    },
    include: {
      club: {
        include: {
          teams: { select: { id: true } },
        },
      },
      teamAssignments: { select: { teamId: true } },
    },
  })

  const teamIds = new Set<string>()

  for (const membership of memberships) {
    if (membership.role === 'OWNER') {
      membership.club.teams.forEach((team) => teamIds.add(team.id))
    } else {
      membership.teamAssignments.forEach((assignment) => teamIds.add(assignment.teamId))
    }
  }

  return [...teamIds]
}

export async function getManageableTeamIds(userId: string) {
  const memberships = await prisma.clubMembership.findMany({
    where: {
      userId,
      role: { in: ['OWNER', 'COACH'] },
    },
    include: {
      club: {
        include: {
          teams: { select: { id: true } },
        },
      },
      teamAssignments: { select: { teamId: true } },
    },
  })

  const teamIds = new Set<string>()

  for (const membership of memberships) {
    if (membership.role === 'OWNER') {
      membership.club.teams.forEach((team) => teamIds.add(team.id))
    } else {
      membership.teamAssignments.forEach((assignment) => teamIds.add(assignment.teamId))
    }
  }

  return [...teamIds]
}

export async function accessibleTeamWhere(userId: string): Promise<Prisma.TeamWhereInput> {
  const teamIds = await getAccessibleTeamIds(userId)
  return { id: { in: teamIds } }
}

export async function accessiblePlayerWhere(userId: string): Promise<Prisma.PlayerWhereInput> {
  const spectatorAccess = await prisma.spectatorAccess.findMany({
    where: { userId },
    select: { playerId: true },
  })

  const teamIds = await getAccessibleTeamIds(userId)

  return {
    OR: [
      { teamId: { in: teamIds } },
      ...(spectatorAccess.length > 0
        ? [{ id: { in: spectatorAccess.map((access) => access.playerId) } }]
        : []),
    ],
  }
}

export async function accessibleSessionWhere(userId: string): Promise<Prisma.FitnessTestSessionWhereInput> {
  const teamIds = await getAccessibleTeamIds(userId)
  return { teamId: { in: teamIds } }
}

export async function accessibleMatchWhere(userId: string): Promise<Prisma.MatchDayWhereInput> {
  const teamIds = await getAccessibleTeamIds(userId)
  return { teamId: { in: teamIds } }
}
