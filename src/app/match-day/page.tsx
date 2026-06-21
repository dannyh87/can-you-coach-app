import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import MatchDayClient from '@/app/match-day/MatchDayClient'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { ensureDefaultClub, getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const matchTypes = ['LEAGUE', 'CUP', 'FRIENDLY'] as const
const matchVenues = ['HOME', 'AWAY', 'NEUTRAL'] as const

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
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

async function userOwnsTeam(userId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      club: {
        userId,
      },
    },
    select: { id: true },
  })

  return Boolean(team)
}

async function createMatchDay(formData: FormData): Promise<MatchActionResult> {
  'use server'

  const user = await getLocalUser()
  const teamId = getTextValue(formData, 'teamId')
  const date = getTextValue(formData, 'date')
  const kickoffTime = getTextValue(formData, 'kickoffTime')
  const opposition = getTextValue(formData, 'opposition')
  const matchType = getTextValue(formData, 'matchType')
  const venue = getTextValue(formData, 'venue')

  if (!teamId || !date || !kickoffTime || !opposition || !matchType || !venue) {
    return {
      ok: false,
      reason: 'Team, date, kick-off time, opposition, match type and venue are required.',
    }
  }

  if (!matchTypes.includes(matchType as (typeof matchTypes)[number])) {
    return { ok: false, reason: 'Match type is invalid.' }
  }

  if (!matchVenues.includes(venue as (typeof matchVenues)[number])) {
    return { ok: false, reason: 'Venue is invalid.' }
  }

  if (!(await userOwnsTeam(user.id, teamId))) {
    return { ok: false, reason: 'You cannot create a match for this team.' }
  }

  const kickoffAt = new Date(`${date}T${kickoffTime}:00`)
  if (Number.isNaN(kickoffAt.getTime())) {
    return { ok: false, reason: 'Kick-off date or time is invalid.' }
  }

  await prisma.matchDay.create({
    data: {
      teamId,
      kickoffAt,
      opposition,
      matchType: matchType as (typeof matchTypes)[number],
      venue: venue as (typeof matchVenues)[number],
    },
  })

  revalidatePath('/match-day')
  return { ok: true }
}

export default async function MatchDayPage() {
  const user = await getLocalUser()
  await ensureDefaultClub(user.id)

  const teams = await prisma.team.findMany({
    where: {
      club: {
        userId: user.id,
      },
    },
    include: { club: true },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const matches = await prisma.matchDay.findMany({
    where: {
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
    orderBy: { kickoffAt: 'desc' },
  })

  const teamOptions = teams.map((team) => ({
    id: team.id,
    name: team.name,
    clubName: team.club.name,
  }))

  const matchRows = matches.map((match) => ({
    id: match.id,
    dateDisplay: formatDate(match.kickoffAt),
    kickoffTimeDisplay: formatTime(match.kickoffAt),
    opposition: match.opposition,
    teamName: match.team.name,
    clubName: match.team.club.name,
    matchType: match.matchType,
    matchTypeLabel: formatMatchType(match.matchType),
    venue: match.venue,
    venueLabel: formatVenue(match.venue),
    ownScore: match.ownScore,
    oppositionScore: match.oppositionScore,
    status: match.status,
    statusLabel: formatStatus(match.status),
    statusClasses: getStatusClasses(match.status),
  }))

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Match Day"
        description="Set up fixtures, prepare the squad, track minutes and capture the moments that matter."
        actions={(
          <Link href="/club-setup" className="text-sm font-semibold text-blue-800 hover:underline">
            Club Setup
          </Link>
        )}
      />

      {teams.length === 0 ? (
        <EmptyState
          title="Create a team first"
          description="Match days must belong to a team."
          action={(
          <Link
            href="/club-setup"
            className="inline-flex"
          >
            <Button>Go to Club Setup</Button>
          </Link>
          )}
        />
      ) : (
        <MatchDayClient
          teams={teamOptions}
          matches={matchRows}
          createMatchDayAction={createMatchDay}
        />
      )}
    </main>
  )
}
