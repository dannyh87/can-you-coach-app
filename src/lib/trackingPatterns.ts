import type { MatchTrackingScope, Prisma, TrackingTargetContext } from '@prisma/client'

import { clubDefinitionMatchesTrackingContext, getClubDefinitionLocalSelectionEligibility, observationContributesToStandardReporting } from '@/lib/clubTrackingDefinitions'
import { canManageMatchDay, canRunMatchDay } from '@/lib/permissions'
import { getActiveHalf, getSecondsBetween } from '@/lib/parentMatchAccess'
import { getPositiveRate } from '@/lib/observationReporting'
import { prisma } from '@/lib/prisma'
import { normalizeTrackingSearch } from '@/lib/matchTrackingResolver'

type Db = typeof prisma | Prisma.TransactionClient
type Result<T = true> = { ok: true; value: T } | { ok: false; reason: string; fieldErrors?: Record<string, string[]> }
type ClubPatternRecordingReason = 'notAuthorized' | 'taskItemMissing' | 'definitionUnavailable' | 'definitionRetired' | 'taskDefinitionStale' | 'mappingRejected' | 'locationRequired' | 'locationInvalid' | 'outcomeInvalid' | 'assignmentClosed' | 'duplicateSubmission'
type RecordClubTrackingResult =
  | { ok: true; observationId: string; activityItem: { id: string; type: 'pattern'; label: string } }
  | { ok: false; reason: ClubPatternRecordingReason; message: string }
type CoordinateInput = { x?: number | null; y?: number | null }

const validCoordinate = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
const normalizeOptionalText = (value: string | null | undefined) => value?.trim() ? value.trim() : null
const canRunTransaction = (db: Db): db is typeof prisma => '$transaction' in db

function clubPatternMessage(reason: ClubPatternRecordingReason) {
  const messages = {
    notAuthorized: 'You cannot record observations for this assignment.',
    taskItemMissing: 'This club tracking item is not part of the assignment task.',
    definitionUnavailable: 'This club tracking definition is not available.',
    definitionRetired: 'This club tracking definition has been retired.',
    taskDefinitionStale: 'This club tracking item has changed. Ask a coach to refresh the task.',
    mappingRejected: 'This club tracking mapping is not available for recording.',
    locationRequired: 'This club pattern requires pitch coordinates.',
    locationInvalid: 'Pitch location must be between 0 and 100.',
    outcomeInvalid: 'Choose a valid outcome for this tactical pattern.',
    assignmentClosed: 'Assignment must be in progress before observations can be recorded.',
    duplicateSubmission: 'That pattern observation was already submitted a moment ago.',
  }
  return messages[reason]
}

const clubPatternError = (reason: ClubPatternRecordingReason): RecordClubTrackingResult => ({ ok: false, reason, message: clubPatternMessage(reason) })

function getTaskTargetContext(task: { scopeType: MatchTrackingScope; player?: { preferredPosition: string | null } | null; unitKey: string | null }) {
  if (task.scopeType === 'TEAM') return 'WHOLE_TEAM' as const
  if (task.scopeType === 'UNIT') return (task.unitKey || 'CUSTOM_UNIT') as TrackingTargetContext
  return null
}

function patternWhereForAccess(clubId?: string | null): Prisma.TrackingPatternDefinitionWhereInput {
  return { OR: [{ ownerScope: 'GLOBAL' }, ...(clubId ? [{ ownerScope: 'CLUB' as const, clubId }] : [])] }
}

