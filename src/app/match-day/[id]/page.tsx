import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import MatchControlClient from '@/app/match-day/[id]/MatchControlClient'
import MatchEventSetupClient from '@/app/match-day/[id]/MatchEventSetupClient'
import MatchEventsClient from '@/app/match-day/[id]/MatchEventsClient'
import MatchLiveDetailsButton from '@/app/match-day/[id]/MatchLiveDetailsButton'
import MatchPitchClient from '@/app/match-day/[id]/MatchPitchClient'
import ParentSubmissionsPanel from '@/app/match-day/[id]/ParentSubmissionsPanel'
import MatchSummaryReport from '@/app/match-day/[id]/MatchSummaryReport'
import MatchSquadClient from '@/app/match-day/[id]/MatchSquadClient'
import MatchTrackingFocusClient from '@/app/match-day/[id]/MatchTrackingFocusClient'
import TouchMap from '@/components/TouchMap'
import { getCurrentUser } from '@/lib/auth'
import { observationContributesToStandardReporting } from '@/lib/clubTrackingDefinitions'
import {
  getActiveRecordableEventDefinitions,
  getEventDisplayName,
  getMatchDayEventCategoryFallback,
} from '@/lib/eventDefinitions'
import {
  formatMatchEventType,
  isMatchEventType,
  matchEventTypes,
} from '@/lib/matchEventTaxonomy'
import {
  acceptSubmittedMatchEvent,
  getClubDefinitionSnapshotWarnings,
  getParentSubmissionEventDisplayName,
  getReviewIdentityLabel,
} from '@/lib/parentSubmissionEvents'
import { canManageMatchDay, canManageTeamData, canRunMatchDay, canViewMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { sendCompletedMatchReportEmail } from '@/lib/reportEmails'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import {
  buildMatchEventCsvRows,
  buildMatchPatternCsvRows,
  getMatchReportEventLabel,
  resolveMatchReportEvents,
  resolveMatchReportPatterns,
} from '@/lib/matchReportCsvRows'
import { cancelMatchTrackingAssignmentV2 } from '@/lib/matchDayV2Setup'
import { formatAssignmentStatus, getAssignmentStatusForMatch, getAssignmentTarget } from '@/lib/myAssignments'
import { notifySubmissionReviewed } from '@/lib/notifications'
import {
  aggregateClubEvents,
  aggregateClubPatterns,
  aggregateStandardEvents,
  buildMappingCoverage,
  getObservationIdentityLabel,
  getStandardReportingKey,
} from '@/lib/observationReporting'
import { reviewPatternObservation } from '@/lib/trackingPatterns'

export const dynamic = 'force-dynamic'

const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const
const pitchTargetStates = ['ON', 'OFF'] as const
const matchTypes = ['LEAGUE', 'CUP', 'FRIENDLY'] as const
const matchVenues = ['HOME', 'AWAY', 'NEUTRAL'] as const

type SquadActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getOptionalPitchCoordinate = (formData: FormData, key: string) => {
  const value = formData.get(key)
  if (value === null) return { ok: true as const, value: undefined }
  if (typeof value !== 'string') return { ok: false as const }

  const trimmedValue = value.trim()
  if (!trimmedValue) return { ok: true as const, value: undefined }

  const coordinate = Number(trimmedValue)
  if (!Number.isFinite(coordinate) || coordinate < 0 || coordinate > 100) {
    return { ok: false as const }
  }

  return { ok: true as const, value: coordinate }
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)
const formatTimeInput = (date: Date) => date.toTimeString().slice(0, 5)
const formatDateForFilename = (date: Date) => date.toISOString().slice(0, 10)
const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

const formatMatchType = (matchType: string) =>
  matchType.charAt(0) + matchType.slice(1).toLowerCase()

const formatVenue = (venue: string) =>
  venue.charAt(0) + venue.slice(1).toLowerCase()

const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

const formatSquadStatus = (status: string) => {
  if (status === 'STARTER') return 'Starter'
  if (status === 'SUBSTITUTE') return 'Substitute'
  return 'Not involved'
}

const formatHalfLabel = (half: string) =>
  half === 'FIRST_HALF' ? 'First half' : 'Second half'

const formatMatchTime = (matchSecond: number) => {
  const minutes = Math.floor(matchSecond / 60)
  const seconds = matchSecond % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getStatusClasses = (status: string) => {
  if (status === 'COMPLETED') return 'bg-green-100 text-green-800'
  if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800'
  if (status === 'HALF_TIME') return 'bg-amber-100 text-amber-900'
  return 'bg-gray-100 text-gray-700'
}

const getMatchHeadline = ({
  opposition,
  teamName,
  venue,
}: {
  opposition: string
  teamName: string
  venue: string
}) => {
  if (venue === 'AWAY') return `${opposition} vs ${teamName}`
  return `${teamName} vs ${opposition}`
}

const getSecondsBetween = (start: Date, end: Date) =>
  Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))

const getActiveHalf = (match: {
  status: string
  firstHalfStartedAt: Date | null
  firstHalfEndedAt: Date | null
  secondHalfStartedAt: Date | null
  secondHalfEndedAt: Date | null
}) => {
  if (match.status !== 'IN_PROGRESS') return null

  if (match.secondHalfStartedAt && !match.secondHalfEndedAt) {
    return {
      half: 'SECOND_HALF' as const,
      startedAt: match.secondHalfStartedAt,
    }
  }

  if (match.firstHalfStartedAt && !match.firstHalfEndedAt) {
    return {
      half: 'FIRST_HALF' as const,
      startedAt: match.firstHalfStartedAt,
    }
  }

  return null
}

const getMatchEventIdentity = (event: {
  id: string
  eventDefinitionId: string | null
  eventType: string | null
}) => event.eventDefinitionId ?? event.eventType ?? `unknown-event:${event.id}`

const getMatchEventLabel = getMatchReportEventLabel

const getSubmissionTargetLabel = (submission: {
  assignment?: { trackingTask: { scopeType: string; unitLabel: string | null; player: { firstName: string; surname: string } | null } } | null
}) => {
  const task = submission.assignment?.trackingTask
  if (!task) return 'Whole team'
  if (task.scopeType === 'PLAYER') return task.player ? `${task.player.firstName} ${task.player.surname}` : 'Selected player'
  if (task.scopeType === 'UNIT') return task.unitLabel ?? 'Selected unit'
  return 'Whole team'
}

const getStintDuration = (stint: { startedAt: Date; endedAt: Date | null }) => {
  const endedAt = stint.endedAt ?? new Date()
  return Math.max(0, endedAt.getTime() - stint.startedAt.getTime())
}

const getMatchElapsedMilliseconds = (match: {
  firstHalfStartedAt: Date | null
  firstHalfEndedAt: Date | null
  secondHalfStartedAt: Date | null
  secondHalfEndedAt: Date | null
  completedAt: Date | null
}) => {
  const now = new Date()
  const firstHalfElapsed = match.firstHalfStartedAt
    ? (match.firstHalfEndedAt ?? now).getTime() - match.firstHalfStartedAt.getTime()
    : 0
  const secondHalfElapsed = match.secondHalfStartedAt
    ? (match.secondHalfEndedAt ?? match.completedAt ?? now).getTime() -
      match.secondHalfStartedAt.getTime()
    : 0

  return Math.max(0, firstHalfElapsed) + Math.max(0, secondHalfElapsed)
}

async function getActionableMatch(matchDayId: string, permission: 'manage' | 'run') {
  const user = await getCurrentUser()
  const allowed = permission === 'manage'
    ? await canManageMatchDay(user.id, matchDayId)
    : await canRunMatchDay(user.id, matchDayId)

  if (!allowed) return null

  return prisma.matchDay.findFirst({
    where: {
      id: matchDayId,
    },
    include: {
      team: {
        include: {
          club: true,
        },
      },
    },
  })
}

async function updateDraftMatchDetails(formData: FormData): Promise<void> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const date = getTextValue(formData, 'date')
  const kickoffTime = getTextValue(formData, 'kickoffTime')
  const opposition = getTextValue(formData, 'opposition')
  const matchType = getTextValue(formData, 'matchType')
  const venue = getTextValue(formData, 'venue')

  if (!matchDayId || !date || !kickoffTime || !opposition || !matchType || !venue) {
    return
  }
  if (!matchTypes.includes(matchType as (typeof matchTypes)[number])) {
    return
  }
  if (!matchVenues.includes(venue as (typeof matchVenues)[number])) {
    return
  }

  const match = await getActionableMatch(matchDayId, 'manage')
  if (!match) return
  if (match.status !== 'DRAFT') {
    return
  }

  const kickoffAt = new Date(`${date}T${kickoffTime}:00`)
  if (Number.isNaN(kickoffAt.getTime())) {
    return
  }

  await prisma.matchDay.update({
    where: { id: match.id },
    data: {
      kickoffAt,
      opposition,
      matchType: matchType as (typeof matchTypes)[number],
      venue: venue as (typeof matchVenues)[number],
    },
  })

  revalidatePath(`/match-day/${match.id}`)
  revalidatePath('/match-day')
}

