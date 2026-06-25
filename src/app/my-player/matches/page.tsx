import Link from 'next/link'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)

const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

const getStatusClasses = (status: string) => {
  if (status === 'IN_PROGRESS') return 'bg-blue-100 text-blue-800'
  if (status === 'HALF_TIME') return 'bg-amber-100 text-amber-900'
  if (status === 'COMPLETED') return 'bg-green-100 text-green-800'
  return 'bg-slate-100 text-slate-700'
}

export default async function ParentMatchesPage() {
  const user = await getCurrentUser()
  const linkedPlayers = await prisma.spectatorAccess.findMany({
    where: { userId: user.id },
    select: { clubId: true, playerId: true },
  })

  const linkedPlayerIds = linkedPlayers.map((access) => access.playerId)
  const linkedClubIds = linkedPlayers.map((access) => access.clubId)

  const matches = linkedPlayerIds.length === 0
    ? []
    : await prisma.matchDay.findMany({
      where: {
        status: { not: 'DRAFT' },
        team: { clubId: { in: linkedClubIds } },
        matchDayPlayers: {
          some: {
            playerId: { in: linkedPlayerIds },
            squadStatus: { not: 'NOT_INVOLVED' },
          },
        },
      },
      include: {
        team: { include: { club: true } },
        matchDayPlayers: {
          where: {
            playerId: { in: linkedPlayerIds },
            squadStatus: { not: 'NOT_INVOLVED' },
          },
          include: { player: true },
          orderBy: { player: { surname: 'asc' } },
        },
        submittedMatchEvents: {
          where: { submittedByUserId: user.id },
          select: { id: true, status: true },
        },
      },
      orderBy: { kickoffAt: 'desc' },
    })

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader
        title="Match Observations"
        description="Submit lightweight observations for the player or players linked to your account."
      />

      {matches.length === 0 ? (
        <EmptyState
          title="No available matches"
          description="Matches appear here when your linked player is included in a live, half-time or completed Match Day squad."
        />
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <Link
              key={match.id}
              href={`/my-player/matches/${match.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    {match.team.club.name} / {match.team.name}
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Vs {match.opposition}</h2>
                  <p className="mt-1 text-sm text-slate-600">{formatDateTime(match.kickoffAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(match.status)}`}>
                  {formatStatus(match.status)}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-700">
                Linked player{match.matchDayPlayers.length === 1 ? '' : 's'}:{' '}
                <span className="font-semibold">
                  {match.matchDayPlayers.map((matchPlayer) => `${matchPlayer.player.firstName} ${matchPlayer.player.surname}`).join(', ')}
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {match.submittedMatchEvents.length} observation{match.submittedMatchEvents.length === 1 ? '' : 's'} submitted by you.
              </p>
            </Link>
          ))}
        </div>
      )}

      <Link href="/my-player" className="mt-6 inline-flex text-sm font-semibold text-blue-800 hover:underline">
        Back to My Player
      </Link>
    </main>
  )
}