export async function getAvailableTrackingPatterns({ db = prisma, clubId, scopeType, targetContext, phase, focusArea, includeInactive = false }: { db?: Db; clubId?: string | null; scopeType?: MatchTrackingScope; targetContext?: TrackingTargetContext | null; phase?: string; focusArea?: string; includeInactive?: boolean }) {
  const patterns = await db.trackingPatternDefinition.findMany({
    where: {
      ...patternWhereForAccess(clubId),
      ...(includeInactive ? {} : { active: true }),
      ...(phase ? { phase: phase as never } : {}),
      ...(focusArea ? { focusArea: focusArea as never } : {}),
      ...(scopeType ? { contexts: { some: { scopeType, OR: [{ targetContext: targetContext ?? null }, { targetContext: null }] } } } : {}),
    },
    include: { contexts: true, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' } }, outcomes: { orderBy: { displayOrder: 'asc' } }, aliases: true },
    orderBy: [{ phase: 'asc' }, { focusArea: 'asc' }, { name: 'asc' }],
  })
  return patterns.map(formatPattern)
}

export async function getTrackingPattern(patternId: string, db: Db = prisma) {
  const pattern = await db.trackingPatternDefinition.findUnique({ where: { id: patternId }, include: { contexts: true, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' } }, outcomes: { orderBy: { displayOrder: 'asc' } }, aliases: true } })
  return pattern ? formatPattern(pattern) : null
}

export async function searchTrackingPatterns(query: string, { db = prisma, clubId, scopeType, targetContext }: { db?: Db; clubId?: string | null; scopeType?: MatchTrackingScope; targetContext?: TrackingTargetContext | null } = {}) {
  const normalized = normalizeTrackingSearch(query)
  if (!normalized) return []
  const patterns = await db.trackingPatternDefinition.findMany({
    where: { AND: [patternWhereForAccess(clubId), { active: true }, { OR: [{ normalizedName: { contains: normalized, mode: 'insensitive' } }, { aliases: { some: { normalizedAlias: { contains: normalized, mode: 'insensitive' } } } }] }, ...(scopeType ? [{ contexts: { some: { scopeType, OR: [{ targetContext: targetContext ?? null }, { targetContext: null }] } } }] : [])] },
    include: { contexts: true, steps: { include: { eventDefinition: true }, orderBy: { stepOrder: 'asc' } }, outcomes: { orderBy: { displayOrder: 'asc' } }, aliases: true },
    take: 20,
  })
  return patterns.map((pattern) => ({ ...formatPattern(pattern), matchedAliases: pattern.aliases.filter((alias) => alias.normalizedAlias.includes(normalized)).map((alias) => alias.alias) }))
}

export async function getPatternOutcomes(patternId: string, db: Db = prisma) {
  return db.trackingPatternOutcome.findMany({ where: { patternId }, select: { id: true, code: true, label: true, description: true, displayOrder: true, positive: true }, orderBy: { displayOrder: 'asc' } })
}

export async function getPatternSteps(patternId: string, db: Db = prisma) {
  return db.trackingPatternStep.findMany({ where: { patternId }, select: { id: true, stepOrder: true, label: true, description: true, required: true, eventDefinitionId: true, eventDefinition: { select: { name: true } } }, orderBy: { stepOrder: 'asc' } })
}

export async function validatePatternContext({ db = prisma, patternId, scopeType, targetContext, clubId }: { db?: Db; patternId: string; scopeType: MatchTrackingScope; targetContext?: TrackingTargetContext | null; clubId?: string | null }): Promise<Result> {
  const pattern = await db.trackingPatternDefinition.findFirst({ where: { id: patternId, active: true, ...patternWhereForAccess(clubId) }, include: { contexts: true } })
  if (!pattern) return { ok: false, reason: 'Pattern is not active or accessible.' }
  const compatible = pattern.contexts.some((context) => context.scopeType === scopeType && (context.targetContext === null || context.targetContext === (targetContext ?? null)))
  return compatible ? { ok: true, value: true } : { ok: false, reason: 'Pattern is not compatible with this tracking context.' }
}

export async function validatePatternSelection({ db = prisma, trackingTaskId, patternIds }: { db?: Db; trackingTaskId: string; patternIds: string[] }): Promise<Result> {
  const selectedIds = patternIds.filter(Boolean)
  if (selectedIds.length !== new Set(selectedIds).size) return { ok: false, reason: 'Duplicate pattern selections are not allowed.' }
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, select: { id: true, scopeType: true, unitKey: true, matchDay: { select: { team: { select: { clubId: true } } } } } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  for (const patternId of selectedIds) {
    const result = await validatePatternContext({ db, patternId, scopeType: task.scopeType, targetContext: getTaskTargetContext(task), clubId: task.matchDay.team.clubId })
    if (!result.ok) return result
  }
  return { ok: true, value: true }
}

export async function setMatchTrackingTaskPatterns({ db = prisma, actorUserId, trackingTaskId, patternIds }: { db?: Db; actorUserId: string; trackingTaskId: string; patternIds: string[] }): Promise<Result> {
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, select: { id: true, matchDayId: true, status: true } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  if (!(await canManageMatchDay(actorUserId, task.matchDayId))) return { ok: false, reason: 'You cannot manage tracking tasks for this match.' }
  if (task.status === 'ARCHIVED') return { ok: false, reason: 'Archived tasks cannot be changed.' }
  const selectedIds = Array.from(new Set(patternIds.filter(Boolean)))
  if (selectedIds.length !== patternIds.filter(Boolean).length) return { ok: false, reason: 'Duplicate pattern selections are not allowed.' }
  const valid = await validatePatternSelection({ db, trackingTaskId, patternIds: selectedIds })
  if (!valid.ok) return valid
  const operations = [db.matchTrackingTaskPattern.deleteMany({ where: { trackingTaskId } }), ...selectedIds.map((patternId, index) => db.matchTrackingTaskPattern.create({ data: { trackingTaskId, patternId, displayOrder: index } }))]
  if (canRunTransaction(db)) await db.$transaction(operations)
  else for (const operation of operations) await operation
  return { ok: true, value: true }
}

export async function createPatternObservation({ db = prisma, assignmentId, actorUserId, patternId, outcomeId, playerId, note, x, y }: { db?: Db; assignmentId: string; actorUserId: string; patternId: string; outcomeId: string; playerId?: string | null; note?: string | null } & CoordinateInput): Promise<Result<{ id: string }>> {
  const validation = await validatePatternObservationContext({ db, assignmentId, actorUserId, patternId, outcomeId, playerId, x, y })
  if (!validation.ok) return validation
  const now = new Date()
  const duplicateSince = new Date(Date.now() - 5000)
  const duplicate = await db.submittedTrackingPatternObservation.findFirst({
    where: {
      assignmentId,
      matchDayId: validation.value.matchDayId,
      submittedByUserId: actorUserId,
      playerId: validation.value.playerId,
      patternId,
      outcomeId,
      createdAt: { gte: duplicateSince },
    },
    select: { id: true },
  })
  if (duplicate) return { ok: false, reason: 'That pattern observation was already submitted a moment ago.' }
  const observation = await db.submittedTrackingPatternObservation.create({
    data: {
      assignmentId,
      matchDayId: validation.value.matchDayId,
      trackingTaskId: validation.value.trackingTaskId,
      submittedByUserId: actorUserId,
      playerId: validation.value.playerId,
      patternId,
      outcomeId,
      half: validation.value.activeHalf.half,
      matchSecond: getSecondsBetween(validation.value.activeHalf.startedAt, now),
      ownScoreAtTime: validation.value.match.ownScore,
      oppositionScoreAtTime: validation.value.match.oppositionScore,
      x: validation.value.x,
      y: validation.value.y,
      note: normalizeOptionalText(note)?.slice(0, 280) ?? null,
      status: 'PENDING',
    },
    select: { id: true },
  })
  return { ok: true, value: observation }
}

export async function recordAssignedClubPattern({ db = prisma, assignmentId, actorUserId, taskClubDefinitionId, outcomeId, playerId, note, x, y }: { db?: Db; assignmentId: string; actorUserId: string; taskClubDefinitionId: string; outcomeId: string; playerId?: string | null; note?: string | null } & CoordinateInput): Promise<RecordClubTrackingResult> {
  if ((x !== undefined && x !== null && !validCoordinate(x)) || (y !== undefined && y !== null && !validCoordinate(y))) return clubPatternError('locationInvalid')
  const assignment = await db.matchContributorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      trackingTask: {
        include: {
          matchDay: { include: { team: { select: { clubId: true } } } },
          clubDefinitions: { where: { id: taskClubDefinitionId }, include: { clubTrackingDefinition: { include: { mappedPatternDefinition: { include: { contexts: true, outcomes: true } } } } } },
        },
      },
    },
  })
  if (!assignment || assignment.assignedUserId !== actorUserId) return clubPatternError('notAuthorized')
  if (assignment.status !== 'IN_PROGRESS') return clubPatternError('assignmentClosed')
  if (assignment.trackingTask.status !== 'READY') return clubPatternError('assignmentClosed')
  const link = assignment.trackingTask.clubDefinitions[0]
  if (!link) return clubPatternError('taskItemMissing')
  const definition = link.clubTrackingDefinition
  if (!['PATTERN_ALIAS', 'PATTERN_MAPPED'].includes(definition.kind)) return clubPatternError('definitionUnavailable')
  if (definition.clubId !== assignment.trackingTask.matchDay.team.clubId) return clubPatternError('definitionUnavailable')
  if (!definition.active || definition.retiredAt || definition.status === 'RETIRED') return clubPatternError('definitionRetired')
  const eligibility = getClubDefinitionLocalSelectionEligibility(definition)
  if (!eligibility.selectable) return definition.mappingStatus === 'REJECTED' ? clubPatternError('mappingRejected') : clubPatternError('definitionUnavailable')
  if (definition.kind !== link.selectedKind) return clubPatternError('taskDefinitionStale')
  if (!definition.mappedPatternDefinitionId || !definition.mappedPatternDefinition) return clubPatternError('definitionUnavailable')
  if (definition.mappedPatternDefinitionId !== link.standardPatternDefinitionIdAtSelection) return clubPatternError('taskDefinitionStale')
  if (!clubDefinitionMatchesTrackingContext(definition, { scope: assignment.trackingTask.scopeType, targetContext: getTaskTargetContext(assignment.trackingTask) })) return clubPatternError('taskDefinitionStale')
  if (!definition.mappedPatternDefinition.active) return clubPatternError('taskDefinitionStale')
  const compatible = definition.mappedPatternDefinition.contexts.some((context) => context.scopeType === assignment.trackingTask.scopeType && (context.targetContext === null || context.targetContext === getTaskTargetContext(assignment.trackingTask)))
  if (!compatible) return clubPatternError('taskDefinitionStale')
  if (!definition.mappedPatternDefinition.outcomes.some((outcome) => outcome.id === outcomeId)) return clubPatternError('outcomeInvalid')

  const requiresLocation = Boolean(definition.requiresLocation || definition.mappedPatternDefinition.requiresLocation)
  if (requiresLocation && (!validCoordinate(x) || !validCoordinate(y))) return clubPatternError('locationRequired')
  const activeHalf = getActiveHalf(assignment.trackingTask.matchDay)
  if (!activeHalf) return clubPatternError('assignmentClosed')
  const submittedPlayerId = assignment.trackingTask.scopeType === 'PLAYER' ? playerId?.trim() || null : null
  if (assignment.trackingTask.scopeType === 'PLAYER') {
    if (!submittedPlayerId || submittedPlayerId !== assignment.trackingTask.playerId) return clubPatternError('notAuthorized')
    const openStint = await db.matchPlayerStint.findFirst({ where: { matchDayId: assignment.trackingTask.matchDayId, playerId: submittedPlayerId, endedAt: null }, select: { id: true } })
    if (!openStint) return clubPatternError('notAuthorized')
  }
  const duplicateSince = new Date(Date.now() - 5000)
  const now = new Date()
  const create = async (tx: Db) => {
    const duplicate = await tx.submittedTrackingPatternObservation.findFirst({ where: { assignmentId, matchDayId: assignment.trackingTask.matchDayId, submittedByUserId: actorUserId, playerId: submittedPlayerId, clubTrackingDefinitionId: definition.id, patternId: definition.mappedPatternDefinitionId!, outcomeId, createdAt: { gte: duplicateSince } }, select: { id: true } })
    if (duplicate) return clubPatternError('duplicateSubmission')
    const observation = await tx.submittedTrackingPatternObservation.create({
      data: {
        assignmentId,
        matchDayId: assignment.trackingTask.matchDayId,
        trackingTaskId: assignment.trackingTaskId,
        submittedByUserId: actorUserId,
        playerId: submittedPlayerId,
        patternId: definition.mappedPatternDefinitionId!,
        outcomeId,
        clubTrackingDefinitionId: definition.id,
        standardPatternDefinitionIdAtRecording: definition.mappedPatternDefinitionId,
        clubMappingRevisionAtRecording: definition.mappingRevision,
        clubMappingStatusAtRecording: definition.mappingStatus,
        half: activeHalf.half,
        matchSecond: getSecondsBetween(activeHalf.startedAt, now),
        ownScoreAtTime: assignment.trackingTask.matchDay.ownScore,
        oppositionScoreAtTime: assignment.trackingTask.matchDay.oppositionScore,
        x: validCoordinate(x) ? x ?? null : null,
        y: validCoordinate(y) ? y ?? null : null,
        note: normalizeOptionalText(note)?.slice(0, 280) ?? null,
        status: 'PENDING',
      },
      select: { id: true },
    })
    return { ok: true as const, observationId: observation.id, activityItem: { id: observation.id, type: 'pattern' as const, label: definition.name } }
  }
  return canRunTransaction(db) ? db.$transaction((tx) => create(tx)) : create(db)
}

export async function undoPendingPatternObservation({ db = prisma, actorUserId, assignmentId, observationId }: { db?: Db; actorUserId: string; assignmentId: string; observationId: string }): Promise<Result> {
  const observation = await db.submittedTrackingPatternObservation.findFirst({ where: { id: observationId, assignmentId, submittedByUserId: actorUserId }, select: { id: true, status: true, assignment: { select: { status: true } } } })
  if (!observation) return { ok: false, reason: 'Pending pattern observation was not found.' }
  if (observation.status !== 'PENDING') return { ok: false, reason: 'Reviewed pattern observations cannot be undone.' }
  if (observation.assignment.status === 'SUBMITTED') return { ok: false, reason: 'Submitted assignments cannot be changed.' }
  await db.submittedTrackingPatternObservation.delete({ where: { id: observation.id } })
  return { ok: true, value: true }
}

export async function reviewPatternObservation({ db = prisma, actorUserId, observationId, decision }: { db?: Db; actorUserId: string; observationId: string; decision: 'ACCEPTED' | 'IGNORED' }): Promise<Result<{ officialObservationId: string | null }>> {
  const observation = await db.submittedTrackingPatternObservation.findUnique({ where: { id: observationId }, include: { matchDay: { select: { id: true, status: true } } } })
  if (!observation) return { ok: false, reason: 'Pattern observation was not found.' }
  if (observation.submittedByUserId === actorUserId) return { ok: false, reason: 'Contributors cannot review their own observations.' }
  if (!(await canRunMatchDay(actorUserId, observation.matchDayId))) return { ok: false, reason: 'You cannot review observations for this match.' }
  if (observation.matchDay.status === 'DRAFT') return { ok: false, reason: 'Draft matches cannot review pattern observations.' }
  const reviewedAt = new Date()
  const applyReview = async (tx: Db) => {
    const existing = await tx.matchTrackingPatternObservation.findUnique({ where: { submittedObservationId: observation.id }, select: { id: true } })
    if (existing) return { ok: true as const, value: { officialObservationId: existing.id } }
    if (observation.status !== 'PENDING') return { ok: false as const, reason: 'This pattern observation has already been reviewed.' }
    const updated = await tx.submittedTrackingPatternObservation.updateMany({ where: { id: observation.id, status: 'PENDING' }, data: { status: decision, reviewedAt, reviewedByUserId: actorUserId } })
    if (updated.count !== 1) return { ok: false as const, reason: 'This pattern observation has already been reviewed.' }
    if (decision === 'IGNORED') return { ok: true as const, value: { officialObservationId: null } }
    try {
      const official = await tx.matchTrackingPatternObservation.create({
        data: {
          submittedObservationId: observation.id,
          matchDayId: observation.matchDayId,
          trackingTaskId: observation.trackingTaskId,
          assignmentId: observation.assignmentId,
          submittedByUserId: observation.submittedByUserId,
          playerId: observation.playerId,
          patternId: observation.patternId,
          outcomeId: observation.outcomeId,
          clubTrackingDefinitionId: observation.clubTrackingDefinitionId,
          standardPatternDefinitionIdAtRecording: observation.standardPatternDefinitionIdAtRecording,
          clubMappingRevisionAtRecording: observation.clubMappingRevisionAtRecording,
          clubMappingStatusAtRecording: observation.clubMappingStatusAtRecording,
          half: observation.half,
          matchSecond: observation.matchSecond,
          ownScoreAtTime: observation.ownScoreAtTime,
          oppositionScoreAtTime: observation.oppositionScoreAtTime,
          x: observation.x,
          y: observation.y,
          note: observation.note,
        },
        select: { id: true },
      })
      return { ok: true as const, value: { officialObservationId: official.id } }
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        const official = await tx.matchTrackingPatternObservation.findUnique({ where: { submittedObservationId: observation.id }, select: { id: true } })
        if (official) return { ok: true as const, value: { officialObservationId: official.id } }
      }
      return { ok: false as const, reason: 'Pattern observation could not be accepted.' }
    }
  }
  return canRunTransaction(db) ? db.$transaction((tx) => applyReview(tx)) : applyReview(db)
}

