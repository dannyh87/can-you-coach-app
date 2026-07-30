import type {
  MatchSquadStatus,
  MatchTrackingScope,
  TrackingFocusArea,
  TrackingTargetContext,
  TrackingTopicPhase,
} from '@prisma/client'

import { getMatchDayEventCategoryFallback } from '@/lib/eventDefinitions'
import {
  activeAssignmentStatuses,
  cancelContributorAssignment,
  copyMatchTrackingTask,
  createDirectAssignment,
  createGroupOffer,
  createSelfAssignment,
  getEligibleMatchContributors,
  validateTaskCanBeReady,
  validateTrackingTaskScope,
} from '@/lib/matchTrackingAssignments'
import { validateTrackingSetup } from '@/lib/matchTrackingResolver'
import { canManageMatchDay, canManageTeamData } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Db = typeof prisma

export type MatchDayV2Result<T = true> =
  | { ok: true; value: T }
  | { ok: false; reason: string; fieldErrors?: Record<string, string[]> }

const matchTypes = ['LEAGUE', 'CUP', 'FRIENDLY'] as const
const matchVenues = ['HOME', 'AWAY', 'NEUTRAL'] as const
const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const satisfies MatchSquadStatus[]
const scopes = ['PLAYER', 'UNIT', 'TEAM'] as const satisfies MatchTrackingScope[]

const normalizeOptionalText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

const userCanManageTeam = async (db: Db, userId: string, teamId: string) => {
  if (db === prisma) return canManageTeamData(userId, teamId)
  return true
}

const userCanManageMatch = async (db: Db, userId: string, matchDayId: string) => {
  if (db === prisma) return canManageMatchDay(userId, matchDayId)
  return true
}

async function getEditableMatch(db: Db, userId: string, matchDayId: string) {
  if (!(await userCanManageMatch(db, userId, matchDayId))) return null
  return db.matchDay.findUnique({
    where: { id: matchDayId },
    select: { id: true, teamId: true, status: true, team: { select: { clubId: true } } },
  })
}

function parseKickoffAt(date: string, kickoffTime: string) {
  const kickoffAt = new Date(`${date}T${kickoffTime}:00`)
  return Number.isNaN(kickoffAt.getTime()) ? null : kickoffAt
}

export async function createDraftMatchDayV2({
  db = prisma,
  userId,
  teamId,
  date,
  kickoffTime,
  opposition,
  matchType,
  venue,
}: {
  db?: Db
  userId: string
  teamId: string
  date: string
  kickoffTime: string
  opposition: string
  matchType: string
  venue: string
}): Promise<MatchDayV2Result<{ id: string }>> {
  if (!teamId || !date || !kickoffTime || !opposition.trim() || !matchType || !venue) {
    return { ok: false, reason: 'Team, date, kick-off time, opposition, match type and venue are required.' }
  }
  if (!matchTypes.includes(matchType as (typeof matchTypes)[number])) return { ok: false, reason: 'Match type is invalid.' }
  if (!matchVenues.includes(venue as (typeof matchVenues)[number])) return { ok: false, reason: 'Venue is invalid.' }
  if (!(await userCanManageTeam(db, userId, teamId))) return { ok: false, reason: 'You cannot create a match for this team.' }
  const kickoffAt = parseKickoffAt(date, kickoffTime)
  if (!kickoffAt) return { ok: false, reason: 'Kick-off date or time is invalid.' }

  const match = await db.matchDay.create({
    data: {
      teamId,
      kickoffAt,
      opposition: opposition.trim(),
      matchType: matchType as (typeof matchTypes)[number],
      venue: venue as (typeof matchVenues)[number],
      status: 'DRAFT',
    },
    select: { id: true },
  })
  return { ok: true, value: match }
}

