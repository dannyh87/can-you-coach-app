import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import MatchControlClient from '@/app/match-day/[id]/MatchControlClient'
import MatchEventSetupClient from '@/app/match-day/[id]/MatchEventSetupClient'
import MatchEventsClient from '@/app/match-day/[id]/MatchEventsClient'
import MatchPitchClient from '@/app/match-day/[id]/MatchPitchClient'
import MatchSummaryReport from '@/app/match-day/[id]/MatchSummaryReport'
import MatchSquadClient from '@/app/match-day/[id]/MatchSquadClient'
import MatchTrackingFocusClient from '@/app/match-day/[id]/MatchTrackingFocusClient'
import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const
const pitchTargetStates = ['ON', 'OFF'] as const
const matchEventCategories = [
  { value: 'ATTACKING', label: 'Attacking' },
  { value: 'IN_POSSESSION', label: 'In possession' },
  { value: 'OUT_OF_POSSESSION', label: 'Out of possession' },
  { value: 'TRANSITION', label: 'Transition' },
] as const
const matchEventDefinitions = [
  { value: 'GOAL', label: 'Goal', category: 'ATTACKING' },
  { value: 'ASSIST', label: 'Assist', category: 'ATTACKING' },
  { value: 'SHOT_ON_TARGET', label: 'Shot on target', category: 'ATTACKING' },
  { value: 'SHOT_OFF_TARGET', label: 'Shot off target', category: 'ATTACKING' },
  { value: 'PASS_COMPLETE', label: 'Pass complete', category: 'IN_POSSESSION' },
  { value: 'PASS_INCOMPLETE', label: 'Pass incomplete', category: 'IN_POSSESSION' },
  { value: 'ONE_V_ONE_SUCCESS', label: '1v1 success', category: 'IN_POSSESSION' },
  { value: 'ONE_V_ONE_UNSUCCESSFUL', label: '1v1 unsuccessful', category: 'IN_POSSESSION' },
] as const
const matchEventTypes = matchEventDefinitions.map((eventDefinition) => eventDefinition.value)

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

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
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

const formatEventType = (eventType: string) =>
  matchEventDefinitions.find((eventDefinition) => eventDefinition.value === eventType)?.label ??
  eventType

const getEventCategory = (eventType: (typeof matchEventTypes)[number]) =>
  matchEventDefinitions.find((eventDefinition) => eventDefinition.value === eventType)?.category ??
  'ATTACKING'

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

async function getOwnedMatch(matchDayId: string) {
  const user = await getLocalUser()

  return prisma.matchDay.findFirst({
    where: {
      id: matchDayId,
      team: {
        club: {
          userId: user.id,
        },
      },
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

  const match = await getOwnedMatch(matchDayId)
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

  const match = await getOwnedMatch(matchDayId)
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

  const match = await getOwnedMatch(matchDayId)
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

  const invalidEventType = eventTypes.find(
    (eventType) => !matchEventTypes.includes(eventType as (typeof matchEventTypes)[number])
  )
  if (invalidEventType) return { ok: false, reason: 'Event type is invalid.' }

  const match = await getOwnedMatch(matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') {
    return { ok: false, reason: 'Event setup can only be changed before the match starts.' }
  }

  await prisma.$transaction([
    prisma.matchDayEventType.deleteMany({ where: { matchDayId: match.id } }),
    ...eventTypes.map((eventType) => {
      const typedEventType = eventType as (typeof matchEventTypes)[number]

      return prisma.matchDayEventType.create({
        data: {
          matchDayId: match.id,
          eventType: typedEventType,
          category: getEventCategory(typedEventType),
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

  const match = await getOwnedMatch(matchDayId)
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

  const match = await getOwnedMatch(matchDayId)
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

  const match = await getOwnedMatch(matchDayId)
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

  const match = await getOwnedMatch(matchDayId)
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

  const match = await getOwnedMatch(matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'IN_PROGRESS' && match.status !== 'HALF_TIME') {
    return { ok: false, reason: 'Scores can only be changed during live play or half-time.' }
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

  const match = await getOwnedMatch(matchDayId)
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

  if (!matchDayId || !matchDayPlayerId || !eventType) {
    return { ok: false, reason: 'Match, player and event type are required.' }
  }

  if (!matchEventTypes.includes(eventType as (typeof matchEventTypes)[number])) {
    return { ok: false, reason: 'Event type is invalid.' }
  }

  const match = await getOwnedMatch(matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'IN_PROGRESS') {
    return { ok: false, reason: 'Events can only be recorded during live match play.' }
  }

  const selectedEvent = await prisma.matchDayEventType.findFirst({
    where: {
      matchDayId: match.id,
      eventType: eventType as (typeof matchEventTypes)[number],
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
      eventType: eventType as (typeof matchEventTypes)[number],
      half: activeHalf.half,
      matchSecond,
      ownScoreAtTime: match.ownScore,
      oppositionScoreAtTime: match.oppositionScore,
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

  const match = await getOwnedMatch(matchDayId)
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

export default async function MatchDayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getLocalUser()
  const match = await prisma.matchDay.findFirst({
    where: {
      id,
      team: {
        club: {
          userId: user.id,
        },
      },
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
        label: formatEventType(eventType),
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
  const mostInvolvedPlayers = playerEventCounts.slice(0, 3)
  const timelineEvents = match.matchEvents.map((event) => ({
    id: event.id,
    label: formatEventType(event.eventType),
    half: event.half,
    matchSecond: event.matchSecond,
    playerName: event.player
      ? `${event.player.firstName} ${event.player.surname}`
      : 'Unknown player',
    score: `${event.ownScoreAtTime}-${event.oppositionScoreAtTime}`,
  }))
  const finalScore = `${match.ownScore}-${match.oppositionScore}`
  const showHeaderScore = match.status !== 'DRAFT'

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
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

      {match.status !== 'COMPLETED' && match.status !== 'DRAFT' && (
        <section className="mt-6 rounded-2xl bg-gray-50 p-4 sm:p-5">
          <div>
            <h2 className="text-2xl font-bold">Live match</h2>
            <p className="mt-1 text-xs text-gray-500">
              Squad and event setup were locked when the match started.
            </p>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <MatchPitchClient
              matchDayId={match.id}
              status={match.status}
              matchElapsedMilliseconds={matchElapsedMilliseconds}
              players={pitchPlayers}
              togglePlayerOnPitchAction={togglePlayerOnPitch}
            />
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
        </section>
      )}

      {match.status === 'COMPLETED' && (
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
          />
        </section>
      )}
    </main>
  )
}