async function validatePatternObservationContext({ db, assignmentId, actorUserId, patternId, outcomeId, playerId, x, y }: { db: Db; assignmentId: string; actorUserId: string; patternId: string; outcomeId: string; playerId?: string | null } & CoordinateInput): Promise<Result<{ matchDayId: string; trackingTaskId: string; playerId: string | null; activeHalf: NonNullable<ReturnType<typeof getActiveHalf>>; match: { ownScore: number; oppositionScore: number }; x: number | null; y: number | null }>> {
  const assignment = await db.matchContributorAssignment.findUnique({ where: { id: assignmentId }, include: { trackingTask: { include: { matchDay: true, player: { select: { id: true, preferredPosition: true } }, patterns: { include: { pattern: { include: { contexts: true, outcomes: true } } } } } } } })
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  if (assignment.assignedUserId !== actorUserId) return { ok: false, reason: 'This assignment belongs to another user.' }
  if (assignment.status !== 'IN_PROGRESS') return { ok: false, reason: 'Assignment must be started before observations can be recorded.' }
  if (assignment.trackingTask.status !== 'READY') return { ok: false, reason: 'Tracking task is not ready.' }
  const taskPattern = assignment.trackingTask.patterns.find((candidate) => candidate.patternId === patternId)
  if (!taskPattern) return { ok: false, reason: 'This pattern is not part of the assignment task.' }
  if (!taskPattern.pattern.active) return { ok: false, reason: 'Pattern is not active.' }
  if (!taskPattern.pattern.outcomes.some((outcome) => outcome.id === outcomeId)) return { ok: false, reason: 'Outcome does not belong to this pattern.' }
  const compatible = taskPattern.pattern.contexts.some((context) => context.scopeType === assignment.trackingTask.scopeType && (context.targetContext === null || context.targetContext === getTaskTargetContext(assignment.trackingTask)))
  if (!compatible) return { ok: false, reason: 'Pattern is not compatible with this task scope.' }
  const activeHalf = getActiveHalf(assignment.trackingTask.matchDay)
  if (!activeHalf) return { ok: false, reason: 'Match is not currently recordable.' }
  const submittedPlayerId = assignment.trackingTask.scopeType === 'PLAYER' ? playerId?.trim() || null : null
  if (assignment.trackingTask.scopeType === 'PLAYER') {
    if (!submittedPlayerId || submittedPlayerId !== assignment.trackingTask.playerId) return { ok: false, reason: 'Pattern observation player does not match the assignment player.' }
    const openStint = await db.matchPlayerStint.findFirst({ where: { matchDayId: assignment.trackingTask.matchDayId, playerId: submittedPlayerId, endedAt: null }, select: { id: true } })
    if (!openStint) return { ok: false, reason: 'Player is not currently on the pitch.' }
  }
  if (taskPattern.pattern.requiresLocation && (!validCoordinate(x) || !validCoordinate(y))) return { ok: false, reason: 'This pattern requires pitch coordinates.' }
  return { ok: true, value: { matchDayId: assignment.trackingTask.matchDayId, trackingTaskId: assignment.trackingTaskId, playerId: submittedPlayerId, activeHalf, match: assignment.trackingTask.matchDay, x: validCoordinate(x) ? x ?? null : null, y: validCoordinate(y) ? y ?? null : null } }
}

