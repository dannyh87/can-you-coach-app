import type { FitnessResultStatus } from '@prisma/client'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import FitnessTestGuidance from '@/components/FitnessTestGuidance'
import EmptyState from '@/components/ui/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import { canViewFitnessSession } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

const formatStatus = (status: FitnessResultStatus) => {
  const labels: Record<FitnessResultStatus, string> = {
    COMPLETED: 'Completed',
    DID_NOT_START: 'Did not start',
    INJURED: 'Injured',
    ABSENT: 'Absent',
    DROPPED_OUT: 'Dropped out',
  }

  return labels[status]
}

const formatResult = ({
  resultText,
  resultValue,
  unit,
}: {
  resultText: string | null
  resultValue: number | null
  unit: string
}) => resultText || `${resultValue ?? 0} ${unit}`

export default async function FitnessSessionRankingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!(await canViewFitnessSession(user.id, id))) notFound()

  const session = await prisma.fitnessTestSession.findFirst({
    where: {
      id,
    },
    include: {
      team: {
        include: {
          club: true,
        },
      },
      fitnessTestType: true,
    },
  })

  if (!session) notFound()

  const results = await prisma.fitnessTestResult.findMany({
    where: { fitnessTestSessionId: session.id },
    include: { player: true },
  })

  const activePlayers = await prisma.player.findMany({
    where: {
      teamId: session.teamId,
      isActive: true,
    },
    orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
  })

  const resultsByPlayerId = new Map(
    results.map((result) => [result.playerId, result])
  )

  const rankedResults = results
    .filter((result) => result.resultValue !== null)
    .sort((a, b) => {
      const firstValue = a.resultValue ?? 0
      const secondValue = b.resultValue ?? 0

      if (session.fitnessTestType.higherIsBetter) {
        return secondValue - firstValue
      }

      return firstValue - secondValue
    })

  const missingResults = activePlayers.filter((player) => {
    const result = resultsByPlayerId.get(player.id)
    return !result || result.resultValue === null
  })
  const topResult = rankedResults[0]
  const rankingDirectionLabel = session.fitnessTestType.higherIsBetter
    ? 'Higher scores rank first.'
    : 'Lower scores rank first.'

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/fitness" className="text-blue-600 hover:underline">
          Back to Fitness
        </Link>
        <Link
          href={`/fitness/sessions/${session.id}`}
          className="text-blue-600 hover:underline"
        >
          {session.status === 'COMPLETED' ? 'View Results' : 'Enter Results'}
        </Link>
      </div>

      <section className="mt-6 rounded-xl border p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">
              {session.fitnessTestType.name} Rankings
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {session.team.club.name} - {session.team.name}
            </p>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {formatDate(session.date)}
          </span>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-gray-500">Result unit</dt>
            <dd>{session.fitnessTestType.resultUnit}</dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">Ranking direction</dt>
            <dd>
              {session.fitnessTestType.higherIsBetter
                ? 'Higher is better'
                : 'Lower is better'}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">Ranked results</dt>
            <dd>{rankedResults.length}</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h2 className="text-lg font-bold text-blue-950">Coach summary</h2>
          <p className="mt-1 text-sm leading-6 text-blue-900">
            {topResult
              ? `${topResult.player.firstName} ${topResult.player.surname} currently leads this test with ${formatResult({ resultText: topResult.resultText, resultValue: topResult.resultValue, unit: session.fitnessTestType.resultUnit })}.`
              : 'No player has a ranked numeric result yet.'}{' '}
            {rankingDirectionLabel} {rankedResults.length} player{rankedResults.length === 1 ? '' : 's'} ranked; {missingResults.length} active player{missingResults.length === 1 ? '' : 's'} still need a numeric result before they can be ranked.
          </p>
        </div>

        <FitnessTestGuidance
          guidance={session.fitnessTestType}
          title="What does this score mean?"
          compact
          collapsible
          showSetup={false}
          className="mt-4"
        />
      </section>

      <section className="mt-6 space-y-4">
        <h2 className="text-xl font-bold">Ranked Results</h2>

        {rankedResults.length === 0 ? (
          <EmptyState
            title="No ranked results yet"
            description="Enter numeric results for this session before using rankings. Display-only text can be saved, but rankings need a numeric value."
            action={(
              <Link
                href={`/fitness/sessions/${session.id}`}
                className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                {session.status === 'COMPLETED' ? 'View Results' : 'Enter Results'}
              </Link>
            )}
          />
        ) : (
          <div className="rounded-lg border">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-12 sm:w-16" />
                <col />
                <col className="w-24 sm:w-36" />
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-2 py-2 text-left sm:px-3">Rank</th>
                  <th className="px-2 py-2 text-left sm:px-3">Player</th>
                  <th className="px-2 py-2 text-right sm:px-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {rankedResults.map((result, index) => (
                  <tr key={result.id} className="border-b last:border-b-0">
                    <td className="px-2 py-2 align-top font-bold sm:px-3">{index + 1}</td>
                    <td className="break-words px-2 py-2 align-top sm:px-3">
                      {result.player.firstName} {result.player.surname}
                    </td>
                    <td className="px-2 py-2 text-right align-top font-medium sm:px-3">
                      {formatResult({
                        resultText: result.resultText,
                        resultValue: result.resultValue,
                        unit: session.fitnessTestType.resultUnit,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-xl font-bold">Missing / Invalid Active Players</h2>
          <p className="mt-1 text-sm text-gray-500">
            These active players do not have a valid numeric result for ranking.
          </p>
        </div>

        {missingResults.length === 0 ? (
          <EmptyState
            title="Every active player is ranked"
            description="All active players have a valid numeric result for this session. Use this table as the complete squad ranking."
          />
        ) : (
          <div className="rounded-lg border">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[44%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-2 py-2 text-left sm:px-3">Player</th>
                  <th className="px-2 py-2 text-left sm:px-3">Issue / Reason</th>
                </tr>
              </thead>
              <tbody>
                {missingResults.map((player) => {
                  const result = resultsByPlayerId.get(player.id)
                  const issue = result
                    ? result.resultText
                      ? `Result text only: ${result.resultText}`
                      : `No numeric result (${formatStatus(result.status)})`
                    : 'No result saved'

                  return (
                    <tr key={player.id} className="border-b last:border-b-0">
                      <td className="break-words px-2 py-2 align-top sm:px-3">
                        {player.firstName} {player.surname}
                      </td>
                      <td className="break-words px-2 py-2 align-top sm:px-3">{issue}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