async function duplicateMatchDaySetup(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const sourceMatchDayId = getTextValue(formData, 'matchDayId')
  if (!sourceMatchDayId) redirect('/match-day')

  const sourceMatch = await prisma.matchDay.findUnique({
    where: { id: sourceMatchDayId },
    include: {
      team: {
        include: {
          club: true,
        },
      },
      matchDayEventTypes: {
        orderBy: { createdAt: 'asc' },
      },
      matchDayPlayers: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!sourceMatch) redirect('/match-day')
  if (!(await canManageMatchDay(user.id, sourceMatch.id))) redirect(`/match-day/${sourceMatch.id}`)
  if (!(await canManageTeamData(user.id, sourceMatch.teamId))) redirect(`/match-day/${sourceMatch.id}`)

  const copiedEventTypes = sourceMatch.matchDayEventTypes
    .filter((eventType) => eventType.eventDefinitionId || eventType.eventType)
    .map((eventType) => ({
      eventDefinitionId: eventType.eventDefinitionId,
      eventType: eventType.eventType,
      category: eventType.category,
    }))

  const copiedPlayers = sourceMatch.matchDayPlayers.map((player) => ({
    playerId: player.playerId,
    squadStatus: player.squadStatus,
    startingPosition: player.startingPosition,
    shirtNumberSnapshot: player.shirtNumberSnapshot,
    isTracked: player.isTracked,
  }))

  const newMatch = await prisma.matchDay.create({
    data: {
      teamId: sourceMatch.teamId,
      kickoffAt: sourceMatch.kickoffAt,
      opposition: sourceMatch.opposition,
      matchType: sourceMatch.matchType,
      venue: sourceMatch.venue,
      status: 'DRAFT',
      ownScore: 0,
      oppositionScore: 0,
      eventTrackingScope: sourceMatch.eventTrackingScope,
      trackPlayerMinutes: sourceMatch.trackPlayerMinutes,
      firstHalfStartedAt: null,
      firstHalfEndedAt: null,
      secondHalfStartedAt: null,
      secondHalfEndedAt: null,
      completedAt: null,
      matchDayEventTypes: {
        create: copiedEventTypes,
      },
      matchDayPlayers: {
        create: copiedPlayers,
      },
    },
    select: { id: true },
  })

  revalidatePath('/match-day')
  redirect(`/match-day/${newMatch.id}?setupCopied=1`)
}

async function setupMatchSquad(formData: FormData): Promise<SquadActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getActionableMatch(matchDayId, 'manage')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') {
    return { ok: false, reason: 'Squad can only be changed before the match starts.' }
  }
  if (!match.trackPlayerMinutes) {
    await prisma.matchDay.update({ where: { id: match.id }, data: { trackPlayerMinutes: true } })
  }

  const activePlayers = await prisma.player.findMany({
    where: {
      teamId: match.teamId,
      isActive: true,
    },
    select: {
      id: true,
      squadNumber: true,
    },
  })

  for (const player of activePlayers) {
    await prisma.matchDayPlayer.upsert({
      where: {
        matchDayId_playerId: {
          matchDayId: match.id,
          playerId: player.id,
        },
      },
      update: {},
      create: {
        matchDayId: match.id,
        playerId: player.id,
        squadStatus: 'NOT_INVOLVED',
        shirtNumberSnapshot: player.squadNumber,
      },
    })
  }

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function updateMatchSquadPlayer(
  formData: FormData
): Promise<SquadActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const playerId = getTextValue(formData, 'playerId')
  const squadStatus = getTextValue(formData, 'squadStatus')
  const startingPosition = getTextValue(formData, 'startingPosition')

  if (!matchDayId || !playerId || !squadStatus) {
    return { ok: false, reason: 'Match, player and squad status are required.' }
  }

  if (!squadStatuses.includes(squadStatus as (typeof squadStatuses)[number])) {
    return { ok: false, reason: 'Squad status is invalid.' }
  }

  const match = await getActionableMatch(matchDayId, 'manage')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') {
    return { ok: false, reason: 'Squad can only be changed before the match starts.' }
  }
  if (!match.trackPlayerMinutes) {
    await prisma.matchDay.update({ where: { id: match.id }, data: { trackPlayerMinutes: true } })
  }

  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      teamId: match.teamId,
      isActive: true,
    },
    select: {
      id: true,
      squadNumber: true,
    },
  })

  if (!player) {
    return { ok: false, reason: 'Player was not found for this match team.' }
  }

  const existingSquadPlayer = await prisma.matchDayPlayer.findUnique({
    where: {
      matchDayId_playerId: {
        matchDayId: match.id,
        playerId: player.id,
      },
    },
    select: {
      squadStatus: true,
      isTracked: true,
    },
  })
  const isTracked =
    squadStatus === 'NOT_INVOLVED'
      ? false
      : existingSquadPlayer?.squadStatus === 'NOT_INVOLVED' || !existingSquadPlayer
        ? true
        : existingSquadPlayer.isTracked

  await prisma.matchDayPlayer.upsert({
    where: {
      matchDayId_playerId: {
        matchDayId: match.id,
        playerId: player.id,
      },
    },
    update: {
      squadStatus: squadStatus as (typeof squadStatuses)[number],
      startingPosition: startingPosition || null,
      shirtNumberSnapshot: player.squadNumber,
      isTracked,
    },
    create: {
      matchDayId: match.id,
      playerId: player.id,
      squadStatus: squadStatus as (typeof squadStatuses)[number],
      startingPosition: startingPosition || null,
      shirtNumberSnapshot: player.squadNumber,
      isTracked,
    },
  })

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function updateMatchTrackingFocus(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const eventTrackingScope = getTextValue(formData, 'eventTrackingScope') === 'PLAYER' ? 'PLAYER' : 'TEAM'
  const trackedMatchDayPlayerIds = new Set(
    formData
      .getAll('trackedMatchDayPlayerId')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  )

  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getActionableMatch(matchDayId, 'manage')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') {
    return { ok: false, reason: 'Tracking focus can only be changed before the match starts.' }
  }

  if (!match.trackPlayerMinutes) {
    const trackedPlayerIds = new Set(
      formData
        .getAll('trackedPlayerId')
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
    const activePlayers = await prisma.player.findMany({ where: { teamId: match.teamId, isActive: true }, select: { id: true, squadNumber: true } })
    const validPlayerIds = new Set(activePlayers.map((player) => player.id))
    if ([...trackedPlayerIds].some((playerId) => !validPlayerIds.has(playerId))) return { ok: false, reason: 'One or more selected players are not active for this match team.' }
    if (eventTrackingScope === 'PLAYER' && trackedPlayerIds.size === 0) return { ok: false, reason: 'Select at least one player to track.' }
    await prisma.$transaction([
      prisma.matchDay.update({ where: { id: match.id }, data: { eventTrackingScope } }),
      prisma.matchDayPlayer.deleteMany({ where: { matchDayId: match.id } }),
      ...(eventTrackingScope === 'PLAYER'
        ? activePlayers.filter((player) => trackedPlayerIds.has(player.id)).map((player) => prisma.matchDayPlayer.create({ data: { matchDayId: match.id, playerId: player.id, squadStatus: 'NOT_INVOLVED', shirtNumberSnapshot: player.squadNumber, isTracked: true } }))
        : []),
    ])
    revalidatePath(`/match-day/${match.id}`)
    return { ok: true }
  }

  const squadPlayers = await prisma.matchDayPlayer.findMany({
    where: { matchDayId: match.id },
    select: { id: true, squadStatus: true },
  })

  await prisma.$transaction([
    prisma.matchDay.update({ where: { id: match.id }, data: { eventTrackingScope } }),
    ...squadPlayers.map((squadPlayer) =>
      prisma.matchDayPlayer.update({
        where: { id: squadPlayer.id },
        data: {
          isTracked:
            eventTrackingScope === 'PLAYER' &&
            squadPlayer.squadStatus !== 'NOT_INVOLVED' &&
            trackedMatchDayPlayerIds.has(squadPlayer.id),
        },
      })
    ),
  ])

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function updateMatchEventSetup(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const eventDefinitionIds = Array.from(new Set(
    formData
      .getAll('eventDefinitionId')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  ))

  if (!matchDayId) return { ok: false, reason: 'Missing match.' }
  if (eventDefinitionIds.length === 0) {
    return { ok: false, reason: 'Select at least one event to track for this match.' }
  }

  const match = await getActionableMatch(matchDayId, 'manage')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') {
    return { ok: false, reason: 'Event setup can only be changed before the match starts.' }
  }

  const eventDefinitions = await prisma.eventDefinition.findMany({
    where: {
      id: { in: eventDefinitionIds },
      isActive: true,
    },
  })
  if (eventDefinitions.length !== eventDefinitionIds.length) {
    return { ok: false, reason: 'One or more selected events are no longer available.' }
  }

  const eventDefinitionsById = new Map(eventDefinitions.map((eventDefinition) => [eventDefinition.id, eventDefinition]))
  const selectedEventDefinitions = eventDefinitionIds.map((eventDefinitionId) => eventDefinitionsById.get(eventDefinitionId))

  await prisma.$transaction([
    prisma.matchDayEventType.deleteMany({ where: { matchDayId: match.id } }),
    ...selectedEventDefinitions.map((eventDefinition) => {
      if (!eventDefinition) throw new Error('Event definition is invalid.')

      return prisma.matchDayEventType.create({
        data: {
          matchDayId: match.id,
          eventDefinitionId: eventDefinition.id,
          eventType: eventDefinition.legacyEventType ?? null,
          category: getMatchDayEventCategoryFallback(eventDefinition),
        },
      })
    }),
  ])

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function cancelCoachTrackingAssignment(formData: FormData): Promise<void> {
  'use server'

  if (!isMatchDayTrackingV2Enabled()) return
  const user = await getCurrentUser()
  const assignmentId = getTextValue(formData, 'assignmentId')
  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!assignmentId || !matchDayId) return
  await cancelMatchTrackingAssignmentV2({ userId: user.id, assignmentId })
  revalidatePath(`/match-day/${matchDayId}`)
  revalidatePath('/my-assignments')
  revalidatePath('/notifications')
}