export function getPatternObservationLabel(observation: { pattern: { name: string }; outcome: { label: string } }) {
  return `${observation.pattern.name} · ${observation.outcome.label}`
}

export function getPatternObservationTarget(observation: { player?: { firstName: string; surname: string } | null; trackingTask: { scopeType: string; unitLabel: string | null } }) {
  if (observation.trackingTask.scopeType === 'PLAYER') return observation.player ? `${observation.player.firstName} ${observation.player.surname}` : 'Selected player'
  if (observation.trackingTask.scopeType === 'UNIT') return observation.trackingTask.unitLabel ?? 'Selected unit'
  return 'Whole team'
}

export async function copyTrackingTaskPatterns({ db, sourceTaskId, destinationTaskId, destinationClubId }: { db: Db; sourceTaskId: string; destinationTaskId: string; destinationClubId?: string | null }): Promise<Result<{ missingPatternIds: string[] }>> {
  const sourcePatterns = await db.matchTrackingTaskPattern.findMany({ where: { trackingTaskId: sourceTaskId }, include: { pattern: true }, orderBy: { displayOrder: 'asc' } })
  const accessiblePatterns = await db.trackingPatternDefinition.findMany({ where: { id: { in: sourcePatterns.map((item) => item.patternId) }, active: true, ...patternWhereForAccess(destinationClubId) }, select: { id: true } })
  const accessibleIds = new Set(accessiblePatterns.map((pattern) => pattern.id))
  const missingPatternIds = sourcePatterns.filter((item) => !accessibleIds.has(item.patternId)).map((item) => item.patternId)
  if (missingPatternIds.length > 0) return { ok: false, reason: 'One or more task patterns are not available for the destination match.', fieldErrors: { patternIds: missingPatternIds } }
  if (sourcePatterns.length > 0) await db.matchTrackingTaskPattern.createMany({ data: sourcePatterns.map((item, index) => ({ trackingTaskId: destinationTaskId, patternId: item.patternId, displayOrder: index })), skipDuplicates: true })
  return { ok: true, value: { missingPatternIds: [] } }
}

