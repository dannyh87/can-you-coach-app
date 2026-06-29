import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import MatchControlClient from '@/app/match-day/[id]/MatchControlClient'
import MatchEventSetupClient from '@/app/match-day/[id]/MatchEventSetupClient'
import MatchEventsClient from '@/app/match-day/[id]/MatchEventsClient'
import MatchPitchClient from '@/app/match-day/[id]/MatchPitchClient'
import ParentSubmissionsPanel from '@/app/match-day/[id]/ParentSubmissionsPanel'
import MatchSummaryReport from '@/app/match-day/[id]/MatchSummaryReport'
import MatchSquadClient from '@/app/match-day/[id]/MatchSquadClient'
import MatchTrackingFocusClient from '@/app/match-day/[id]/MatchTrackingFocusClient'
import { getCurrentUser } from '@/lib/auth'
import {
  formatMatchEventType,
  getMatchEventPrismaCategory,
  isMatchEventType,
  matchEventCategories,
  matchEventDefinitions,
  matchEventTypes,
} from '@/lib/matchEventTaxonomy'
import { canManageMatchDay, canRunMatchDay, canViewMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const
const pitchTargetStates = ['ON', 'OFF'] as const

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

async function createDefaultMatchEventSetup(matchDayId: string) {
  const existingCount = await prisma.matchDayEventType.count({
    where: { matchDayId },
  })

  if (existingCount > 0) return []

  return matchEventDefinitions.map((eventDefinition) =>
    prisma.matchDayEventType.create({
      data: {
        matchDayId,
        eventType: eventDefinition.value,
        category: eventDefinition.category,
      },
    })
  )
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

  const squadPlayers = await prisma.matchDayPlayer.findMany({
    where: { matchDayId: match.id },
    select: { id: true, squadStatus: true },
  })

  await prisma.$transaction(
    squadPlayers.map((squadPlayer) =>
      prisma.matchDayPlayer.update({
        where: { id: squadPlayer.id },
        data: {
          isTracked:
            squadPlayer.squadStatus !== 'NOT_INVOLVED' &&
            trackedMatchDayPlayerIds.has(squadPlayer.id),
        },
      })
    )
  )

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
}

async function updateMatchEventSetup(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  const eventTypes = Array.from(new Set(
    formData
      .getAll('eventType')
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  ))

  if (!matchDayId) return { ok: false, reason: 'Missing match.' }
  if (eventTypes.length === 0) {
    return { ok: false, reason: 'Select at least one event type.' }
  }

  const invalidEventType = eventTypes.find((eventType) => !isMatchEventType(eventType))
  if (invalidEventType) return { ok: false, reason: 'Event type is invalid.' }

  const match = await getActionableMatch(matchDayId, 'manage')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') {
    return { ok: false, reason: 'Event setup can only be changed before the match starts.' }
  }

  await prisma.$transaction([
    prisma.matchDayEventType.deleteMany({ where: { matchDayId: match.id } }),
    ...eventTypes.map((eventType) => {
      if (!isMatchEventType(eventType)) throw new Error('Event type is invalid.')

      return prisma.matchDayEventType.create({
        data: {
          matchDayId: match.id,
          eventType,
          category: getMatchEventPrismaCategory(eventType),
        },
      })
    }),
  ])

  revalidatePath(`/match-day/${match.id}`)
  return { ok: true }
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
  const defaultEventSetupCreates = await createDefaultMatchEventSetup(match.id)

  await prisma.$transaction([
    ...defaultEventSetupCreates,
    prisma.matchDay.update({
      where: { id: match.id },
      data: {
        status: 'IN_PROGRESS',
        firstHalfStartedAt: now,
      },
    }),
    ...starters.map((starter) =>
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
    ),
  ])

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
  const eventType = getTextValue(formData, 'eventType')
  const x = getOptionalPitchCoordinate(formData, 'x')
  const y = getOptionalPitchCoordinate(formData, 'y')

  if (!matchDayId || !matchDayPlayerId || !eventType) {
    return { ok: false, reason: 'Match, player and event type are required.' }
  }

  if (!x.ok || !y.ok) {
    return { ok: false, reason: 'Event location must be a number between 0 and 100.' }
  }

  if (!isMatchEventType(eventType)) {
    return { ok: false, reason: 'Event type is invalid.' }
  }

  const match = await getActionableMatch(matchDayId, 'run')
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'IN_PROGRESS') {
    return { ok: false, reason: 'Events can only be recorded during live match play.' }
  }

  const selectedEvent = await prisma.matchDayEventType.findFirst({
    where: {
      matchDayId: match.id,
      eventType,
    },
    select: { id: true },
  })

  if (!selectedEvent) {
    return { ok: false, reason: 'This event type was not selected for this match.' }
  }

  const activeHalf = getActiveHalf(match)
  if (!activeHalf) {
    return { ok: false, reason: 'No half timer is currently running.' }
  }

  const squadPlayer = await prisma.matchDayPlayer.findFirst({
    where: {
      id: matchDayPlayerId,
      matchDayId: match.id,
      matchDay: {
        teamId: match.teamId,
      },
      squadStatus: {
        not: 'NOT_INVOLVED',
      },
      isTracked: true,
    },
  })

  if (!squadPlayer) {
    return { ok: false, reason: 'Player is not available for event tracking in this match.' }
  }

  const openStint = await prisma.matchPlayerStint.findFirst({
    where: {
      matchDayId: match.id,
      matchDayPlayerId: squadPlayer.id,
      endedAt: null,
    },
  })

  if (!openStint) {
    return { ok: false, reason: 'Events can only be recorded for players on the pitch.' }
  }

  const now = new Date()
  const matchSecond = getSecondsBetween(activeHalf.startedAt, now)

  await prisma.matchEvent.create({
    data: {
      matchDayId: match.id,
      playerId: squadPlayer.playerId,
        eventType,
      half: activeHalf.half,
      matchSecond,
      ownScoreAtTime: match.ownScore,
      oppositionScoreAtTime: match.oppositionScore,
      ...(x.value !== undefined ? { x: x.value } : {}),
      ...(y.value !== undefined ? { y: y.value } : {}),
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

    const matchPlayer = await tx.matchDayPlayer.findFirst({
      where: {
        matchDayId,
        playerId: submission.playerId,
        squadStatus: { not: 'NOT_INVOLVED' },
      },
      select: { id: true },
    })

    if (!matchPlayer) {
      return { ok: false, reason: 'This player is no longer available in the match squad.' } satisfies MatchActionResult
    }

    const selectedEventType = await tx.matchDayEventType.findFirst({
      where: {
        matchDayId,
        eventType: submission.eventType,
      },
      select: { id: true },
    })

    if (!selectedEventType) {
      return { ok: false, reason: 'This event type is no longer selected for this match.' } satisfies MatchActionResult
    }

    const reviewedAt = new Date()
    const reviewedSubmission = await tx.submittedMatchEvent.updateMany({
      where: {
        id: submission.id,
        status: 'PENDING',
      },
      data: {
        status: 'ACCEPTED',
        acceptedAt: reviewedAt,
        acceptedByUserId: user.id,
      },
    })

    if (reviewedSubmission.count !== 1) {
      return { ok: false, reason: 'This submission has already been reviewed.' } satisfies MatchActionResult
    }

    await tx.matchEvent.create({
      data: {
        matchDayId: submission.matchDayId,
        playerId: submission.playerId,
        eventType: submission.eventType,
        half: submission.half,
        matchSecond: submission.matchSecond,
        ownScoreAtTime: submission.ownScoreAtTime,
        oppositionScoreAtTime: submission.oppositionScoreAtTime,
      },
    })

    return { ok: true } satisfies MatchActionResult
  })

  revalidatePath(`/match-day/${matchDayId}`)
  return result
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

    return { ok: true } satisfies MatchActionResult
  })

  revalidatePath(`/match-day/${matchDayId}`)
  return result
}

