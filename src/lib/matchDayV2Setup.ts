import type {
  MatchSquadStatus,
  MatchTrackingScope,
  TrackingFocusArea,
  TrackingTargetContext,
  TrackingTopicPhase,
} from '@prisma/client'

import { getMatchDayEventCategoryFallback } from '@/lib/eventDefinitions'
import {
  copyMatchTrackingTask,
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