export async function getPatternReportBreakdown({ db = prisma, matchDayId }: { db?: Db; matchDayId?: string } = {}) {
  const observations = await db.matchTrackingPatternObservation.findMany({ where: matchDayId ? { matchDayId } : {}, include: { pattern: { include: { outcomes: true } }, outcome: true, player: true, clubTrackingDefinition: true, trackingTask: { include: { topic: true } }, matchDay: true } })
  const byPattern = new Map<string, { patternId: string; pattern: string; count: number; positiveCount: number; hasDefinedPositiveOutcome: boolean; outcomeCounts: Record<string, number> }>()
  for (const observation of observations) {
    if (!observationContributesToStandardReporting({ clubTrackingDefinitionId: observation.clubTrackingDefinitionId, clubDefinitionKind: observation.clubTrackingDefinition?.kind, mappingStatusAtRecording: observation.clubMappingStatusAtRecording, patternId: observation.patternId })) continue
    const row = byPattern.get(observation.patternId) ?? { patternId: observation.patternId, pattern: observation.pattern.name, count: 0, positiveCount: 0, hasDefinedPositiveOutcome: false, outcomeCounts: {} }
    row.count += 1
    if (observation.outcome.positive === true) row.positiveCount += 1
    row.hasDefinedPositiveOutcome = row.hasDefinedPositiveOutcome || observation.outcome.positive === true || observation.pattern.outcomes.some((outcome) => outcome.positive === true)
    row.outcomeCounts[observation.outcome.label] = (row.outcomeCounts[observation.outcome.label] ?? 0) + 1
    byPattern.set(observation.patternId, row)
  }
  return Array.from(byPattern.values()).map(({ hasDefinedPositiveOutcome, ...row }) => ({ ...row, positiveRate: getPositiveRate(row.count, row.positiveCount, hasDefinedPositiveOutcome) }))
}

function formatPattern(pattern: { id: string; name: string; slug: string; description: string | null; phase: unknown; focusArea: unknown; requiresLocation: boolean; contexts: Array<{ scopeType: MatchTrackingScope; targetContext: TrackingTargetContext | null; recommended: boolean; displayOrder: number }>; steps: Array<{ eventDefinitionId: string; stepOrder: number; label: string | null; eventDefinition: { name: string } }>; outcomes: Array<{ id: string; code: string; label: string; description: string | null; displayOrder: number; positive: boolean | null }>; aliases: Array<{ alias: string }> }) {
  return { patternId: pattern.id, name: pattern.name, slug: pattern.slug, description: pattern.description ?? undefined, phase: pattern.phase, focusArea: pattern.focusArea, requiresLocation: pattern.requiresLocation, contexts: pattern.contexts, steps: pattern.steps.map((step) => ({ order: step.stepOrder, eventDefinitionId: step.eventDefinitionId, label: step.label ?? step.eventDefinition.name })), outcomes: pattern.outcomes, aliases: pattern.aliases.map((alias) => alias.alias) }
}
