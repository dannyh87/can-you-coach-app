import Link from 'next/link'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const formatDate = (date: Date | null) => date ? new Intl.DateTimeFormat('en-GB').format(date) : 'Not set'

const formatResult = ({
  resultText,
  resultValue,
  unit,
}: {
  resultText: string | null
  resultValue: number | null
  unit: string
}) => resultText || (resultValue !== null ? `${resultValue} ${unit}` : 'No result')

const formatMatchStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

export default async function MyPlayerPage() {
  const user = await getCurrentUser()
  const spectatorAccessRows = await prisma.spectatorAccess.findMany({
    where: { userId: user.id },
    include: {
      club: true,
      player: {
        include: {
          team: true,
        },
      },
    },
    orderBy: [{ club: { name: 'asc' } }, { player: { surname: 'asc' } }, { player: { firstName: 'asc' } }],
  })

  if (spectatorAccessRows.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
        <PageHeader
          title="My Player"
          description="View the player profile, fitness results and match summaries linked to your account."
        />
        <EmptyState
          title="Waiting for your player link"
          description="Ask your coach or club official to invite you to a player. Once you accept the invite, your player will appear here. Open invite links directly and sign in with the invited email address."
          action={(
            <Link href="/" className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
              Back to dashboard
            </Link>
          )}
        />
      </main>
    )
  }

  const linkedPlayerRows = await Promise.all(
    spectatorAccessRows.map(async (spectatorAccess) => {
      const [fitnessResults, matchDayPlayers] = await Promise.all([
        prisma.fitnessTestResult.findMany({
          where: {
            playerId: spectatorAccess.playerId,
            fitnessTestSession: {
              team: {
                clubId: spectatorAccess.clubId,
              },
            },
          },
          include: {
            fitnessTestSession: {
              include: {
                fitnessTestType: true,
              },
            },
          },
          orderBy: {
            fitnessTestSession: {
              date: 'desc',
            },
          },
          take: 8,
        }),
        prisma.matchDayPlayer.findMany({
          where: {
            playerId: spectatorAccess.playerId,
            matchDay: {
              team: {
                clubId: spectatorAccess.clubId,
              },
            },
          },
          include: {
            matchDay: true,
            stints: true,
          },
          orderBy: {
            matchDay: {
              kickoffAt: 'desc',
            },
          },
          take: 8,
        }),
      ])

      return { spectatorAccess, fitnessResults, matchDayPlayers }
    })
  )

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-6">
      <PageHeader
        title="My Player"
        description="View linked-player details, recent results and match observation access."
      />
      <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-950">
        You are linked to {linkedPlayerRows.length} player{linkedPlayerRows.length === 1 ? '' : 's'}. Player profile and result history are read-only; live match observations are available when coaches start a match.
      </p>
      <Link
        href="/my-player/matches"
        className="mb-6 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
      >
        Match observations
      </Link>

      <div className="space-y-6">
        {linkedPlayerRows.map(({ spectatorAccess, fitnessResults, matchDayPlayers }) => {
          const player = spectatorAccess.player

          return (
            <section key={spectatorAccess.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Linked player</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-wide text-slate-500">
                {spectatorAccess.club.name} / {player.team.name}
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-slate-950">
                {player.firstName} {player.surname}
              </h1>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-500">Squad No.</dt>
                  <dd className="mt-1 text-lg font-bold">{player.squadNumber ?? 'Not set'}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-500">Position</dt>
                  <dd className="mt-1 text-lg font-bold">{player.preferredPosition ?? 'Not set'}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-500">Date of birth</dt>
                  <dd className="mt-1 text-lg font-bold">{formatDate(player.dateOfBirth)}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="font-semibold text-slate-500">Joined</dt>
                  <dd className="mt-1 text-lg font-bold">{formatDate(player.joinedClubDate)}</dd>
                </div>
              </dl>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Recent Fitness Results</h2>
                  {fitnessResults.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      No fitness results available for this player yet.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {fitnessResults.map((result) => (
                        <div key={result.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-950">{result.fitnessTestSession.fitnessTestType.name}</p>
                              <p className="text-sm text-slate-500">{formatDate(result.fitnessTestSession.date)}</p>
                            </div>
                            <p className="font-bold text-blue-800">
                              {formatResult({
                                resultText: result.resultText,
                                resultValue: result.resultValue,
                                unit: result.fitnessTestSession.fitnessTestType.resultUnit,
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-950">Recent Match Reports</h2>
                  {matchDayPlayers.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      No match reports available for this player yet.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {matchDayPlayers.map((matchDayPlayer) => {
                        const minutes = Math.round(
                          matchDayPlayer.stints.reduce((total, stint) => {
                            const endedAt = stint.endedAt ?? stint.startedAt
                            return total + Math.max(0, endedAt.getTime() - stint.startedAt.getTime())
                          }, 0) / 60000
                        )

                        return (
                          <div key={matchDayPlayer.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-950">Vs {matchDayPlayer.matchDay.opposition}</p>
                                <p className="text-sm text-slate-500">{formatDate(matchDayPlayer.matchDay.kickoffAt)}</p>
                              </div>
                              <p className="font-bold text-slate-900">
                                {matchDayPlayer.matchDay.ownScore}-{matchDayPlayer.matchDay.oppositionScore}
                              </p>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {formatMatchStatus(matchDayPlayer.matchDay.status)}. Approx. {minutes} minutes recorded.
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Need club, squad or admin access? Ask the club owner to update your role. Linked-player access stays separate from club membership.
      </p>
      <Link href="/" className="mt-3 inline-flex text-sm font-semibold text-blue-800 hover:underline">
        Back to Home
      </Link>
    </main>
  )
}