export async function updateDraftMatchDayV2({
  db = prisma,
  userId,
  matchDayId,
  date,
  kickoffTime,
  opposition,
  matchType,
  venue,
}: {
  db?: Db
  userId: string
  matchDayId: string
  date: string
  kickoffTime: string
  opposition: string
  matchType: string
  venue: string
}): Promise<MatchDayV2Result> {
  const match = await getEditableMatch(db, userId, matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') return { ok: false, reason: 'Only draft matches can be changed.' }
  if (!matchTypes.includes(matchType as (typeof matchTypes)[number])) return { ok: false, reason: 'Match type is invalid.' }
  if (!matchVenues.includes(venue as (typeof matchVenues)[number])) return { ok: false, reason: 'Venue is invalid.' }
  const kickoffAt = parseKickoffAt(date, kickoffTime)
  if (!kickoffAt || !opposition.trim()) return { ok: false, reason: 'Match details are invalid.' }

  await db.matchDay.update({
    where: { id: match.id },
    data: { kickoffAt, opposition: opposition.trim(), matchType: matchType as (typeof matchTypes)[number], venue: venue as (typeof matchVenues)[number] },
  })
  return { ok: true, value: true }
}

export async function saveMatchDayV2Squad({
  db = prisma,
  userId,
  matchDayId,
  players,
}: {
  db?: Db
  userId: string
  matchDayId: string
  players: Array<{ playerId: string; squadStatus: MatchSquadStatus; startingPosition?: string | null }>
}): Promise<MatchDayV2Result> {
  const match = await getEditableMatch(db, userId, matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') return { ok: false, reason: 'Squad can only be changed before the match starts.' }

  const activePlayers = await db.player.findMany({ where: { teamId: match.teamId, isActive: true }, select: { id: true, squadNumber: true } })
  const activePlayersById = new Map(activePlayers.map((player) => [player.id, player]))
  const updatesByPlayerId = new Map<string, { squadStatus: MatchSquadStatus; startingPosition?: string | null }>()
  for (const player of players) {
    if (!activePlayersById.has(player.playerId)) return { ok: false, reason: 'One or more players are not active for this match team.' }
    if (!squadStatuses.includes(player.squadStatus)) return { ok: false, reason: 'Squad status is invalid.' }
    updatesByPlayerId.set(player.playerId, player)
  }

  await db.$transaction(
    activePlayers.map((player) => {
      const update = updatesByPlayerId.get(player.id)
      const squadStatus = update?.squadStatus ?? 'NOT_INVOLVED'
      return db.matchDayPlayer.upsert({
        where: { matchDayId_playerId: { matchDayId: match.id, playerId: player.id } },
        update: {
          squadStatus,
          startingPosition: normalizeOptionalText(update?.startingPosition),
          shirtNumberSnapshot: player.squadNumber,
          isTracked: squadStatus !== 'NOT_INVOLVED',
        },
        create: {
          matchDayId: match.id,
          playerId: player.id,
          squadStatus,
          startingPosition: normalizeOptionalText(update?.startingPosition),
          shirtNumberSnapshot: player.squadNumber,
          isTracked: squadStatus !== 'NOT_INVOLVED',
        },
      })
    })
  )
  return { ok: true, value: true }
}

export async function ensureMatchDayEventTypesForDefinitions({
  db = prisma,
  userId,
  matchDayId,
  eventDefinitionIds,
}: {
  db?: Db
  userId: string
  matchDayId: string
  eventDefinitionIds: string[]
}): Promise<MatchDayV2Result<Array<{ id: string; eventDefinitionId: string }>>> {
  const match = await getEditableMatch(db, userId, matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') return { ok: false, reason: 'Event setup can only be changed before the match starts.' }
  const uniqueIds = Array.from(new Set(eventDefinitionIds.filter(Boolean)))
  if (uniqueIds.length === 0) return { ok: false, reason: 'Select at least one event.' }

  const definitions = await db.eventDefinition.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
      archivedAt: null,
      OR: [{ scope: 'GLOBAL' }, { scope: 'CLUB', clubId: match.team.clubId }],
    },
  })
  if (definitions.length !== uniqueIds.length) return { ok: false, reason: 'One or more selected events are no longer available.' }
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]))

  const rows = await db.$transaction(
    uniqueIds.map((eventDefinitionId) => {
      const definition = definitionsById.get(eventDefinitionId)
      if (!definition) throw new Error('Event definition is invalid.')
      return db.matchDayEventType.upsert({
        where: { matchDayId_eventDefinitionId: { matchDayId: match.id, eventDefinitionId } },
        update: {
          eventType: definition.legacyEventType ?? null,
          category: getMatchDayEventCategoryFallback(definition),
        },
        create: {
          matchDayId: match.id,
          eventDefinitionId,
          eventType: definition.legacyEventType ?? null,
          category: getMatchDayEventCategoryFallback(definition),
        },
        select: { id: true, eventDefinitionId: true },
      })
    })
  )

  const rowsByDefinitionId = new Map(rows.flatMap((row: { id: string; eventDefinitionId: string | null }) => row.eventDefinitionId ? [[row.eventDefinitionId, { id: row.id, eventDefinitionId: row.eventDefinitionId }] as const] : []))
  return { ok: true, value: uniqueIds.map((id) => rowsByDefinitionId.get(id)).filter((row): row is { id: string; eventDefinitionId: string } => Boolean(row)) }
}

