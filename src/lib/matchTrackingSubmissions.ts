import type { ClubTrackingDefinitionKind, MatchEventType, MatchTrackingScope, TrackingTargetContext } from '@prisma/client'

import { clubDefinitionMatchesTrackingContext, getClubDefinitionLocalSelectionEligibility } from '@/lib/clubTrackingDefinitions'
import { getActiveHalf, getSecondsBetween } from '@/lib/parentMatchAccess'
import { getSelectedEventLegacyType } from '@/lib/parentSubmissionEvents'
import { prisma } from '@/lib/prisma'

type Result<T> = { ok: true; value: T } | { ok: false; reason: string }
type Db = typeof prisma

type CoordinateInput = { x?: number | null; y?: number | null }
type ClubEventRecordingReason = 'notAuthorized' | 'taskItemMissing' | 'definitionUnavailable' | 'definitionRetired' | 'taskDefinitionStale' | 'mappingRejected' | 'locationRequired' | 'locationInvalid' | 'assignmentClosed' | 'duplicateSubmission'
type RecordClubTrackingResult =
  | { ok: true; observationId: string; activityItem: { id: string; type: 'event'; label: string } }
  | { ok: false; reason: ClubEventRecordingReason; message: string }

function validCoordinate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

function getTaskTargetContext(task: { scopeType: MatchTrackingScope; unitKey?: string | null }) {
  if (task.scopeType === 'TEAM') return 'WHOLE_TEAM' as const
  if (task.scopeType === 'UNIT') return (task.unitKey || 'CUSTOM_UNIT') as TrackingTargetContext
  return null
}

function clubEventUsesStandardIdentity(kind: ClubTrackingDefinitionKind, mappingStatus: string) {
  return kind === 'EVENT_ALIAS' || (kind === 'EVENT_MAPPED' && mappingStatus === 'STANDARD_APPROVED')
}

function clubEventMessage(reason: ClubEventRecordingReason) {
  const messages = {
    notAuthorized: 'You cannot record observations for this assignment.',
    taskItemMissing: 'This club tracking item is not part of the assignment task.',
    definitionUnavailable: 'This club tracking definition is not available.',
    definitionRetired: 'This club tracking definition has been retired.',
    taskDefinitionStale: 'This club tracking item has changed. Ask a coach to refresh the task.',
    mappingRejected: 'This club tracking mapping is not available for recording.',
    locationRequired: 'This club event requires pitch coordinates.',
    locationInvalid: 'Pitch location must be between 0 and 100.',
    assignmentClosed: 'Assignment must be in progress before observations can be recorded.',
    duplicateSubmission: 'That observation was already submitted a moment ago.',
  }
  return messages[reason]
}

const clubEventError = (reason: ClubEventRecordingReason): RecordClubTrackingResult => ({ ok: false, reason, message: clubEventMessage(reason) })

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

