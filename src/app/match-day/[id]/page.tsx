import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import MatchSquadClient from '@/app/match-day/[id]/MatchSquadClient'
import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const

type SquadActionResult =
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
        },
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

        <div className="mt-6 rounded-lg border bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-500">Score</p>
          <p className="mt-2 text-5xl font-bold tabular-nums">
            {match.ownScore}-{match.oppositionScore}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {match.team.club.name} · {match.team.name}
          </p>
        </div>
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
        </dl>
      </section>

      {match.status === 'COMPLETED' && (
        <p className="mt-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          This match is completed and read-only in this skeleton.
        </p>
      )}

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
        <PlaceholderPanel
          title="Match timer"
          description="Live clock controls are coming in a later chunk."
        />
        <PlaceholderPanel
          title="Events"
          description="Goals, substitutions and custom event recording are not enabled yet."
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