async function startMatch(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed matches cannot be started.' }
  }
  if (match.status !== 'DRAFT' || match.firstHalfStartedAt) {
    return { ok: false, reason: 'This match cannot be started from its current state.' }
  }

  const now = new Date()
  const starters = await prisma.matchDayPlayer.findMany({
    where: {
      matchDayId: match.id,
      squadStatus: 'STARTER',
    },
  })
  const selectedEventCount = await prisma.matchDayEventType.count({
    where: { matchDayId: match.id },
  })
  if (selectedEventCount === 0) {
    return { ok: false, reason: 'Select at least one event to track for this match.' }
  }

  await prisma.$transaction([
    prisma.matchDay.update({
      where: { id: match.id },
      data: {
        status: 'IN_PROGRESS',
        firstHalfStartedAt: now,
      },
    }),
    ...(match.trackPlayerMinutes ? starters.map((starter) =>
      prisma.matchPlayerStint.create({
        data: {
          matchDayId: match.id,
          matchDayPlayerId: starter.id,
          playerId: starter.playerId,
          half: 'FIRST_HALF',
          startedAt: now,
          startMatchSecond: 0,
        },
      })
    ) : []),
  ])

  await sendCompletedMatchReportEmail(match.id)

  revalidatePath(`/match-day/${match.id}`)
  revalidatePath('/match-day')
  return { ok: true }
}

async function endFirstHalf(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed matches are read-only.' }
  }
  if (
    match.status !== 'IN_PROGRESS' ||
    !match.firstHalfStartedAt ||
    match.firstHalfEndedAt ||
    match.secondHalfStartedAt
  ) {
    return { ok: false, reason: 'This match is not in the first half.' }
  }

  const now = new Date()
  const endMatchSecond = getSecondsBetween(match.firstHalfStartedAt, now)

  await prisma.$transaction([
    prisma.matchDay.update({
      where: { id: match.id },
      data: {
        status: 'HALF_TIME',
        firstHalfEndedAt: now,
      },
    }),
    prisma.matchPlayerStint.updateMany({
      where: {
        matchDayId: match.id,
        half: 'FIRST_HALF',
        endedAt: null,
      },
      data: {
        endedAt: now,
        endMatchSecond,
      },
    }),
  ])

  revalidatePath(`/match-day/${match.id}`)
  revalidatePath('/match-day')
  return { ok: true }
}

async function startSecondHalf(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed matches are read-only.' }
  }
  if (
    match.status !== 'HALF_TIME' ||
    !match.firstHalfEndedAt ||
    match.secondHalfStartedAt
  ) {
    return { ok: false, reason: 'This match cannot start the second half yet.' }
  }

  const now = new Date()
  const playersOnAtHalfTime = await prisma.matchPlayerStint.findMany({
    where: {
      matchDayId: match.id,
      half: 'FIRST_HALF',
      endedAt: match.firstHalfEndedAt,
    },
    select: {
      matchDayPlayerId: true,
      playerId: true,
    },
  })

  await prisma.$transaction([
    prisma.matchDay.update({
      where: { id: match.id },
      data: {
        status: 'IN_PROGRESS',
        secondHalfStartedAt: now,
      },
    }),
    ...playersOnAtHalfTime.map((stint) =>
      prisma.matchPlayerStint.create({
        data: {
          matchDayId: match.id,
          matchDayPlayerId: stint.matchDayPlayerId,
          playerId: stint.playerId,
          half: 'SECOND_HALF',
          startedAt: now,
          startMatchSecond: 0,
        },
      })
    ),
  ])

  revalidatePath(`/match-day/${match.id}`)
  revalidatePath('/match-day')
  return { ok: true }
}

async function completeMatch(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'This match is already completed.' }
  }
  if (
    match.status !== 'IN_PROGRESS' ||
    !match.secondHalfStartedAt ||
    match.secondHalfEndedAt
  ) {
    return { ok: false, reason: 'This match is not in the second half.' }
  }

  const now = new Date()
  const endMatchSecond = getSecondsBetween(match.secondHalfStartedAt, now)
  await prisma.$transaction([
    prisma.matchDay.update({
      where: { id: match.id },
      data: {
        status: 'COMPLETED',
        secondHalfEndedAt: now,
        completedAt: now,
      },
    }),
    prisma.matchPlayerStint.updateMany({
      where: {
        matchDayId: match.id,
        half: 'SECOND_HALF',
        endedAt: null,
      },
      data: {
        endedAt: now,
        endMatchSecond,
      },
    }),
  ])

  revalidatePath(`/match-day/${match.id}`)
  revalidatePath('/match-day')
  return { ok: true }
}

async function updateMatchScore(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const ownScoreValue = getTextValue(formData, 'ownScore')
  const oppositionScoreValue = getTextValue(formData, 'oppositionScore')

  if (!matchDayId || !ownScoreValue || !oppositionScoreValue) {
    return { ok: false, reason: 'Match and score values are required.' }
  }

  const ownScore = Number(ownScoreValue)
  const oppositionScore = Number(oppositionScoreValue)
  if (
    !Number.isInteger(ownScore) ||
    !Number.isInteger(oppositionScore) ||
    ownScore < 0 ||
    oppositionScore < 0
  ) {
    return { ok: false, reason: 'Scores must be whole numbers and cannot be negative.' }
  }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'IN_PROGRESS') {
    return { ok: false, reason: 'Goals can only be added or undone during live play.' }
  }

  await prisma.matchDay.update({
    where: { id: match.id },
    data: {
      ownScore,
      oppositionScore,
    },
  })

  revalidatePath(`/match-day/${match.id}`)
  revalidatePath('/match-day')
  return { ok: true }
}

async function togglePlayerOnPitch(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const matchDayPlayerId = getTextValue(formData, 'matchDayPlayerId')
  const targetState = getTextValue(formData, 'targetState')

  if (!matchDayId || !matchDayPlayerId || !targetState) {
    return { ok: false, reason: 'Match, player and target state are required.' }
  }

  if (!pitchTargetStates.includes(targetState as (typeof pitchTargetStates)[number])) {
    return { ok: false, reason: 'On-pitch target state is invalid.' }
  }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed matches are read-only.' }
  }

  const activeHalf = getActiveHalf(match)
  if (!activeHalf) {
    return { ok: false, reason: 'Players can only be toggled during live match play.' }
  }

  const squadPlayer = await prisma.matchDayPlayer.findFirst({
    where: {
      id: matchDayPlayerId,
      matchDayId: match.id,
      matchDay: {
        teamId: match.teamId,
      },
    },
  })

  if (!squadPlayer) {
    return { ok: false, reason: 'Player is not in this match squad.' }
  }

  if (squadPlayer.squadStatus === 'NOT_INVOLVED') {
    return { ok: false, reason: 'Not involved players cannot be toggled on.' }
  }

  const openStint = await prisma.matchPlayerStint.findFirst({
    where: {
      matchDayId: match.id,
      matchDayPlayerId: squadPlayer.id,
      endedAt: null,
    },
  })

  const now = new Date()
  const matchSecond = getSecondsBetween(activeHalf.startedAt, now)

  if (targetState === 'ON') {
    if (openStint) {
      return { ok: false, reason: 'Player is already on the pitch.' }
    }

    await prisma.matchPlayerStint.create({
      data: {
        matchDayId: match.id,
        matchDayPlayerId: squadPlayer.id,
        playerId: squadPlayer.playerId,
        half: activeHalf.half,
        startedAt: now,
        startMatchSecond: matchSecond,
      },
    })
  } else {
    if (!openStint) {
      return { ok: false, reason: 'Player is already off the pitch.' }
    }

    await prisma.matchPlayerStint.update({
      where: { id: openStint.id },
      data: {
        endedAt: now,
        endMatchSecond: matchSecond,
      },
    })
  }

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function recordMatchEvent(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const matchDayPlayerId = getTextValue(formData, 'matchDayPlayerId')
  const eventDefinitionId = getTextValue(formData, 'eventDefinitionId')
  const eventType = getTextValue(formData, 'eventType')
  const x = getOptionalPitchCoordinate(formData, 'x')
  const y = getOptionalPitchCoordinate(formData, 'y')

  if (!matchDayId || (!eventDefinitionId && !eventType)) {
    return { ok: false, reason: 'Match and event are required.' }
  }

  if (!x.ok || !y.ok) {
    return { ok: false, reason: 'Event location must be a number between 0 and 100.' }
  }

  if (eventType && !isMatchEventType(eventType)) {
    return { ok: false, reason: 'Event type is invalid.' }
  }
  const legacyEventType = eventType && isMatchEventType(eventType) ? eventType : null

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'IN_PROGRESS') {
    return { ok: false, reason: 'Events can only be recorded during live match play.' }
  }

  const selectedEvent = eventDefinitionId
    ? await prisma.matchDayEventType.findFirst({
        where: {
          matchDayId: match.id,
          eventDefinitionId,
        },
        include: { eventDefinition: true },
      })
    : await prisma.matchDayEventType.findFirst({
        where: {
          matchDayId: match.id,
          eventType: legacyEventType,
        },
        include: { eventDefinition: true },
      })

  if (!selectedEvent) {
    return { ok: false, reason: 'This event was not selected for this match.' }
  }

  if (!selectedEvent.eventDefinitionId && !selectedEvent.eventType) {
    return { ok: false, reason: 'Selected event is not recordable.' }
  }

  const requiresLocation = selectedEvent.eventDefinition?.requiresLocation ?? false
  if (requiresLocation && (x.value === undefined || y.value === undefined)) {
    return { ok: false, reason: 'Event location is required.' }
  }

  const activeHalf = getActiveHalf(match)
  if (!activeHalf) {
    return { ok: false, reason: 'No half timer is currently running.' }
  }

  const squadPlayer = matchDayPlayerId ? await prisma.matchDayPlayer.findFirst({
    where: match.trackPlayerMinutes ? {
      id: matchDayPlayerId,
      matchDayId: match.id,
      matchDay: { teamId: match.teamId },
      squadStatus: { not: 'NOT_INVOLVED' },
      isTracked: true,
    } : {
      id: matchDayPlayerId,
      matchDayId: match.id,
      matchDay: { teamId: match.teamId },
      isTracked: true,
    },
  }) : null

  if (match.eventTrackingScope === 'TEAM') {
    if (matchDayPlayerId) return { ok: false, reason: 'Team event tracking does not accept a player target.' }
  } else if (match.trackPlayerMinutes) {
    if (!squadPlayer) return { ok: false, reason: 'Player is not available for event tracking in this match.' }
    const openStint = await prisma.matchPlayerStint.findFirst({
      where: {
        matchDayId: match.id,
        matchDayPlayerId: squadPlayer.id,
        endedAt: null,
      },
    })
    if (!openStint) return { ok: false, reason: 'Events can only be recorded for players on the pitch.' }
  } else {
    if (!matchDayPlayerId) return { ok: false, reason: 'Select a player for player event tracking.' }
    if (!squadPlayer) return { ok: false, reason: 'Player is not available for event tracking in this match.' }
  }

  const now = new Date()
  const matchSecond = getSecondsBetween(activeHalf.startedAt, now)

  await prisma.matchEvent.create({
    data: {
      matchDayId: match.id,
      playerId: squadPlayer?.playerId ?? null,
      eventDefinitionId: selectedEvent.eventDefinitionId,
      // Temporary fallback for older UI paths until all clients submit eventDefinitionId.
      eventType: selectedEvent.eventDefinition?.legacyEventType ?? selectedEvent.eventType ?? null,
      half: activeHalf.half,
      matchSecond,
      ownScoreAtTime: match.ownScore,
      oppositionScoreAtTime: match.oppositionScore,
      ...(requiresLocation ? { x: x.value, y: y.value } : {}),
    },
  })

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function deleteMatchEvent(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const matchEventId = getTextValue(formData, 'matchEventId')

  if (!matchDayId || !matchEventId) {
    return { ok: false, reason: 'Match and event are required.' }
  }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed match events are read-only.' }
  }

  const event = await prisma.matchEvent.findFirst({
    where: {
      id: matchEventId,
      matchDayId: match.id,
    },
    select: { id: true },
  })

  if (!event) return { ok: false, reason: 'Event was not found.' }

  await prisma.matchEvent.delete({ where: { id: event.id } })

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function acceptParentSubmission(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const user = await getCurrentUser()
  const matchDayId = getTextValue(formData, 'matchDayId')
  const submittedMatchEventId = getTextValue(formData, 'submittedMatchEventId')

  if (!matchDayId || !submittedMatchEventId) {
    return { ok: false, reason: 'Match and parent submission are required.' }
  }

  if (!(await canRunMatchDay(user.id, matchDayId))) {
    return { ok: false, reason: 'You cannot review parent submissions for this match.' }
  }

  const result = await acceptSubmittedMatchEvent({ actorUserId: user.id, matchDayId, submittedMatchEventId })
  if (result.ok && !result.alreadyAccepted && isMatchDayTrackingV2Enabled()) await notifySubmissionReviewed(prisma, submittedMatchEventId)

  revalidatePath(`/match-day/${matchDayId}`)
  return result.ok ? { ok: true } : { ok: false, reason: result.message }
}

