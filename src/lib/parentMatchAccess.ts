import type { MatchEventType } from '@prisma/client'

import { isMatchEventType } from '@/lib/matchEventTaxonomy'
import { prisma } from '@/lib/prisma'

export type ParentActionResult =
  | { ok: true }
  | { ok: false; reason: string }

export const getSecondsBetween = (start: Date, end: Date) =>
  Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))

export function getActiveHalf(match: {
  status: string
  firstHalfStartedAt: Date | null
  firstHalfEndedAt: Date | null
  secondHalfStartedAt: Date | null
  secondHalfEndedAt: Date | null
}) {
  if (match.status !== 'IN_PROGRESS') return null

  if (match.secondHalfStartedAt && !match.secondHalfEndedAt) {
    return { half: 'SECOND_HALF' as const, startedAt: match.secondHalfStartedAt }
  }

  if (match.firstHalfStartedAt && !match.firstHalfEndedAt) {
    return { half: 'FIRST_HALF' as const, startedAt: match.firstHalfStartedAt }
  }

  return null
}

export async function getParentLinkedPlayersForMatch(userId: string, matchDayId: string) {
  const match = await prisma.matchDay.findUnique({
    where: { id: matchDayId },
    select: { id: true, teamId: true, status: true, team: { select: { clubId: true } } },
  })
  if (!match || match.status === 'DRAFT') return []

  const spectatorAccess = await prisma.spectatorAccess.findMany({
    where: {
      userId,
      clubId: match.team.clubId,
      player: { teamId: match.teamId },
    },
    include: { player: true },
  })

  if (spectatorAccess.length === 0) return []

  const matchPlayers = await prisma.matchDayPlayer.findMany({
    where: {
      matchDayId,
      playerId: { in: spectatorAccess.map((access) => access.playerId) },
      squadStatus: { not: 'NOT_INVOLVED' },
    },
    include: { player: true, stints: { where: { endedAt: null } } },
    orderBy: { player: { surname: 'asc' } },
  })

  return matchPlayers.map((matchPlayer) => ({
    matchDayPlayerId: matchPlayer.id,
    playerId: matchPlayer.playerId,
    firstName: matchPlayer.player.firstName,
    surname: matchPlayer.player.surname,
    squadNumber: matchPlayer.shirtNumberSnapshot ?? matchPlayer.player.squadNumber,
    isOnPitch: matchPlayer.stints.length > 0,
  }))
}

export async function canViewParentMatch(userId: string, matchDayId: string) {
  return (await getParentLinkedPlayersForMatch(userId, matchDayId)).length > 0
}

export async function validateParentSubmission({
  userId,
  matchDayId,
  playerId,
  eventType,
}: {
  userId: string
  matchDayId: string
  playerId: string
  eventType: string
}): Promise<
  | { ok: true; eventType: MatchEventType; match: NonNullable<Awaited<ReturnType<typeof getSubmissionMatch>>>; activeHalf: NonNullable<ReturnType<typeof getActiveHalf>> }
  | { ok: false; reason: string }
> {
  if (!isMatchEventType(eventType)) return { ok: false, reason: 'Event type is invalid.' }

  const match = await getSubmissionMatch(matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'IN_PROGRESS') return { ok: false, reason: 'Parent observations can only be submitted while the match is live.' }

  const activeHalf = getActiveHalf(match)
  if (!activeHalf) return { ok: false, reason: 'No half timer is currently running.' }

  const selectedEvent = match.matchDayEventTypes.some((selectedType) => selectedType.eventType === eventType)
  if (!selectedEvent) return { ok: false, reason: 'This event type was not selected for this match.' }

  const spectatorAccess = await prisma.spectatorAccess.findFirst({
    where: {
      userId,
      playerId,
      clubId: match.team.clubId,
      player: { teamId: match.teamId },
    },
    select: { id: true },
  })
  if (!spectatorAccess) return { ok: false, reason: 'You are not linked to this player.' }

  const matchPlayer = await prisma.matchDayPlayer.findFirst({
    where: {
      matchDayId: match.id,
      playerId,
      squadStatus: { not: 'NOT_INVOLVED' },
    },
    select: { id: true },
  })
  if (!matchPlayer) return { ok: false, reason: 'This player is not part of this match squad.' }

  const openStint = await prisma.matchPlayerStint.findFirst({
    where: { matchDayId: match.id, playerId, endedAt: null },
    select: { id: true },
  })
  if (!openStint) return { ok: false, reason: 'This player is not currently recorded as on pitch.' }

  return { ok: true, eventType, match, activeHalf }
}

async function getSubmissionMatch(matchDayId: string) {
  return prisma.matchDay.findUnique({
    where: { id: matchDayId },
    include: {
      team: { select: { clubId: true } },
      matchDayEventTypes: { select: { eventType: true } },
    },
  })
}