export async function createGuidedMatchTrackingTaskV2({
  db = prisma,
  userId,
  matchDayId,
  scope,
  targetContext,
  phase,
  focusArea,
  topicId,
  selectedEventDefinitionIds,
  playerId,
  unitKey,
  unitLabel,
  title,
  instructions,
}: {
  db?: Db
  userId: string
  matchDayId: string
  scope: MatchTrackingScope
  targetContext?: TrackingTargetContext | null
  phase: TrackingTopicPhase
  focusArea: TrackingFocusArea
  topicId: string
  selectedEventDefinitionIds: string[]
  playerId?: string | null
  unitKey?: string | null
  unitLabel?: string | null
  title: string
  instructions?: string | null
}): Promise<MatchDayV2Result<{ id: string }>> {
  if (!scopes.includes(scope)) return { ok: false, reason: 'Tracking scope is invalid.' }
  const match = await getEditableMatch(db, userId, matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') return { ok: false, reason: 'Tracking tasks can only be changed before the match starts.' }

  const normalizedUnitLabel = scope === 'UNIT' ? normalizeOptionalText(unitLabel ?? (targetContext ? targetContext.replaceAll('_', ' ').toLowerCase() : null)) : null
  const normalizedUnitKey = scope === 'UNIT' ? normalizeOptionalText(unitKey ?? targetContext?.toLowerCase().replaceAll('_', '-')) : null
  const scopeValidation = validateTrackingTaskScope({ scopeType: scope, playerId: playerId ?? null, unitKey: normalizedUnitKey, unitLabel: normalizedUnitLabel }, { requireCompletePlayer: true })
  if (!scopeValidation.ok) return { ok: false, reason: scopeValidation.reason }

  if (scope === 'PLAYER' && playerId) {
    const squadPlayer = await db.matchDayPlayer.findFirst({ where: { matchDayId, playerId, squadStatus: { not: 'NOT_INVOLVED' }, player: { teamId: match.teamId } }, select: { id: true } })
    if (!squadPlayer) return { ok: false, reason: 'Player must belong to the match team and be in the match squad.' }
  }

  const setup = await validateTrackingSetup({
    scope,
    targetContext: scope === 'TEAM' ? 'WHOLE_TEAM' : targetContext ?? undefined,
    phase,
    focusArea,
    topicId,
    clubId: match.team.clubId,
    selectedEventDefinitionIds,
    mode: 'STANDARD_GUIDED',
  }, db)
  if (!setup.ok) return { ok: false, reason: 'Tracking setup is invalid.', fieldErrors: Object.fromEntries(setup.errors.map((error) => [error.field, [error.message]])) }

  const eventRows = await ensureMatchDayEventTypesForDefinitions({ db, userId, matchDayId, eventDefinitionIds: setup.eventDefinitionIds })
  if (!eventRows.ok) return eventRows
  const taskTitle = title.trim()
  if (!taskTitle) return { ok: false, reason: 'Tracking task title is required.' }

  const task = await db.$transaction(async (tx) => {
    const created = await tx.matchTrackingTask.create({
      data: {
        matchDayId,
        createdByUserId: userId,
        topicId: setup.topicId ?? null,
        scopeType: scope,
        playerId: scope === 'PLAYER' ? playerId : null,
        unitKey: normalizedUnitKey,
        unitLabel: normalizedUnitLabel,
        title: taskTitle,
        instructions: normalizeOptionalText(instructions),
        status: 'READY',
      },
      select: { id: true },
    })
    await tx.matchTrackingTaskEvent.createMany({
      data: eventRows.value.map((row, index) => ({ trackingTaskId: created.id, matchDayEventTypeId: row.id, displayOrder: index })),
    })
    return created
  })

  return { ok: true, value: task }
}

export async function copyPreviousMatchTrackingTaskV2({
  db = prisma,
  userId,
  sourceTaskId,
  destinationMatchDayId,
  destinationPlayerId,
}: {
  db?: Db
  userId: string
  sourceTaskId: string
  destinationMatchDayId: string
  destinationPlayerId?: string | null
}): Promise<MatchDayV2Result<{ id: string; requiresPlayerSelection: boolean; missingEventIds: string[] }>> {
  const sourceTask = await db.matchTrackingTask.findUnique({
    where: { id: sourceTaskId },
    include: { events: { include: { matchDayEventType: true }, orderBy: { displayOrder: 'asc' } } },
  })
  if (!sourceTask) return { ok: false, reason: 'Source tracking task was not found.' }
  const eventDefinitionIds = sourceTask.events.flatMap((event) => event.matchDayEventType.eventDefinitionId ? [event.matchDayEventType.eventDefinitionId] : [])
  if (eventDefinitionIds.length > 0) {
    const ensured = await ensureMatchDayEventTypesForDefinitions({ db, userId, matchDayId: destinationMatchDayId, eventDefinitionIds })
    if (!ensured.ok) return ensured
  }
  const copied = await copyMatchTrackingTask({ db, actorUserId: userId, sourceTaskId, destinationMatchDayId, destinationPlayerId })
  if (!copied.ok) return { ok: false, reason: copied.reason, fieldErrors: copied.missingEventIds ? { missingEventIds: copied.missingEventIds } : undefined }
  return { ok: true, value: copied.value }
}

export async function getMatchDayV2SetupState({ db = prisma, userId, matchDayId }: { db?: Db; userId: string; matchDayId: string }): Promise<MatchDayV2Result<{
  id: string
  status: string
  squadCount: number
  tasks: Array<{
    id: string
    title: string
    scopeType: MatchTrackingScope
    targetLabel: string
    topicName: string | null
    status: string
    eventCount: number
    assignments: Array<{
      id: string
      assignmentMode: string
      status: string
      assignedUserId: string | null
      recipientCount: number
      submittedObservationCount: number
      pendingObservationCount: number
      createdAt: Date
      acceptedAt: Date | null
      startedAt: Date | null
      submittedAt: Date | null
      cancelledAt: Date | null
    }>
    activeAssignment: { id: string; assignmentMode: string; status: string; assignedUserId: string | null; recipientCount: number } | null
  }>
  coverage: { totalTasks: number; assigned: number; openGroupOffers: number; awaitingResponse: number; accepted: number; unassigned: number; draftTasks: number }
}>> {
  if (!(await userCanManageMatch(db, userId, matchDayId))) return { ok: false, reason: 'You cannot manage this Match Day setup.' }
  const match = await db.matchDay.findUnique({
    where: { id: matchDayId },
    select: {
      id: true,
      status: true,
      matchDayPlayers: { where: { squadStatus: { not: 'NOT_INVOLVED' } }, select: { id: true } },
      matchTrackingTasks: {
        where: { status: { not: 'ARCHIVED' } },
        include: {
          player: { select: { firstName: true, surname: true } },
          topic: { select: { name: true } },
          events: { select: { id: true } },
          assignments: {
            include: { recipients: { select: { id: true } }, submittedMatchEvents: { select: { status: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!match) return { ok: false, reason: 'Match was not found.' }
  const tasks = match.matchTrackingTasks.map((task) => {
    const assignments = task.assignments.map((assignment) => ({
      id: assignment.id,
      assignmentMode: assignment.assignmentMode,
      status: assignment.status,
      assignedUserId: assignment.assignedUserId,
      recipientCount: assignment.recipients.length,
      submittedObservationCount: assignment.submittedMatchEvents.length,
      pendingObservationCount: assignment.submittedMatchEvents.filter((event) => event.status === 'PENDING').length,
      createdAt: assignment.createdAt,
      acceptedAt: assignment.acceptedAt,
      startedAt: assignment.startedAt,
      submittedAt: assignment.submittedAt,
      cancelledAt: assignment.cancelledAt,
    }))
    const activeAssignment = assignments.find((assignment) => activeAssignmentStatuses.includes(assignment.status as never)) ?? null
    return {
      id: task.id,
      title: task.title,
      scopeType: task.scopeType,
      targetLabel: task.scopeType === 'PLAYER' ? task.player ? `${task.player.firstName} ${task.player.surname}` : 'Selected player' : task.scopeType === 'UNIT' ? task.unitLabel ?? 'Selected unit' : 'Whole team',
      topicName: task.topic?.name ?? null,
      status: task.status,
      eventCount: task.events.length,
      assignments,
      activeAssignment: activeAssignment ? { id: activeAssignment.id, assignmentMode: activeAssignment.assignmentMode, status: activeAssignment.status, assignedUserId: activeAssignment.assignedUserId, recipientCount: activeAssignment.recipientCount } : null,
    }
  })
  const coverage = {
    totalTasks: tasks.length,
    assigned: tasks.filter((task) => task.activeAssignment).length,
    openGroupOffers: tasks.filter((task) => task.activeAssignment?.assignmentMode === 'GROUP_OFFER' && task.activeAssignment.status === 'OFFERED').length,
    awaitingResponse: tasks.filter((task) => task.activeAssignment?.status === 'PENDING').length,
    accepted: tasks.filter((task) => task.activeAssignment?.status === 'ACCEPTED').length,
    unassigned: tasks.filter((task) => !task.activeAssignment).length,
    draftTasks: tasks.filter((task) => task.status !== 'READY').length,
  }
  return { ok: true, value: { id: match.id, status: match.status, squadCount: match.matchDayPlayers.length, tasks, coverage } }
}

export async function getEligibleContributorsForTaskV2({ db = prisma, userId, trackingTaskId }: { db?: Db; userId: string; trackingTaskId: string }): Promise<MatchDayV2Result<Array<{ userId: string; label: string; detail: string; alreadyAssignedOnMatch: boolean }>>> {
  const task = await db.matchTrackingTask.findUnique({ where: { id: trackingTaskId }, select: { matchDayId: true, scopeType: true, playerId: true } })
  if (!task) return { ok: false, reason: 'Tracking task was not found.' }
  if (!(await userCanManageMatch(db, userId, task.matchDayId))) return { ok: false, reason: 'You cannot manage this tracking task.' }
  const eligible = await getEligibleMatchContributors({ db, matchDayId: task.matchDayId, scopeType: task.scopeType, playerId: task.playerId })
  if (!eligible.ok) return { ok: false, reason: eligible.reason }
  const activeAssignments = await db.matchContributorAssignment.findMany({ where: { trackingTask: { matchDayId: task.matchDayId }, assignedUserId: { in: eligible.value.map((contributor) => contributor.userId) }, status: { in: activeAssignmentStatuses } }, select: { assignedUserId: true } })
  const busyIds = new Set(activeAssignments.flatMap((assignment) => assignment.assignedUserId ? [assignment.assignedUserId] : []))
  return { ok: true, value: eligible.value.map((contributor, index) => ({
    userId: contributor.userId,
    label: contributor.userId === userId ? 'You' : contributor.kind === 'STAFF' ? `Staff contributor ${index + 1}` : `Linked spectator ${index + 1}`,
    detail: contributor.kind === 'STAFF' ? contributor.roles.join(', ') || 'Staff' : task.scopeType === 'PLAYER' ? 'Linked to this player' : 'Linked to this team',
    alreadyAssignedOnMatch: busyIds.has(contributor.userId),
  })) }
}

export async function assignMatchTrackingTaskV2({ db = prisma, userId, trackingTaskId, method, assignedUserId, recipientUserIds }: { db?: Db; userId: string; trackingTaskId: string; method: 'SELF' | 'DIRECT' | 'GROUP_OFFER' | 'LATER'; assignedUserId?: string | null; recipientUserIds?: string[] }): Promise<MatchDayV2Result<{ id: string | null; alreadyExisted: boolean }>> {
  if (method === 'LATER') return { ok: true, value: { id: null, alreadyExisted: false } }
  const before = await db.matchContributorAssignment.findFirst({ where: { trackingTaskId, status: { in: activeAssignmentStatuses } }, select: { id: true } })
  const result = method === 'SELF'
    ? await createSelfAssignment({ db, actorUserId: userId, trackingTaskId })
    : method === 'DIRECT'
      ? await createDirectAssignment({ db, actorUserId: userId, trackingTaskId, assignedUserId: assignedUserId ?? '' })
      : await createGroupOffer({ db, actorUserId: userId, trackingTaskId, recipientUserIds: recipientUserIds ?? [] })
  if (!result.ok) return { ok: false, reason: result.reason }
  return { ok: true, value: { id: result.value.id, alreadyExisted: before?.id === result.value.id } }
}

export async function cancelMatchTrackingAssignmentV2({ db = prisma, userId, assignmentId }: { db?: Db; userId: string; assignmentId: string }): Promise<MatchDayV2Result> {
  const assignment = await db.matchContributorAssignment.findUnique({ where: { id: assignmentId }, include: { submittedMatchEvents: { select: { id: true } }, trackingTask: { select: { matchDayId: true } } } })
  if (!assignment) return { ok: false, reason: 'Assignment was not found.' }
  if (!(await userCanManageMatch(db, userId, assignment.trackingTask.matchDayId))) return { ok: false, reason: 'You cannot manage this assignment.' }
  if (assignment.status === 'IN_PROGRESS' || assignment.status === 'SUBMITTED' || assignment.submittedMatchEvents.length > 0) return { ok: false, reason: 'Tracking has already started. Cancel or reassign from the Match Day management screen only after resolving the existing observations.' }
  const result = await cancelContributorAssignment({ db, actorUserId: userId, assignmentId })
  return result.ok ? { ok: true, value: true } : { ok: false, reason: result.reason }
}

export async function applyPlayerTrackingTaskToPlayersV2({ db = prisma, userId, sourceTaskId, playerIds }: { db?: Db; userId: string; sourceTaskId: string; playerIds: string[] }): Promise<MatchDayV2Result<{ ids: string[] }>> {
  const sourceTask = await db.matchTrackingTask.findUnique({ where: { id: sourceTaskId }, include: { events: { orderBy: { displayOrder: 'asc' } } } })
  if (!sourceTask) return { ok: false, reason: 'Source tracking task was not found.' }
  if (sourceTask.scopeType !== 'PLAYER') return { ok: false, reason: 'Only player tasks can be applied to more players.' }
  if (!(await userCanManageMatch(db, userId, sourceTask.matchDayId))) return { ok: false, reason: 'You cannot manage this tracking task.' }
  const destinationPlayerIds = Array.from(new Set(playerIds.filter(Boolean).filter((playerId) => playerId !== sourceTask.playerId)))
  if (destinationPlayerIds.length === 0) return { ok: false, reason: 'Select at least one additional player.' }
  const squadPlayers = await db.matchDayPlayer.findMany({ where: { matchDayId: sourceTask.matchDayId, playerId: { in: destinationPlayerIds }, squadStatus: { not: 'NOT_INVOLVED' } }, select: { playerId: true } })
  const validIds = new Set(squadPlayers.map((player) => player.playerId))
  const invalidPlayer = destinationPlayerIds.find((playerId) => !validIds.has(playerId))
  if (invalidPlayer) return { ok: false, reason: 'One or more selected players are no longer in the match squad.' }
  const created = await db.$transaction(async (tx) => {
    const tasks = [] as Array<{ id: string }>
    for (const playerId of destinationPlayerIds) {
      const task = await tx.matchTrackingTask.create({ data: { matchDayId: sourceTask.matchDayId, createdByUserId: userId, topicId: sourceTask.topicId, scopeType: 'PLAYER', playerId, title: sourceTask.title, instructions: sourceTask.instructions, sourceTaskId: sourceTask.id, status: 'READY' }, select: { id: true } })
      await tx.matchTrackingTaskEvent.createMany({ data: sourceTask.events.map((event, index) => ({ trackingTaskId: task.id, matchDayEventTypeId: event.matchDayEventTypeId, displayOrder: index })) })
      tasks.push(task)
    }
    return tasks
  })
  return { ok: true, value: { ids: created.map((task) => task.id) } }
}

export async function publishMatchDayV2Setup({ db = prisma, userId, matchDayId }: { db?: Db; userId: string; matchDayId: string }): Promise<MatchDayV2Result<{ warnings: string[]; coverage: { totalTasks: number; assigned: number; openGroupOffers: number; awaitingResponse: number; accepted: number; unassigned: number; draftTasks: number } }>> {
  const state = await getMatchDayV2SetupState({ db, userId, matchDayId })
  if (!state.ok) return state
  const match = await db.matchDay.findUnique({ where: { id: matchDayId }, select: { id: true, status: true, opposition: true, kickoffAt: true, teamId: true } })
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') return { ok: false, reason: 'Only draft Match Day setups can be published.' }
  if (!match.opposition.trim() || Number.isNaN(match.kickoffAt.getTime())) return { ok: false, reason: 'Match details are incomplete.' }
  if (state.value.squadCount === 0) return { ok: false, reason: 'Add at least one player to the match squad before publishing.' }
  const tasks = await db.matchTrackingTask.findMany({ where: { matchDayId, status: { not: 'ARCHIVED' } }, include: { events: true } })
  if (tasks.length === 0) return { ok: false, reason: 'Create at least one tracking task before publishing.' }
  const taskErrors = [] as string[]
  for (const task of tasks) {
    const ready = await validateTaskCanBeReady(db, task)
    if (task.status !== 'READY' || !ready.ok) taskErrors.push(`${task.title}: ${ready.ok ? 'Task is not ready.' : ready.reason}`)
  }
  if (taskErrors.length > 0) return { ok: false, reason: 'Some tracking tasks are incomplete.', fieldErrors: { tasks: taskErrors } }
  const warnings = [] as string[]
  if (state.value.coverage.unassigned > 0) warnings.push(`${state.value.coverage.unassigned} ready task${state.value.coverage.unassigned === 1 ? ' is' : 's are'} unassigned.`)
  if (state.value.coverage.awaitingResponse > 0) warnings.push(`${state.value.coverage.awaitingResponse} direct assignment${state.value.coverage.awaitingResponse === 1 ? ' is' : 's are'} awaiting response.`)
  if (state.value.coverage.openGroupOffers > 0) warnings.push(`${state.value.coverage.openGroupOffers} group offer${state.value.coverage.openGroupOffers === 1 ? ' is' : 's are'} still open.`)
  return { ok: true, value: { warnings, coverage: state.value.coverage } }
}
