import type { MatchEventType } from '@prisma/client'

import { getActiveHalf, getSecondsBetween } from '@/lib/parentMatchAccess'
import { getSelectedEventLegacyType } from '@/lib/parentSubmissionEvents'
import { prisma } from '@/lib/prisma'

type Result<T> = { ok: true; value: T } | { ok: false; reason: string }
type Db = typeof prisma

type CoordinateInput = { x?: number | null; y?: number | null }

function validCoordinate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

export async function validateAssignmentSubmissionContext({
  db = prisma,
  assignmentId,
  actorUserId,
  matchDayId,
  playerId,
  matchDayEventTypeId,
  x,
  y,
}: {
  db?: Db
  assignmentId: string
  actorUserId: string
  matchDayId: string
  playerId?: string | null
  matchDayEventTypeId: string
} & CoordinateInput): Promise<Result<{
  assignmentId: string
  matchDayId: string
  playerId: string | null
  submittedByUserId: string
  eventDefinitionId: string | null
  eventType: MatchEventType | null
  activeHalf: NonNullable<ReturnType<typeof getActiveHalf>>
  match: { ownScore: number; oppositionScore: number }
  x: number | null
  y: number | null
}>> {
  const assignment = await db.matchContributorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      trackingTask: {
        include: {
          matchDay: true,
          events: { include: { matchDayEventType: { include: { eventDefinition: true } } } },
        },
      },
    },
  })
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  if (assignment.trackingTask.matchDayId !== matchDayId) return { ok: false, reason: 'Assignment does not belong to this match.' }
  if (assignment.assignedUserId !== actorUserId) return { ok: false, reason: 'This assignment belongs to another user.' }
  if (assignment.status !== 'IN_PROGRESS') return { ok: false, reason: 'Assignment must be started before observations can be recorded.' }
  if (assignment.trackingTask.status !== 'READY') return { ok: false, reason: 'Tracking task is not ready.' }

  const taskEvent = assignment.trackingTask.events.find((event) => event.matchDayEventTypeId === matchDayEventTypeId)
  if (!taskEvent) return { ok: false, reason: 'This event is not part of the assignment task.' }
  if (taskEvent.matchDayEventType.matchDayId !== matchDayId) return { ok: false, reason: 'This event is no longer selected for this match.' }

  const match = assignment.trackingTask.matchDay
  const activeHalf = getActiveHalf(match)
  if (!activeHalf) return { ok: false, reason: 'Match is not currently recordable.' }

  const submittedPlayerId = assignment.trackingTask.scopeType === 'PLAYER' ? playerId?.trim() || null : null
  if (assignment.trackingTask.scopeType === 'PLAYER') {
    if (!submittedPlayerId) return { ok: false, reason: 'Player assignments require a player.' }
    if (assignment.trackingTask.playerId !== submittedPlayerId) return { ok: false, reason: 'Observation player does not match the assignment player.' }

    const squadPlayer = await db.matchDayPlayer.findFirst({ where: { matchDayId, playerId: submittedPlayerId, squadStatus: { not: 'NOT_INVOLVED' } }, select: { id: true } })
    if (!squadPlayer) return { ok: false, reason: 'Player is not in the match squad.' }

    const openStint = await db.matchPlayerStint.findFirst({ where: { matchDayId, playerId: submittedPlayerId, endedAt: null }, select: { id: true } })
    if (!openStint) return { ok: false, reason: 'Player is not currently on the pitch.' }
  }

  const requiresLocation = taskEvent.matchDayEventType.eventDefinition?.requiresLocation ?? false
  if (requiresLocation && (!validCoordinate(x) || !validCoordinate(y))) return { ok: false, reason: 'This event requires pitch coordinates.' }

  return {
    ok: true,
    value: {
      assignmentId,
      matchDayId,
      playerId: submittedPlayerId,
      submittedByUserId: actorUserId,
      eventDefinitionId: taskEvent.matchDayEventType.eventDefinitionId,
      eventType: getSelectedEventLegacyType(taskEvent.matchDayEventType),
      activeHalf,
      match,
      x: validCoordinate(x) ? x ?? null : null,
      y: validCoordinate(y) ? y ?? null : null,
    },
  }
}

export async function createAssignmentLinkedSubmission({
  db = prisma,
  assignmentId,
  actorUserId,
  matchDayId,
  playerId,
  matchDayEventTypeId,
  note,
  x,
  y,
}: {
  db?: Db
  assignmentId: string
  actorUserId: string
  matchDayId: string
  playerId?: string | null
  matchDayEventTypeId: string
  note?: string | null
} & CoordinateInput): Promise<Result<{ id: string }>> {
  const validation = await validateAssignmentSubmissionContext({ db, assignmentId, actorUserId, matchDayId, playerId, matchDayEventTypeId, x, y })
  if (!validation.ok) return validation

  const duplicateSince = new Date(Date.now() - 5000)
  const now = new Date()
  return db.$transaction(async (tx) => {
    const duplicate = await tx.submittedMatchEvent.findFirst({
      where: {
        assignmentId,
        matchDayId,
        playerId,
        submittedByUserId: actorUserId,
        createdAt: { gte: duplicateSince },
        ...(validation.value.eventDefinitionId
          ? { eventDefinitionId: validation.value.eventDefinitionId }
          : { eventDefinitionId: null, eventType: validation.value.eventType }),
      },
      select: { id: true },
    })
    if (duplicate) return { ok: false as const, reason: 'That observation was already submitted a moment ago.' }

    const submission = await tx.submittedMatchEvent.create({
      data: {
        assignmentId,
        matchDayId,
        playerId,
        submittedByUserId: actorUserId,
        eventDefinitionId: validation.value.eventDefinitionId,
        eventType: validation.value.eventType,
        half: validation.value.activeHalf.half,
        matchSecond: getSecondsBetween(validation.value.activeHalf.startedAt, now),
        ownScoreAtTime: validation.value.match.ownScore,
        oppositionScoreAtTime: validation.value.match.oppositionScore,
        x: validation.value.x,
        y: validation.value.y,
        note: note?.trim() ? note.trim().slice(0, 280) : null,
        status: 'PENDING',
      },
      select: { id: true },
    })
    return { ok: true as const, value: submission }
  })
}