export default async function MatchDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!(await canViewMatchDay(user.id, id))) notFound()
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
        },
        orderBy: { createdAt: 'asc' },
      },
      matchDayEventTypes: {
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
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!match) notFound()

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
    .filter((squadPlayer) => squadPlayer.squadStatus !== 'NOT_INVOLVED')
    .map((squadPlayer) => ({
      matchDayPlayerId: squadPlayer.id,
      firstName: squadPlayer.player.firstName,
      surname: squadPlayer.player.surname,
      squadNumber: squadPlayer.shirtNumberSnapshot ?? squadPlayer.player.squadNumber,
      squadStatus: squadPlayer.squadStatus as 'STARTER' | 'SUBSTITUTE',
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
  const eventPlayers = pitchPlayers
    .filter((player) => player.isOnPitch && player.isTracked)
    .map((player) => ({
      matchDayPlayerId: player.matchDayPlayerId,
      playerId: player.playerId,
      firstName: player.firstName,
      surname: player.surname,
      squadNumber: player.squadNumber,
    }))
  const recentEvents = match.matchEvents.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    half: event.half,
    matchSecond: event.matchSecond,
    ownScoreAtTime: event.ownScoreAtTime,
    oppositionScoreAtTime: event.oppositionScoreAtTime,
    playerName: event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Unknown player',
  }))
  const recentEventsForRecording = [...recentEvents]
    .sort((firstEvent, secondEvent) => secondEvent.matchSecond - firstEvent.matchSecond)
    .slice(0, 20)
  const selectedEventOptions = (match.matchDayEventTypes.length > 0
    ? match.matchDayEventTypes.map((selectedEventType) => {
        const eventDefinition = matchEventDefinitions.find(
          (definition) => definition.value === selectedEventType.eventType
        )

        return eventDefinition
          ? {
              value: eventDefinition.value,
              label: eventDefinition.label,
              category: eventDefinition.category,
            }
          : null
      }).filter((eventOption) => eventOption !== null)
    : matchEventDefinitions.map((eventDefinition) => ({
        value: eventDefinition.value,
        label: eventDefinition.label,
        category: eventDefinition.category,
      })))
  const selectedEventTypesForSetup = selectedEventOptions.map(
    (eventOption) => eventOption.value
  )
  const minutesRows = pitchPlayers
    .map((player) => ({
      playerId: player.playerId,
      playerName: `${player.firstName} ${player.surname}`,
      squadNumber: player.squadNumber,
      minutesPlayed: Math.round(player.totalMilliseconds / 60000),
    }))
    .sort((firstPlayer, secondPlayer) => secondPlayer.minutesPlayed - firstPlayer.minutesPlayed)
  const teamEventTotals = selectedEventOptions
    .map((eventOption) => ({
      key: eventOption.value,
      label: eventOption.label,
      count: match.matchEvents.filter((event) => event.eventType === eventOption.value).length,
    }))
    .filter((eventTotal) => eventTotal.count > 0)
  const playerEventCountMap = new Map<
    string,
    { playerId: string; playerName: string; eventCounts: Map<string, number> }
  >()

  for (const event of match.matchEvents) {
    const playerId = event.playerId ?? 'unknown-player'
    const playerName = event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Unknown player'
    const currentRow = playerEventCountMap.get(playerId) ?? {
      playerId,
      playerName,
      eventCounts: new Map<string, number>(),
    }

    currentRow.eventCounts.set(
      event.eventType,
      (currentRow.eventCounts.get(event.eventType) ?? 0) + 1
    )
    playerEventCountMap.set(playerId, currentRow)
  }

  const playerEventCounts = Array.from(playerEventCountMap.values())
    .map((row) => {
      const eventCounts = Array.from(row.eventCounts.entries()).map(([eventType, count]) => ({
        key: eventType,
        label: formatMatchEventType(eventType),
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
  const getPlayerEventCount = (playerId: string, eventType: string) =>
    playerEventCountMap.get(playerId)?.eventCounts.get(eventType) ?? 0
  const summaryCsvRows = pitchPlayers.map((player) => {
    const totalEvents = matchEventTypes.reduce(
      (total, eventType) => total + getPlayerEventCount(player.playerId, eventType),
      0
    )

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
  const timelineEvents = match.matchEvents.map((event) => ({
    id: event.id,
    label: formatMatchEventType(event.eventType),
    half: event.half,
    matchSecond: event.matchSecond,
    playerName: event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Unknown player',
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
  const eventCsvRows = match.matchEvents.map((event) => ({
    half: formatHalfLabel(event.half),
    matchTime: formatMatchTime(event.matchSecond),
    playerName: event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Unknown player',
    event: formatMatchEventType(event.eventType),
    scoreAtTime: `${event.ownScoreAtTime}-${event.oppositionScoreAtTime}`,
  }))
  const parentSubmissionRows = match.submittedMatchEvents.map((submission) => ({
    id: submission.id,
    playerName: `${submission.player.firstName} ${submission.player.surname}`,
    squadNumber: submission.player.squadNumber,
    eventLabel: formatMatchEventType(submission.eventType),
    submitterLabel: submission.submittedBy.email,
    halfLabel: formatHalfLabel(submission.half),
    matchTime: formatMatchTime(submission.matchSecond),
    status: submission.status,
    statusLabel: formatStatus(submission.status),
    createdAtLabel: formatDateTime(submission.createdAt),
    reviewedAtLabel: submission.acceptedAt ? formatDateTime(submission.acceptedAt) : null,
    reviewedByLabel: submission.acceptedBy?.email ?? null,
    note: submission.note,
  }))
  const pendingParentSubmissionCount = match.submittedMatchEvents.filter(
    (submission) => submission.status === 'PENDING'
  ).length
  const showHeaderScore = match.status !== 'DRAFT'

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
          </div>
        </div>
      </section>

      {match.status === 'DRAFT' && (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <MatchSquadClient
              matchDayId={match.id}
              isReadOnly={false}
              hasSquadRecords={match.matchDayPlayers.length > 0}
              players={squadPlayers}
              setupMatchSquadAction={setupMatchSquad}
              updateMatchSquadPlayerAction={updateMatchSquadPlayer}
            />
            <MatchTrackingFocusClient
              key={trackingPlayers
                .map((player) => `${player.matchDayPlayerId}:${player.isTracked}`)
                .join('|')}
              matchDayId={match.id}
              players={trackingPlayers}
              updateMatchTrackingFocusAction={updateMatchTrackingFocus}
            />
            <MatchEventSetupClient
              matchDayId={match.id}
              eventOptions={matchEventDefinitions}
              categoryOptions={matchEventCategories}
              selectedEventTypes={selectedEventTypesForSetup}
              updateMatchEventSetupAction={updateMatchEventSetup}
            />
          </section>
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
        />
      )}

      {match.status !== 'DRAFT' && match.status !== 'COMPLETED' && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm sm:mt-6 sm:p-4">
          <summary className="cursor-pointer font-bold text-slate-950">
            Match setup
          </summary>
          <div className="mt-3 grid gap-2 text-slate-700 md:grid-cols-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h2 className="font-bold text-amber-950">Squad setup locked</h2>
              <p className="mt-1 text-amber-900">
                Starters, substitutes and not involved players are locked after kick-off to protect minutes and substitution history.
              </p>
              {/* TODO: Add safe mid-game squad edits that preserve existing stints and events. */}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <h2 className="font-bold text-amber-950">Event setup locked</h2>
              <p className="mt-1 text-amber-900">
                Tracked event categories are locked after kick-off so existing event records stay consistent.
              </p>
              {/* TODO: Add safe mid-game event category edits without removing existing recorded events. */}
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <h2 className="font-bold text-blue-950">Safe setup view</h2>
              <p className="mt-1 text-blue-900">
                Use players/substitutions and event recording below for live coaching observations. Setup edits can be expanded in a future version.
              </p>
            </div>
          </div>
        </details>
      )}

      {match.status !== 'COMPLETED' && match.status !== 'DRAFT' && (
        <section className="mt-4 rounded-2xl bg-gray-50 p-3 sm:mt-6 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">Live match</h2>
              <p className="mt-1 text-sm text-gray-500">
                Score, substitutions and event recording are separated so each tap does one job.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="#players-and-substitutions"
                className="inline-flex rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                Substitutions
              </a>
              <a
                href="#event-recording"
                className="inline-flex rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900"
              >
                Events
              </a>
            </div>
          </div>
          <details className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
            <summary className="cursor-pointer font-bold">Quick live tips</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <p className="font-bold">1. Put players on</p>
              <p className="mt-1 text-blue-900">Sub players on before recording events.</p>
            </div>
            <div>
              <p className="font-bold">2. Record player events</p>
              <p className="mt-1 text-blue-900">Only tracked, on-pitch players appear.</p>
            </div>
            <div>
              <p className="font-bold">3. Update score separately</p>
              <p className="mt-1 text-blue-900">Goal buttons update score only.</p>
            </div>
            </div>
          </details>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div id="players-and-substitutions" className="order-2 scroll-mt-24 xl:order-1">
              <MatchPitchClient
                matchDayId={match.id}
                status={match.status}
                matchElapsedMilliseconds={matchElapsedMilliseconds}
                players={pitchPlayers}
                togglePlayerOnPitchAction={togglePlayerOnPitch}
              />
            </div>
            <div id="event-recording" className="order-1 scroll-mt-24 xl:order-2">
              <MatchEventsClient
                matchDayId={match.id}
                status={match.status}
                players={eventPlayers}
                events={recentEventsForRecording}
                eventOptions={selectedEventOptions}
                categoryOptions={matchEventCategories}
                recordMatchEventAction={recordMatchEvent}
                deleteMatchEventAction={deleteMatchEvent}
              />
            </div>
          </div>
          <div className="mt-4">
            <ParentSubmissionsPanel
              matchDayId={match.id}
              matchStatus={match.status}
              submissions={parentSubmissionRows}
              pendingCount={pendingParentSubmissionCount}
              canReview={canReviewParentSubmissions}
              acceptParentSubmissionAction={acceptParentSubmission}
              ignoreParentSubmissionAction={ignoreParentSubmission}
            />
          </div>
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
            />
          </section>
          <section className="mt-4">
            <ParentSubmissionsPanel
              matchDayId={match.id}
              matchStatus={match.status}
              submissions={parentSubmissionRows}
              pendingCount={pendingParentSubmissionCount}
              canReview={canReviewParentSubmissions}
              acceptParentSubmissionAction={acceptParentSubmission}
              ignoreParentSubmissionAction={ignoreParentSubmission}
            />
          </section>
        </>
      )}

      {match.status === 'DRAFT' && parentSubmissionRows.length > 0 && (
        <section className="mt-6">
          <ParentSubmissionsPanel
            matchDayId={match.id}
            matchStatus={match.status}
            submissions={parentSubmissionRows}
            pendingCount={pendingParentSubmissionCount}
            canReview={canReviewParentSubmissions}
            acceptParentSubmissionAction={acceptParentSubmission}
            ignoreParentSubmissionAction={ignoreParentSubmission}
          />
        </section>
      )}
    </main>
  )
}
