import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import MatchControlClient from '@/app/match-day/[id]/MatchControlClient'
import MatchEventsClient from '@/app/match-day/[id]/MatchEventsClient'
import MatchPitchClient from '@/app/match-day/[id]/MatchPitchClient'
import MatchSquadClient from '@/app/match-day/[id]/MatchSquadClient'
import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const
const pitchTargetStates = ['ON', 'OFF'] as const
const matchEventTypes = [
  'GOAL',
  'ASSIST',
  'SHOT_ON_TARGET',
  'SHOT_OFF_TARGET',
  'PASS_COMPLETE',
  'PASS_INCOMPLETE',
  'ONE_V_ONE_SUCCESS',
  'ONE_V_ONE_UNSUCCESSFUL',
] as const

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

async function setupMatchSquad(formData: FormData): Promise<SquadActionResult> {
  'use server'

  const matchDayId = getTextValue(formData, 'matchDayId')
  if (!matchDayId) return { ok: false, reason: 'Missing match.' }

  const match = await getOwnedMatch(matchDayId)
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed matches are read-only.' }
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
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed matches are read-only.' }
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
    },
    create: {
      matchDayId: match.id,
      playerId: player.id,
      squadStatus: squadStatus as (typeof squadStatuses)[number],
      startingPosition: startingPosition || null,
      shirtNumberSnapshot: player.squadNumber,
    },
  })

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

  await prisma.$transaction([
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
  if (match.status === 'COMPLETED') {
    return { ok: false, reason: 'Completed match scores are read-only.' }
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
    },
  })

  if (!squadPlayer) {
    return { ok: false, reason: 'Player is not available in this match squad.' }
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
        orderBy: { createdAt: 'desc' },
        take: 20,
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
      hasSquadRecord: Boolean(squadRecord),
    }
  })
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
        isOnPitch: Boolean(openStint),
        openStintStartedAt: openStint?.startedAt.toISOString() ?? null,
        totalMilliseconds,
      }
    })
  const eventPlayers = pitchPlayers
    .filter((player) => player.isOnPitch)
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

      <section className="rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{headline}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {formatDate(match.kickoffAt)} · {matchTypeLabel} · {venueLabel} ·{' '}
              {statusLabel}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(match.status)}`}>
            {statusLabel}
          </span>
        </div>

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
      </section>

      <section className="mt-6 rounded-xl border p-6">
        <h2 className="text-xl font-bold">Match details</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Team" value={`${match.team.club.name} / ${match.team.name}`} />
          <DetailItem label="Opposition" value={match.opposition} />
          <DetailItem label="Kick-off" value={formatDateTime(match.kickoffAt)} />
          <DetailItem label="Match type" value={matchTypeLabel} />
          <DetailItem label="Venue" value={venueLabel} />
          <DetailItem label="Status" value={statusLabel} />
          <DetailItem label="Own score" value={String(match.ownScore)} />
          <DetailItem label="Opposition score" value={String(match.oppositionScore)} />
          <DetailItem
            label="Completed"
            value={match.completedAt ? formatDateTime(match.completedAt) : 'Not completed'}
          />
        </dl>
      </section>

      {match.status === 'COMPLETED' && (
        <p className="mt-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          This match is completed and read-only in this skeleton.
        </p>
      )}

      <section className="mt-6">
        <MatchPitchClient
          matchDayId={match.id}
          status={match.status}
          matchElapsedMilliseconds={matchElapsedMilliseconds}
          players={pitchPlayers}
          togglePlayerOnPitchAction={togglePlayerOnPitch}
        />
      </section>

      <section className="mt-6">
        <MatchSquadClient
          matchDayId={match.id}
          isReadOnly={match.status === 'COMPLETED'}
          hasSquadRecords={match.matchDayPlayers.length > 0}
          players={squadPlayers}
          setupMatchSquadAction={setupMatchSquad}
          updateMatchSquadPlayerAction={updateMatchSquadPlayer}
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <MatchEventsClient
          matchDayId={match.id}
          status={match.status}
          players={eventPlayers}
          events={recentEvents}
          recordMatchEventAction={recordMatchEvent}
          deleteMatchEventAction={deleteMatchEvent}
        />
        <PlaceholderPanel
          title="Summary"
          description="Post-match summary and reporting will use future match events."
        />
      </section>

      <p className="mt-6 rounded-lg border p-4 text-sm text-gray-500">
        TODO: Add an edit match modal in a later Match Day chunk.
      </p>
    </main>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 font-semibold text-gray-950">{value}</dd>
    </div>
  )
}

function PlaceholderPanel({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-dashed p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        Coming next
      </p>
    </div>
  )
}
