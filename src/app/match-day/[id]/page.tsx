import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import MatchControlClient from '@/app/match-day/[id]/MatchControlClient'
import MatchSquadClient from '@/app/match-day/[id]/MatchSquadClient'
import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

const squadStatuses = ['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as const

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

  await prisma.matchDay.update({
    where: { id: match.id },
    data: {
      status: 'IN_PROGRESS',
      firstHalfStartedAt: new Date(),
    },
  })

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

  await prisma.matchDay.update({
    where: { id: match.id },
    data: {
      status: 'HALF_TIME',
      firstHalfEndedAt: new Date(),
    },
  })

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

  await prisma.matchDay.update({
    where: { id: match.id },
    data: {
      status: 'IN_PROGRESS',
      secondHalfStartedAt: new Date(),
    },
  })

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
  await prisma.matchDay.update({
    where: { id: match.id },
    data: {
      status: 'COMPLETED',
      secondHalfEndedAt: now,
      completedAt: now,
    },
  })

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