async function ignoreParentSubmission(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const user = await getCurrentUser()
  const matchDayId = getTextValue(formData, 'matchDayId')
  const submittedMatchEventId = getTextValue(formData, 'submittedMatchEventId')

  if (!matchDayId || !submittedMatchEventId) {
    return { ok: false, reason: 'Match and parent submission are required.' }
  }

  if (!(await canRunMatchDay(user.id, matchDayId))) {
    return { ok: false, reason: 'You cannot review parent submissions for this match.' }
  }

  const result = await prisma.$transaction(async (tx) => {
    const submission = await tx.submittedMatchEvent.findFirst({
      where: {
        id: submittedMatchEventId,
        matchDayId,
      },
      include: {
        matchDay: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!submission) return { ok: false, reason: 'Parent submission was not found.' } satisfies MatchActionResult
    if (submission.status !== 'PENDING') {
      return { ok: false, reason: 'This submission has already been reviewed.' } satisfies MatchActionResult
    }
    if (submission.matchDay.status === 'DRAFT') {
      return { ok: false, reason: 'Draft matches cannot review parent submissions.' } satisfies MatchActionResult
    }

    const reviewedSubmission = await tx.submittedMatchEvent.updateMany({
      where: {
        id: submission.id,
        status: 'PENDING',
      },
      data: {
        status: 'IGNORED',
        acceptedAt: new Date(),
        acceptedByUserId: user.id,
      },
    })

    if (reviewedSubmission.count !== 1) {
      return { ok: false, reason: 'This submission has already been reviewed.' } satisfies MatchActionResult
    }

    if (isMatchDayTrackingV2Enabled()) await notifySubmissionReviewed(tx, submission.id)

    return { ok: true } satisfies MatchActionResult
  })

  revalidatePath(`/match-day/${matchDayId}`)
  return result
}

async function reviewPatternSubmission(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const user = await getCurrentUser()
  const matchDayId = getTextValue(formData, 'matchDayId')
  const observationId = getTextValue(formData, 'submittedPatternObservationId')
  const decision = getTextValue(formData, 'decision') === 'IGNORED' ? 'IGNORED' : 'ACCEPTED'
  if (!matchDayId || !observationId) return { ok: false, reason: 'Match and pattern observation are required.' }
  const result = await reviewPatternObservation({ actorUserId: user.id, observationId, decision })
  revalidatePath(`/match-day/${matchDayId}`)
  return result.ok ? { ok: true } : { ok: false, reason: result.reason }
}

export default async function MatchDayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ setupCopied?: string }>
}) {
  const { id } = await params
  const { setupCopied } = await searchParams
  const user = await getCurrentUser()
  if (!(await canViewMatchDay(user.id, id))) notFound()
  const canManageThisMatch = await canManageMatchDay(user.id, id)
  const canReviewParentSubmissions = await canRunMatchDay(user.id, id)

  const match = await prisma.matchDay.findFirst({
    where: {
      id,
    },
    include: {
      team: {
        include: {
          club: true,
          players: {
            where: { isActive: true },
            orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
          },
        },
      },
      matchDayPlayers: {
        include: {
          player: true,
          stints: true,
        },
      },
      matchEvents: {
        include: {
          player: true,
          eventDefinition: true,
          clubTrackingDefinition: true,
          standardEventDefinitionAtRecording: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      patternObservations: {
        include: { pattern: { include: { outcomes: true } }, outcome: true, player: true, clubTrackingDefinition: true, standardPatternDefinitionAtRecording: true, trackingTask: { include: { topic: true } } },
        orderBy: { createdAt: 'asc' },
      },
      matchDayEventTypes: {
        include: {
          eventDefinition: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      submittedMatchEvents: {
        include: {
          player: {
            select: {
              id: true,
              firstName: true,
              surname: true,
              squadNumber: true,
            },
          },
          submittedBy: {
            select: {
              id: true,
              email: true,
            },
          },
          acceptedBy: {
            select: {
              id: true,
              email: true,
            },
          },
          eventDefinition: true,
          clubTrackingDefinition: { include: { mappedEventDefinition: true } },
          standardEventDefinitionAtRecording: true,
          assignment: {
            select: {
              trackingTask: {
                select: { scopeType: true, unitLabel: true, player: { select: { firstName: true, surname: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      submittedPatterns: {
        include: {
          player: { select: { id: true, firstName: true, surname: true, squadNumber: true } },
          submittedBy: { select: { id: true, email: true } },
          reviewedBy: { select: { id: true, email: true } },
          pattern: true,
          clubTrackingDefinition: { include: { mappedPatternDefinition: true } },
          standardPatternDefinitionAtRecording: true,
          outcome: true,
          trackingTask: { select: { scopeType: true, unitLabel: true, player: { select: { firstName: true, surname: true } } } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
    },
  })

  if (!match) notFound()

  const setupEventOptions = await getActiveRecordableEventDefinitions({
    legacyOnly: false,
    clubId: match.team.clubId,
  })
  const setupEventOptionsById = new Map(
    setupEventOptions.map((eventOption) => [eventOption.id, eventOption])
  )
  const setupEventDefinitionIdsByLegacyType = new Map(
    setupEventOptions.flatMap((eventOption) =>
      eventOption.legacyEventType ? [[eventOption.legacyEventType, eventOption.id] as const] : []
    )
  )
  const setupEventCategoryOptions = Array.from(
    setupEventOptions.reduce((categoryMap, eventOption) => {
      categoryMap.set(eventOption.category, eventOption.categoryLabel)
      return categoryMap
    }, new Map<string, string>())
  ).map(([value, label]) => ({ value, label }))

  const matchTypeLabel = formatMatchType(match.matchType)
  const venueLabel = formatVenue(match.venue)
  const statusLabel = formatStatus(match.status)
  const headline = getMatchHeadline({
    opposition: match.opposition,
    teamName: match.team.name,
    venue: match.venue,
  })
  const squadRecordsByPlayerId = new Map(
    match.matchDayPlayers.map((squadRecord) => [squadRecord.playerId, squadRecord])
  )
  const squadPlayers = match.team.players.map((player) => {
    const squadRecord = squadRecordsByPlayerId.get(player.id)

    return {
      id: player.id,
      firstName: player.firstName,
      surname: player.surname,
      squadNumber: player.squadNumber,
      preferredPosition: player.preferredPosition,
      squadStatus: squadRecord?.squadStatus ?? 'NOT_INVOLVED',
      startingPosition: squadRecord?.startingPosition ?? '',
      isTracked: squadRecord?.isTracked ?? true,
      matchDayPlayerId: squadRecord?.id ?? null,
      hasSquadRecord: Boolean(squadRecord),
    }
  })
  const trackingPlayers = match.matchDayPlayers
    .filter((squadPlayer) => match.trackPlayerMinutes ? squadPlayer.squadStatus !== 'NOT_INVOLVED' : squadPlayer.isTracked)
    .map((squadPlayer) => ({
      matchDayPlayerId: squadPlayer.id,
      playerId: squadPlayer.playerId,
      firstName: squadPlayer.player.firstName,
      surname: squadPlayer.player.surname,
      squadNumber: squadPlayer.shirtNumberSnapshot ?? squadPlayer.player.squadNumber,
      squadStatus: (squadPlayer.squadStatus === 'SUBSTITUTE' ? 'SUBSTITUTE' : 'STARTER') as 'STARTER' | 'SUBSTITUTE',
      isTracked: squadPlayer.isTracked,
    }))
  const matchElapsedMilliseconds = getMatchElapsedMilliseconds(match)
  const pitchPlayers = match.matchDayPlayers
    .filter((squadPlayer) => squadPlayer.squadStatus !== 'NOT_INVOLVED')
    .map((squadPlayer) => {
      const openStint = squadPlayer.stints.find((stint) => !stint.endedAt)
      const totalMilliseconds = squadPlayer.stints.reduce(
        (total, stint) => (stint.endedAt ? total + getStintDuration(stint) : total),
        0
      )

      return {
        matchDayPlayerId: squadPlayer.id,
        playerId: squadPlayer.playerId,
        firstName: squadPlayer.player.firstName,
        surname: squadPlayer.player.surname,
        squadNumber: squadPlayer.shirtNumberSnapshot ?? squadPlayer.player.squadNumber,
        squadStatus: squadPlayer.squadStatus as 'STARTER' | 'SUBSTITUTE',
        isTracked: squadPlayer.isTracked,
        isOnPitch: Boolean(openStint),
        openStintStartedAt: openStint?.startedAt.toISOString() ?? null,
        totalMilliseconds,
      }
    })
  const eventPlayers = match.eventTrackingScope === 'TEAM'
    ? []
    : match.trackPlayerMinutes
      ? pitchPlayers
          .filter((player) => player.isOnPitch && player.isTracked)
          .map((player) => ({
            matchDayPlayerId: player.matchDayPlayerId,
            playerId: player.playerId,
            firstName: player.firstName,
            surname: player.surname,
            squadNumber: player.squadNumber,
          }))
      : match.matchDayPlayers
          .filter((player) => player.isTracked)
          .map((squadPlayer) => ({
            matchDayPlayerId: squadPlayer.id,
            playerId: squadPlayer.playerId,
            firstName: squadPlayer.player.firstName,
            surname: squadPlayer.player.surname,
            squadNumber: squadPlayer.shirtNumberSnapshot ?? squadPlayer.player.squadNumber,
          }))
  const recentEvents = match.matchEvents.map((event) => ({
      id: event.id,
      label: getMatchEventLabel(event),
      half: event.half,
      matchSecond: event.matchSecond,
      ownScoreAtTime: event.ownScoreAtTime,
      oppositionScoreAtTime: event.oppositionScoreAtTime,
      playerName: event.player
        ? `${event.player.firstName} ${event.player.surname}`
        : 'Whole team',
    }))
  const recentEventsForRecording = [...recentEvents]
    .sort((firstEvent, secondEvent) => secondEvent.matchSecond - firstEvent.matchSecond)
    .slice(0, 20)
  const selectedEventOptions = match.matchDayEventTypes.length > 0
    ? match.matchDayEventTypes.flatMap((selectedEventType) => {
        if (!selectedEventType.eventDefinitionId && !selectedEventType.eventType) return []
        const eventDefinition = selectedEventType.eventDefinition
        const setupEventOption = selectedEventType.eventDefinitionId
          ? setupEventOptionsById.get(selectedEventType.eventDefinitionId)
          : null

        return [{
          matchDayEventTypeId: selectedEventType.id,
          eventDefinitionId: selectedEventType.eventDefinitionId,
          legacyEventType: eventDefinition?.legacyEventType ?? selectedEventType.eventType,
          label: getEventDisplayName(selectedEventType),
          category: eventDefinition?.category ?? selectedEventType.category,
          categoryLabel: setupEventOption?.categoryLabel ?? formatStatus(eventDefinition?.category ?? selectedEventType.category),
          subcategory: eventDefinition?.subcategory ?? null,
          description: eventDefinition?.description ?? null,
          videoUrl: eventDefinition?.videoUrl ?? null,
          requiresLocation: eventDefinition?.requiresLocation ?? false,
          isActive: eventDefinition?.isActive ?? true,
        }]
      })
    : []
  const selectedEventCategoryOptions = Array.from(
    selectedEventOptions.reduce((categoryMap, eventOption) => {
      categoryMap.set(eventOption.category, eventOption.categoryLabel)
      return categoryMap
    }, new Map<string, string>())
  ).map(([value, label]) => ({ value, label }))
  const selectedEventLabels = Array.from(
    new Set(selectedEventOptions.map((eventOption) => eventOption.label))
  ).sort((firstLabel, secondLabel) => firstLabel.localeCompare(secondLabel))
  const eventLabelsByKey = new Map<string, string>()
  const resolvedMatchEvents = resolveMatchReportEvents(match.matchEvents)
  const resolvedPatternObservations = resolveMatchReportPatterns(match.patternObservations)
  const standardReportEvents = resolvedMatchEvents.filter((event) => event.reportingIdentity.contributesToStandardReporting)
  const standardPatternObservations = resolvedPatternObservations.filter((observation) => observation.reportingIdentity.contributesToStandardReporting)
  const standardEventAggregates = aggregateStandardEvents(resolvedMatchEvents)
  const clubEventAggregates = aggregateClubEvents(resolvedMatchEvents)
  const clubPatternAggregates = aggregateClubPatterns(resolvedPatternObservations)
  const mappingCoverageRows = buildMappingCoverage([
    ...resolvedMatchEvents.map((event) => event.reportingIdentity),
    ...resolvedPatternObservations.map((observation) => observation.reportingIdentity),
  ])
  for (const event of resolvedMatchEvents) {
    const standardKey = getStandardReportingKey(event.reportingIdentity)
    if (standardKey && event.reportingIdentity.standardIdentity) eventLabelsByKey.set(standardKey, event.reportingIdentity.standardIdentity.label)
    eventLabelsByKey.set(getMatchEventIdentity(event), getMatchEventLabel(event))
  }

  for (const eventOption of selectedEventOptions) {
    const eventOptionKey = eventOption.eventDefinitionId
      ?? eventOption.legacyEventType
      ?? eventOption.matchDayEventTypeId
      ?? 'unknown-event'
    if (!eventLabelsByKey.has(eventOptionKey)) eventLabelsByKey.set(eventOptionKey, eventOption.label)
    if (eventOption.eventDefinitionId && !eventLabelsByKey.has(`standard-event:${eventOption.eventDefinitionId}`)) {
      eventLabelsByKey.set(`standard-event:${eventOption.eventDefinitionId}`, eventOption.label)
    }
  }

  const selectedEventDefinitionIdsForSetup = Array.from(new Set(match.matchDayEventTypes.flatMap((selectedEventType) => {
    if (selectedEventType.eventDefinitionId) return [selectedEventType.eventDefinitionId]
    if (selectedEventType.eventType) return setupEventDefinitionIdsByLegacyType.get(selectedEventType.eventType) ? [setupEventDefinitionIdsByLegacyType.get(selectedEventType.eventType)!] : []
    return []
  })))
  const minutesRows = pitchPlayers
    .map((player) => ({
      playerId: player.playerId,
      playerName: `${player.firstName} ${player.surname}`,
      squadNumber: player.squadNumber,
      minutesPlayed: Math.round(player.totalMilliseconds / 60000),
    }))
    .sort((firstPlayer, secondPlayer) => secondPlayer.minutesPlayed - firstPlayer.minutesPlayed)
  const teamEventTotalMap = new Map<string, number>()
  for (const event of standardEventAggregates) {
    teamEventTotalMap.set(event.key, event.count)
    eventLabelsByKey.set(event.key, event.label)
  }
  const teamEventTotals = Array.from(teamEventTotalMap.entries()).map(([eventKey, count]) => ({
    key: eventKey,
    label: eventLabelsByKey.get(eventKey) ?? 'Unknown event',
    count,
  }))
  const playerEventCountMap = new Map<
    string,
    { playerId: string; playerName: string; eventCounts: Map<string, number> }
  >()

  for (const event of standardReportEvents) {
    if (!event.playerId) continue
    const playerId = event.playerId
    const playerName = event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Unknown player'
    const eventCountKey = getStandardReportingKey(event.reportingIdentity)
    if (!eventCountKey) continue
    const currentRow = playerEventCountMap.get(playerId) ?? {
      playerId,
      playerName,
      eventCounts: new Map<string, number>(),
    }

    currentRow.eventCounts.set(
      eventCountKey,
      (currentRow.eventCounts.get(eventCountKey) ?? 0) + 1
    )
    playerEventCountMap.set(playerId, currentRow)
  }

  const playerEventCounts = Array.from(playerEventCountMap.values())
    .map((row) => {
      const eventCounts = Array.from(row.eventCounts.entries()).map(([eventKey, count]) => ({
        key: eventKey,
        label: eventLabelsByKey.get(eventKey) ?? (isMatchEventType(eventKey) ? formatMatchEventType(eventKey) : 'Unknown event'),
        count,
      }))

      return {
        playerId: row.playerId,
        playerName: row.playerName,
        total: eventCounts.reduce((total, eventCount) => total + eventCount.count, 0),
        eventCounts,
      }
    })
    .sort((firstPlayer, secondPlayer) => secondPlayer.total - firstPlayer.total)
  const getPlayerEventCount = (playerId: string, eventType: (typeof matchEventTypes)[number]) => {
    const eventCounts = playerEventCountMap.get(playerId)?.eventCounts
    if (!eventCounts) return 0
    const standardEventDefinitionId = setupEventDefinitionIdsByLegacyType.get(eventType)
    return eventCounts.get(standardEventDefinitionId ? `standard-event:${standardEventDefinitionId}` : `standard-event:${eventType}`) ?? eventCounts.get(eventType) ?? 0
  }
  const summaryCsvRows = pitchPlayers.map((player) => {
    const playerEventCounts = playerEventCountMap.get(player.playerId)?.eventCounts
    const totalEvents = playerEventCounts
      ? Array.from(playerEventCounts.values()).reduce((total, count) => total + count, 0)
      : 0

    return {
      playerName: `${player.firstName} ${player.surname}`,
      squadNumber: player.squadNumber,
      squadStatus: formatSquadStatus(player.squadStatus),
      trackedForEvents: player.isTracked,
      minutesPlayed: Math.round(player.totalMilliseconds / 60000),
      totalEvents,
      goals: getPlayerEventCount(player.playerId, 'GOAL'),
      assists: getPlayerEventCount(player.playerId, 'ASSIST'),
      shotsOnTarget: getPlayerEventCount(player.playerId, 'SHOT_ON_TARGET'),
      shotsOffTarget: getPlayerEventCount(player.playerId, 'SHOT_OFF_TARGET'),
      passComplete: getPlayerEventCount(player.playerId, 'PASS_COMPLETE'),
      passIncomplete: getPlayerEventCount(player.playerId, 'PASS_INCOMPLETE'),
      oneVOneSuccess: getPlayerEventCount(player.playerId, 'ONE_V_ONE_SUCCESS'),
      oneVOneUnsuccessful: getPlayerEventCount(player.playerId, 'ONE_V_ONE_UNSUCCESSFUL'),
    }
  })
  const mostInvolvedPlayers = playerEventCounts.slice(0, 3)
  const timelineEvents = resolvedMatchEvents.map((event) => ({
    id: event.id,
    label: getMatchEventLabel(event),
    secondaryLabel: event.reportingIdentity.clubIdentity && event.reportingIdentity.standardIdentity
      ? `${getObservationIdentityLabel(event.reportingIdentity.identityType)} · Recorded standard: ${event.reportingIdentity.standardIdentity.label}`
      : event.reportingIdentity.clubIdentity ? getObservationIdentityLabel(event.reportingIdentity.identityType) : null,
    half: event.half,
    matchSecond: event.matchSecond,
    playerName: event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Whole team',
    score: `${event.ownScoreAtTime}-${event.oppositionScoreAtTime}`,
  }))
  const finalScore = `${match.ownScore}-${match.oppositionScore}`
  const csvMetadata = {
    match: headline,
    dateLabel: formatDate(match.kickoffAt),
    dateForFilename: formatDateForFilename(match.kickoffAt),
    teamName: match.team.name,
    opposition: match.opposition,
    venue: venueLabel,
    matchType: matchTypeLabel,
    finalScore,
  }
  const eventCsvRows = buildMatchEventCsvRows(resolvedMatchEvents)
  const patternCsvRows = buildMatchPatternCsvRows(resolvedPatternObservations)
  const standardPatternCsvRows = buildMatchPatternCsvRows(standardPatternObservations)
  const showClubTrackingReports = isMatchDayTrackingV2Enabled()
  const touchMapEvents = resolvedMatchEvents
    .filter((event) => typeof event.x === 'number' && typeof event.y === 'number' && ((event.eventDefinition?.requiresLocation ?? false) || event.eventType === 'TOUCH' || (showClubTrackingReports && event.clubTrackingDefinitionId)))
    .map((event) => ({
      id: event.id,
      x: event.x,
      y: event.y,
      playerName: event.player
        ? `${event.player.firstName} ${event.player.surname}`
      : 'Whole team',
      half: formatHalfLabel(event.half),
      minute: Math.floor(event.matchSecond / 60),
      label: getMatchEventLabel(event),
      identities: showClubTrackingReports ? [
        event.reportingIdentity.standardIdentity?.type === 'EVENT' ? { type: 'STANDARD_EVENT' as const, eventDefinitionId: event.reportingIdentity.standardIdentity.id, label: event.reportingIdentity.standardIdentity.label } : null,
        event.reportingIdentity.clubIdentity ? { type: 'CLUB_DEFINITION' as const, clubTrackingDefinitionId: event.reportingIdentity.clubIdentity.id, label: event.reportingIdentity.clubIdentity.label } : null,
      ].filter((identity): identity is NonNullable<typeof identity> => Boolean(identity)) : undefined,
    }))
  const parentSubmissionRows = match.submittedMatchEvents.map((submission) => {
    const identityLabel = getReviewIdentityLabel({ clubTrackingDefinitionId: submission.clubTrackingDefinitionId, clubDefinitionKind: submission.clubTrackingDefinition?.kind, mappingStatusAtRecording: submission.clubMappingStatusAtRecording })
    const standardDisplayName = submission.standardEventDefinitionAtRecording?.name ?? submission.eventDefinition?.name ?? null
    const warnings = getClubDefinitionSnapshotWarnings({ recordedMappingStatus: submission.clubMappingStatusAtRecording, recordedMappingRevision: submission.clubMappingRevisionAtRecording, recordedStandardEventDefinitionId: submission.standardEventDefinitionIdAtRecording, currentDefinition: submission.clubTrackingDefinition })
    const contributesToStandardReporting = observationContributesToStandardReporting({ clubTrackingDefinitionId: submission.clubTrackingDefinitionId, clubDefinitionKind: submission.clubTrackingDefinition?.kind, mappingStatusAtRecording: submission.clubMappingStatusAtRecording, eventDefinitionId: submission.eventDefinitionId })
    return {
    id: submission.id,
    type: 'event' as const,
    playerName: submission.player ? `${submission.player.firstName} ${submission.player.surname}` : getSubmissionTargetLabel(submission),
    squadNumber: submission.player?.squadNumber ?? null,
    eventLabel: submission.clubTrackingDefinition?.name ?? getParentSubmissionEventDisplayName(submission),
    detailLabel: standardDisplayName ? `Recorded standard: ${standardDisplayName}` : null,
    identityLabel,
    mappingStatusLabel: submission.clubMappingStatusAtRecording ? formatStatus(submission.clubMappingStatusAtRecording) : null,
    mappingRevisionLabel: submission.clubMappingRevisionAtRecording !== null ? String(submission.clubMappingRevisionAtRecording) : null,
    standardIdentityLabel: standardDisplayName,
    contributesToStandardReporting,
    currentDefinitionWarnings: warnings,
    submitterLabel: submission.submittedBy.email,
    halfLabel: formatHalfLabel(submission.half),
    matchTime: formatMatchTime(submission.matchSecond),
    status: submission.status,
    statusLabel: formatStatus(submission.status),
    createdAt: submission.createdAt.toISOString(),
    createdAtLabel: formatDateTime(submission.createdAt),
    reviewedAtLabel: submission.acceptedAt ? formatDateTime(submission.acceptedAt) : null,
    reviewedByLabel: submission.acceptedBy?.email ?? null,
    note: submission.note,
    hasLocation: submission.x !== null && submission.y !== null,
    }
  })
  const patternSubmissionRows = match.submittedPatterns.map((submission) => {
    const identityLabel = getReviewIdentityLabel({ clubTrackingDefinitionId: submission.clubTrackingDefinitionId, clubDefinitionKind: submission.clubTrackingDefinition?.kind, mappingStatusAtRecording: submission.clubMappingStatusAtRecording })
    const standardDisplayName = submission.standardPatternDefinitionAtRecording?.name ?? submission.pattern.name
    const warnings = getClubDefinitionSnapshotWarnings({ recordedMappingStatus: submission.clubMappingStatusAtRecording, recordedMappingRevision: submission.clubMappingRevisionAtRecording, recordedStandardPatternDefinitionId: submission.standardPatternDefinitionIdAtRecording, currentDefinition: submission.clubTrackingDefinition })
    const contributesToStandardReporting = observationContributesToStandardReporting({ clubTrackingDefinitionId: submission.clubTrackingDefinitionId, clubDefinitionKind: submission.clubTrackingDefinition?.kind, mappingStatusAtRecording: submission.clubMappingStatusAtRecording, patternId: submission.patternId })
    return {
    id: submission.id,
    type: 'pattern' as const,
    playerName: submission.player ? `${submission.player.firstName} ${submission.player.surname}` : getSubmissionTargetLabel({ assignment: { trackingTask: submission.trackingTask } }),
    squadNumber: submission.player?.squadNumber ?? null,
    eventLabel: submission.clubTrackingDefinition?.name ?? submission.pattern.name,
    detailLabel: `Outcome: ${submission.outcome.label}${standardDisplayName ? ` / Recorded standard: ${standardDisplayName}` : ''}`,
    identityLabel,
    mappingStatusLabel: submission.clubMappingStatusAtRecording ? formatStatus(submission.clubMappingStatusAtRecording) : null,
    mappingRevisionLabel: submission.clubMappingRevisionAtRecording !== null ? String(submission.clubMappingRevisionAtRecording) : null,
    standardIdentityLabel: standardDisplayName,
    contributesToStandardReporting,
    currentDefinitionWarnings: warnings,
    submitterLabel: submission.submittedBy.email,
    halfLabel: formatHalfLabel(submission.half),
    matchTime: formatMatchTime(submission.matchSecond),
    status: submission.status,
    statusLabel: formatStatus(submission.status),
    createdAt: submission.createdAt.toISOString(),
    createdAtLabel: formatDateTime(submission.createdAt),
    reviewedAtLabel: submission.reviewedAt ? formatDateTime(submission.reviewedAt) : null,
    reviewedByLabel: submission.reviewedBy?.email ?? null,
    note: submission.note,
    hasLocation: submission.x !== null && submission.y !== null,
    }
  })
  const unifiedSubmissionRows = [...parentSubmissionRows, ...patternSubmissionRows].sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  const pendingParentSubmissionCount = unifiedSubmissionRows.filter((submission) => submission.status === 'PENDING').length
  const showHeaderScore = match.status !== 'DRAFT'
  const copiedSetupNotice = setupCopied === '1'
  const showTrackingAssignmentStatus = isMatchDayTrackingV2Enabled() && canManageThisMatch
  const trackingAssignmentStatus = showTrackingAssignmentStatus ? await getAssignmentStatusForMatch(match.id) : []
  const selectedTrackedPlayerNames = match.matchDayPlayers
    .filter((player) => match.eventTrackingScope === 'PLAYER' && player.isTracked)
    .map((player) => `${player.player.firstName} ${player.player.surname}`)
    .sort((firstName, secondName) => firstName.localeCompare(secondName))
  const trackingFocusLabel = match.eventTrackingScope === 'PLAYER' ? 'Selected players' : 'Team events'

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href="/match-day" className="text-blue-600 hover:underline">
          Match Day
        </Link>
        <Link href="/club-setup" className="text-blue-600 hover:underline">
          Club Setup
        </Link>
      </div>

      {(match.status === 'DRAFT' || match.status === 'COMPLETED') && (
        <section className="rounded-2xl bg-gray-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{headline}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {formatDate(match.kickoffAt)} · {matchTypeLabel} · {venueLabel} ·{' '}
                {statusLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {showHeaderScore && (
                <div className="rounded-lg border bg-gray-50 px-4 py-2 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Score</p>
                  <p className="text-2xl font-bold tabular-nums">{finalScore}</p>
                </div>
              )}
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(match.status)}`}>
                {statusLabel}
              </span>
              {canManageThisMatch && (
                <form action={duplicateMatchDaySetup}>
                  <input type="hidden" name="matchDayId" value={match.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
                  >
                    Copy setup
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {copiedSetupNotice && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
          Setup copied. Update the date, opposition and squad before starting.
        </p>
      )}

      {match.status === 'DRAFT' && (
        <>
          <DraftSetupSummary
            dateLabel={formatDate(match.kickoffAt)}
            kickoffLabel={formatTimeInput(match.kickoffAt)}
            venueLabel={venueLabel}
            statusLabel={statusLabel}
            trackPlayerMinutes={match.trackPlayerMinutes}
            trackingFocusLabel={trackingFocusLabel}
            selectedPlayerNames={selectedTrackedPlayerNames}
            selectedEventLabels={selectedEventLabels}
          />
          <MatchControlClient
            matchDayId={match.id}
            teamName={match.team.name}
            opposition={match.opposition}
            venue={match.venue}
            status={match.status}
            ownScore={match.ownScore}
            oppositionScore={match.oppositionScore}
            firstHalfStartedAt={match.firstHalfStartedAt?.toISOString() ?? null}
            firstHalfEndedAt={match.firstHalfEndedAt?.toISOString() ?? null}
            secondHalfStartedAt={match.secondHalfStartedAt?.toISOString() ?? null}
            secondHalfEndedAt={match.secondHalfEndedAt?.toISOString() ?? null}
            completedAt={match.completedAt?.toISOString() ?? null}
            startMatchAction={startMatch}
            endFirstHalfAction={endFirstHalf}
            startSecondHalfAction={startSecondHalf}
            completeMatchAction={completeMatch}
            updateMatchScoreAction={updateMatchScore}
          />
          {canManageThisMatch && (
            <section className="mt-6 grid gap-4">
              <details className="rounded-2xl border bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold text-slate-950">Edit match details</summary>
                <DraftMatchDetailsForm matchDayId={match.id} kickoffAt={match.kickoffAt} opposition={match.opposition} matchType={match.matchType} venue={match.venue} updateDraftMatchDetailsAction={updateDraftMatchDetails} />
              </details>
              <details className="rounded-2xl border bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold text-slate-950">Edit squad and players</summary>
                <div className="mt-4"><MatchSquadClient matchDayId={match.id} isReadOnly={false} hasSquadRecords={match.matchDayPlayers.length > 0} players={squadPlayers} setupMatchSquadAction={setupMatchSquad} updateMatchSquadPlayerAction={updateMatchSquadPlayer} /></div>
              </details>
              <details className="rounded-2xl border bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold text-slate-950">Edit tracking focus</summary>
                <div className="mt-4"><MatchTrackingFocusClient key={`${match.eventTrackingScope}:${trackingPlayers.map((player) => `${player.matchDayPlayerId}:${player.isTracked}`).join('|')}`} matchDayId={match.id} players={trackingPlayers} teamPlayers={squadPlayers} eventTrackingScope={match.eventTrackingScope} trackPlayerMinutes={match.trackPlayerMinutes} updateMatchTrackingFocusAction={updateMatchTrackingFocus} /></div>
              </details>
              <details className="rounded-2xl border bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold text-slate-950">Edit events</summary>
                <div className="mt-4"><MatchEventSetupClient matchDayId={match.id} eventOptions={setupEventOptions} categoryOptions={setupEventCategoryOptions} selectedEventDefinitionIds={selectedEventDefinitionIdsForSetup} updateMatchEventSetupAction={updateMatchEventSetup} /></div>
              </details>
            </section>
          )}
          {showTrackingAssignmentStatus && (
            <section className="mt-6">
              <TrackingAssignmentsPanel tasks={trackingAssignmentStatus} cancelAssignmentAction={cancelCoachTrackingAssignment} />
            </section>
          )}
        </>
      )}

      {match.status !== 'DRAFT' && match.status !== 'COMPLETED' && (
        <MatchControlClient
          matchDayId={match.id}
          teamName={match.team.name}
          opposition={match.opposition}
          venue={match.venue}
          status={match.status}
          ownScore={match.ownScore}
          oppositionScore={match.oppositionScore}
          firstHalfStartedAt={match.firstHalfStartedAt?.toISOString() ?? null}
          firstHalfEndedAt={match.firstHalfEndedAt?.toISOString() ?? null}
          secondHalfStartedAt={match.secondHalfStartedAt?.toISOString() ?? null}
          secondHalfEndedAt={match.secondHalfEndedAt?.toISOString() ?? null}
          completedAt={match.completedAt?.toISOString() ?? null}
          startMatchAction={startMatch}
          endFirstHalfAction={endFirstHalf}
          startSecondHalfAction={startSecondHalf}
          completeMatchAction={completeMatch}
          updateMatchScoreAction={updateMatchScore}
          liveDetailsControl={(
            <MatchLiveDetailsButton
              headline={headline}
              dateLabel={formatDate(match.kickoffAt)}
              matchTypeLabel={matchTypeLabel}
              venueLabel={venueLabel}
              statusLabel={statusLabel}
              teamName={match.team.name}
              opposition={match.opposition}
              starterCount={trackingPlayers.filter((player) => player.squadStatus === 'STARTER').length}
              substituteCount={trackingPlayers.filter((player) => player.squadStatus === 'SUBSTITUTE').length}
              trackedCount={trackingPlayers.filter((player) => player.isTracked).length}
              selectedEventLabels={selectedEventLabels}
            />
          )}
        />
      )}

      {match.status !== 'COMPLETED' && match.status !== 'DRAFT' && (
        <section className="mt-2 rounded-xl bg-gray-50 p-1 sm:mt-4 sm:p-3">
          <div className={match.trackPlayerMinutes ? 'grid gap-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'grid gap-2'}>
            {match.trackPlayerMinutes && (
              <div id="players-and-substitutions" className="order-2 scroll-mt-24 xl:order-1">
                <MatchPitchClient
                  matchDayId={match.id}
                  status={match.status}
                  matchElapsedMilliseconds={matchElapsedMilliseconds}
                  players={pitchPlayers}
                  togglePlayerOnPitchAction={togglePlayerOnPitch}
                />
              </div>
            )}
            <div id="event-recording" className="order-1 scroll-mt-24 xl:order-2">
              <MatchEventsClient
                matchDayId={match.id}
                status={match.status}
                players={eventPlayers}
                allowTeamEvents={match.eventTrackingScope === 'TEAM'}
                events={recentEventsForRecording}
                eventOptions={selectedEventOptions}
                categoryOptions={selectedEventCategoryOptions}
                recordMatchEventAction={recordMatchEvent}
                deleteMatchEventAction={deleteMatchEvent}
              />
            </div>
          </div>
          <div className="mt-4">
            <ParentSubmissionsPanel
              matchDayId={match.id}
              matchStatus={match.status}
              submissions={unifiedSubmissionRows}
              pendingCount={pendingParentSubmissionCount}
              canReview={canReviewParentSubmissions}
              acceptParentSubmissionAction={acceptParentSubmission}
              ignoreParentSubmissionAction={ignoreParentSubmission}
              reviewPatternSubmissionAction={reviewPatternSubmission}
            />
          </div>
          {showTrackingAssignmentStatus && (
            <div className="mt-4">
              <TrackingAssignmentsPanel tasks={trackingAssignmentStatus} cancelAssignmentAction={cancelCoachTrackingAssignment} />
            </div>
          )}
        </section>
      )}

      {match.status === 'COMPLETED' && (
        <>
          <section className="mt-6">
            <MatchSummaryReport
              headline={headline}
              finalScore={finalScore}
              statusLabel={statusLabel}
              matchDate={formatDateTime(match.kickoffAt)}
              minutesRows={minutesRows}
              teamEventTotals={teamEventTotals}
              playerEventCounts={playerEventCounts}
              mostInvolvedPlayers={mostInvolvedPlayers}
              timelineEvents={timelineEvents}
              csvMetadata={csvMetadata}
              summaryCsvRows={summaryCsvRows}
              eventCsvRows={eventCsvRows}
              patternCsvRows={patternCsvRows}
              standardPatternRows={standardPatternCsvRows}
              showClubTracking={showClubTrackingReports}
              clubEventAggregates={clubEventAggregates}
              clubPatternAggregates={clubPatternAggregates}
              mappingCoverageRows={mappingCoverageRows}
            />
          </section>
          <section className="mt-4">
            <div className="mb-3">
              <h2 className="text-xl font-bold sm:text-2xl">Location Maps</h2>
              <p className="mt-1 text-sm text-gray-500">Recorded location events for this match</p>
            </div>
            <TouchMap events={touchMapEvents} />
          </section>
          <section className="mt-4">
             {showTrackingAssignmentStatus && <TrackingAssignmentsPanel tasks={trackingAssignmentStatus} cancelAssignmentAction={cancelCoachTrackingAssignment} />}
          </section>
          <section className="mt-4">
            <ParentSubmissionsPanel
              matchDayId={match.id}
              matchStatus={match.status}
              submissions={unifiedSubmissionRows}
              pendingCount={pendingParentSubmissionCount}
              canReview={canReviewParentSubmissions}
              acceptParentSubmissionAction={acceptParentSubmission}
              ignoreParentSubmissionAction={ignoreParentSubmission}
              reviewPatternSubmissionAction={reviewPatternSubmission}
            />
          </section>
        </>
      )}

      {match.status === 'DRAFT' && unifiedSubmissionRows.length > 0 && (
        <section className="mt-6">
          <ParentSubmissionsPanel
            matchDayId={match.id}
            matchStatus={match.status}
            submissions={unifiedSubmissionRows}
            pendingCount={pendingParentSubmissionCount}
            canReview={canReviewParentSubmissions}
            acceptParentSubmissionAction={acceptParentSubmission}
            ignoreParentSubmissionAction={ignoreParentSubmission}
            reviewPatternSubmissionAction={reviewPatternSubmission}
          />
        </section>
      )}
    </main>
  )
}

function DraftSetupSummary({
  dateLabel,
  kickoffLabel,
  venueLabel,
  statusLabel,
  trackPlayerMinutes,
  trackingFocusLabel,
  selectedPlayerNames,
  selectedEventLabels,
}: {
  dateLabel: string
  kickoffLabel: string
  venueLabel: string
  statusLabel: string
  trackPlayerMinutes: boolean
  trackingFocusLabel: string
  selectedPlayerNames: string[]
  selectedEventLabels: string[]
}) {
  return (
    <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Draft setup overview</h2>
          <p className="mt-1 text-sm text-slate-600">Review the match setup, then start when ready. Edit sections are closed until needed.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{statusLabel}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Fixture" value={`${dateLabel} · ${kickoffLabel}`} />
        <SummaryCard label="Venue" value={venueLabel} />
        <SummaryCard label="Playing-time tracking" value={trackPlayerMinutes ? 'On' : 'Off'} />
        <SummaryCard label="Tracking focus" value={trackingFocusLabel} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ChipPanel title="Selected players" emptyText={trackPlayerMinutes ? 'Full squad setup controls starters and substitutes.' : 'Team events only. No player selection required.'} values={selectedPlayerNames} />
        <ChipPanel title={`${selectedEventLabels.length} selected event${selectedEventLabels.length === 1 ? '' : 's'}`} emptyText="No events selected yet." values={selectedEventLabels} />
      </div>
    </section>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-extrabold text-slate-950">{value}</p></div>
}

function ChipPanel({ title, emptyText, values }: { title: string; emptyText: string; values: string[] }) {
  return <div className="rounded-xl border p-3"><p className="text-sm font-bold text-slate-950">{title}</p>{values.length === 0 ? <p className="mt-2 text-sm text-slate-500">{emptyText}</p> : <div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{value}</span>)}</div>}</div>
}

function TrackingAssignmentsPanel({ tasks, cancelAssignmentAction }: { tasks: Awaited<ReturnType<typeof getAssignmentStatusForMatch>>; cancelAssignmentAction: (formData: FormData) => Promise<void> }) {
  return (
    <details open className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Tracking assignments</h2>
            <p className="mt-1 text-sm text-slate-500">Contributor assignment response status for this match.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
        </div>
      </summary>
      {tasks.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No tracking assignments for this match yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{task.scopeType} · {getAssignmentTarget(task)} · {task.events.length} event{task.events.length === 1 ? '' : 's'} · {task.patterns.length} pattern{task.patterns.length === 1 ? '' : 's'}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{task.status}</span>
              </div>
              {task.assignments.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-slate-600">Unassigned</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {task.assignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="font-bold text-slate-950">{assignment.assignmentMode === 'GROUP_OFFER' && !assignment.assignedUserId ? 'Open group offer' : assignment.assignedUser?.email ?? 'Assigned contributor'}</p>
                      <p className="mt-1 text-sm text-slate-700">{assignment.assignmentMode.replace('_', ' ')} · {formatAssignmentStatus(assignment.status)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{assignment.submittedMatchEvents.length} events · {assignment.submittedPatterns.length} patterns · {assignment.submittedMatchEvents.filter((event) => event.status === 'PENDING').length + assignment.submittedPatterns.filter((pattern) => pattern.status === 'PENDING').length} awaiting review · Recipients {assignment.recipients.length}</p>
                      <div className="mt-2 space-y-1 text-xs font-semibold text-slate-500">
                        <p>Created {formatDateTime(assignment.createdAt)}</p>
                        {assignment.acceptedAt && <p>Accepted {formatDateTime(assignment.acceptedAt)}</p>}
                        {assignment.startedAt && <p>Started {formatDateTime(assignment.startedAt)}</p>}
                        {assignment.submittedAt && <p>Submitted {formatDateTime(assignment.submittedAt)}</p>}
                        {assignment.cancelledAt && <p>Cancelled {formatDateTime(assignment.cancelledAt)}</p>}
                      </div>
                      {(assignment.status === 'PENDING' || assignment.status === 'OFFERED') && (
                        <form action={cancelAssignmentAction} className="mt-2">
                          <input type="hidden" name="matchDayId" value={task.matchDayId} />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <button type="submit" className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Cancel assignment</button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </details>
  )
}

function DraftMatchDetailsForm({
  matchDayId,
  kickoffAt,
  opposition,
  matchType,
  venue,
  updateDraftMatchDetailsAction,
}: {
  matchDayId: string
  kickoffAt: Date
  opposition: string
  matchType: string
  venue: string
  updateDraftMatchDetailsAction: (formData: FormData) => Promise<void>
}) {
  return (
    <section className="mt-6 rounded-2xl bg-gray-50 p-5">
      <div>
        <h2 className="text-xl font-bold">Match details</h2>
        <p className="mt-1 text-sm text-gray-500">
          Update the fixture details before the match starts.
        </p>
      </div>
      <form action={updateDraftMatchDetailsAction} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="matchDayId" value={matchDayId} />
        <label className="text-sm font-semibold text-slate-700">
          Date
          <input
            type="date"
            name="date"
            defaultValue={formatDateInput(kickoffAt)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Kick-off
          <input
            type="time"
            name="kickoffTime"
            defaultValue={formatTimeInput(kickoffAt)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2 lg:col-span-1">
          Opposition
          <input
            name="opposition"
            defaultValue={opposition}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            required
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Match type
          <select name="matchType" defaultValue={matchType} className="mt-1 w-full rounded-lg border px-3 py-2" required>
            <option value="LEAGUE">League</option>
            <option value="CUP">Cup</option>
            <option value="FRIENDLY">Friendly</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Venue
          <select name="venue" defaultValue={venue} className="mt-1 w-full rounded-lg border px-3 py-2" required>
            <option value="HOME">Home</option>
            <option value="AWAY">Away</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </label>
        <div className="md:col-span-2 lg:col-span-5">
          <button
            type="submit"
            className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800"
          >
            Save match details
          </button>
        </div>
      </form>
    </section>
  )
}