export async function recordAssignedClubEvent({
  db = prisma,
  assignmentId,
  actorUserId,
  taskClubDefinitionId,
  playerId,
  note,
  x,
  y,
}: {
  db?: Db
  assignmentId: string
  actorUserId: string
  taskClubDefinitionId: string
  playerId?: string | null
  note?: string | null
} & CoordinateInput): Promise<RecordClubTrackingResult> {
  if ((x !== undefined && x !== null && !validCoordinate(x)) || (y !== undefined && y !== null && !validCoordinate(y))) return clubEventError('locationInvalid')
  const assignment = await db.matchContributorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      trackingTask: {
        include: {
          matchDay: { include: { team: { select: { clubId: true } } } },
          clubDefinitions: { where: { id: taskClubDefinitionId }, include: { clubTrackingDefinition: { include: { mappedEventDefinition: true } } } },
        },
      },
    },
  })
  if (!assignment || assignment.assignedUserId !== actorUserId) return clubEventError('notAuthorized')
  if (assignment.status !== 'IN_PROGRESS') return clubEventError('assignmentClosed')
  if (assignment.trackingTask.status !== 'READY') return clubEventError('assignmentClosed')
  const link = assignment.trackingTask.clubDefinitions[0]
  if (!link) return clubEventError('taskItemMissing')
  const definition = link.clubTrackingDefinition
  if (!['EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM'].includes(definition.kind)) return clubEventError('definitionUnavailable')
  if (definition.clubId !== assignment.trackingTask.matchDay.team.clubId) return clubEventError('definitionUnavailable')
  if (!definition.active || definition.retiredAt || definition.status === 'RETIRED') return clubEventError('definitionRetired')
  const eligibility = getClubDefinitionLocalSelectionEligibility(definition)
  if (!eligibility.selectable) return definition.mappingStatus === 'REJECTED' ? clubEventError('mappingRejected') : clubEventError('definitionUnavailable')
  if (definition.kind !== link.selectedKind) return clubEventError('taskDefinitionStale')
  if (!clubDefinitionMatchesTrackingContext(definition, { scope: assignment.trackingTask.scopeType, targetContext: getTaskTargetContext(assignment.trackingTask) })) return clubEventError('taskDefinitionStale')
  if (definition.kind !== 'EVENT_CUSTOM' && definition.mappedEventDefinitionId !== link.standardEventDefinitionIdAtSelection) return clubEventError('taskDefinitionStale')
  if (definition.kind !== 'EVENT_CUSTOM' && !definition.mappedEventDefinitionId) return clubEventError('definitionUnavailable')

  const requiresLocation = definition.kind === 'EVENT_CUSTOM'
    ? definition.requiresLocation
    : Boolean(definition.requiresLocation || definition.mappedEventDefinition?.requiresLocation)
  if (requiresLocation && (!validCoordinate(x) || !validCoordinate(y))) return clubEventError('locationRequired')

  const activeHalf = getActiveHalf(assignment.trackingTask.matchDay)
  if (!activeHalf) return clubEventError('assignmentClosed')
  const submittedPlayerId = assignment.trackingTask.scopeType === 'PLAYER' ? playerId?.trim() || null : null
  if (assignment.trackingTask.scopeType === 'PLAYER') {
    if (!submittedPlayerId || submittedPlayerId !== assignment.trackingTask.playerId) return clubEventError('notAuthorized')
    const squadPlayer = await db.matchDayPlayer.findFirst({ where: { matchDayId: assignment.trackingTask.matchDayId, playerId: submittedPlayerId, squadStatus: { not: 'NOT_INVOLVED' } }, select: { id: true } })
    if (!squadPlayer) return clubEventError('notAuthorized')
    const openStint = await db.matchPlayerStint.findFirst({ where: { matchDayId: assignment.trackingTask.matchDayId, playerId: submittedPlayerId, endedAt: null }, select: { id: true } })
    if (!openStint) return clubEventError('notAuthorized')
  }

  const eventDefinitionId = clubEventUsesStandardIdentity(definition.kind, definition.mappingStatus) ? definition.mappedEventDefinitionId : null
  const standardEventDefinitionIdAtRecording = definition.kind === 'EVENT_CUSTOM' ? null : definition.mappedEventDefinitionId
  const mappingStatusAtRecording = definition.kind === 'EVENT_CUSTOM' ? 'NONE' : definition.mappingStatus
  const duplicateSince = new Date(Date.now() - 5000)
  const now = new Date()
  return db.$transaction(async (tx) => {
    const duplicate = await tx.submittedMatchEvent.findFirst({
      where: { assignmentId, matchDayId: assignment.trackingTask.matchDayId, submittedByUserId: actorUserId, playerId: submittedPlayerId, clubTrackingDefinitionId: definition.id, eventDefinitionId, createdAt: { gte: duplicateSince } },
      select: { id: true },
    })
    if (duplicate) return clubEventError('duplicateSubmission')
    const submission = await tx.submittedMatchEvent.create({
      data: {
        assignmentId,
        matchDayId: assignment.trackingTask.matchDayId,
        playerId: submittedPlayerId,
        submittedByUserId: actorUserId,
        eventDefinitionId,
        eventType: eventDefinitionId ? definition.mappedEventDefinition?.legacyEventType ?? null : null,
        clubTrackingDefinitionId: definition.id,
        standardEventDefinitionIdAtRecording,
        clubMappingRevisionAtRecording: definition.mappingRevision,
        clubMappingStatusAtRecording: mappingStatusAtRecording,
        half: activeHalf.half,
        matchSecond: getSecondsBetween(activeHalf.startedAt, now),
        ownScoreAtTime: assignment.trackingTask.matchDay.ownScore,
        oppositionScoreAtTime: assignment.trackingTask.matchDay.oppositionScore,
        x: validCoordinate(x) ? x ?? null : null,
        y: validCoordinate(y) ? y ?? null : null,
        note: note?.trim() ? note.trim().slice(0, 280) : null,
        status: 'PENDING',
      },
      select: { id: true },
    })
    return { ok: true as const, observationId: submission.id, activityItem: { id: submission.id, type: 'event' as const, label: definition.name } }
  })
}
