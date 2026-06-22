import Link from 'next/link'

import FitnessProgressChart from '@/components/FitnessProgressChart'
import EmptyState from '@/components/ui/EmptyState'
import { accessibleTeamWhere } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type SearchParams = {
  teamId?: string
  fitnessTestTypeId?: string
  playerId?: string
}

type ValidResult = {
  playerId: string
  resultValue: number
  player: {
    firstName: string
    surname: string
    squadNumber: number | null
  }
  fitnessTestSession: {
    id: string
    date: Date
  }
}

type ProgressSummary = {
  first: number
  latest: number
  best: number
  improvement: number
  percentageImprovement: number | null
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)

const formatNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2)

const formatSignedNumber = (value: number) => {
  const formatted = formatNumber(value)
  return value > 0 ? `+${formatted}` : formatted
}

const getImprovement = (first: number, latest: number, higherIsBetter: boolean) => {
  return higherIsBetter ? latest - first : first - latest
}

const getBestResult = (values: number[], higherIsBetter: boolean) => {
  return higherIsBetter ? Math.max(...values) : Math.min(...values)
}

const getPercentageImprovement = (first: number, improvement: number) => {
  if (first === 0) return null
  return (improvement / Math.abs(first)) * 100
}

const getProgressSummary = (
  values: number[],
  higherIsBetter: boolean
): ProgressSummary | null => {
  if (values.length < 2) return null

  const first = values[0]
  const latest = values[values.length - 1]
  const improvement = getImprovement(first, latest, higherIsBetter)

  return {
    first,
    latest,
    best: getBestResult(values, higherIsBetter),
    improvement,
    percentageImprovement: getPercentageImprovement(first, improvement),
  }
}

const getPlayerName = (player: ValidResult['player']) =>
  `${player.firstName} ${player.surname}`

const getProgressInterpretation = ({
  label,
  summary,
  unit,
}: {
  label: string
  summary: ProgressSummary
  unit: string
}) => {
  if (summary.improvement > 0) {
    return `${label} has improved by ${formatNumber(summary.improvement)} ${unit} since the first test. Best result so far is ${formatNumber(summary.best)} ${unit}.`
  }

  if (summary.improvement < 0) {
    return `${label} is ${formatNumber(Math.abs(summary.improvement))} ${unit} behind the first test. Best result so far is ${formatNumber(summary.best)} ${unit}.`
  }

  return `${label} is level with the first test. Best result so far is ${formatNumber(summary.best)} ${unit}.`
}

export default async function FitnessProgressPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { teamId, fitnessTestTypeId, playerId } = await searchParams
  const user = await getCurrentUser()
  const teamWhere = await accessibleTeamWhere(user.id)

  const teams = await prisma.team.findMany({
    where: teamWhere,
    include: {
      club: true,
    },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const fitnessTestTypes = await prisma.fitnessTestType.findMany({
    where: {
      OR: [{ isDefault: true }, { userId: user.id }],
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const selectedTeam = teamId
    ? await prisma.team.findFirst({
        where: {
          AND: [teamWhere],
          id: teamId,
        },
        include: {
          club: true,
        },
      })
    : null

  const selectedFitnessTestType = fitnessTestTypeId
    ? await prisma.fitnessTestType.findFirst({
        where: {
          id: fitnessTestTypeId,
          OR: [{ isDefault: true }, { userId: user.id }],
        },
      })
    : null

  const activePlayers = selectedTeam
    ? await prisma.player.findMany({
        where: {
          teamId: selectedTeam.id,
          isActive: true,
        },
        orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
      })
    : []

  const rawResults =
    selectedTeam && selectedFitnessTestType
      ? await prisma.fitnessTestResult.findMany({
          where: {
            resultValue: {
              not: null,
            },
            fitnessTestSession: {
              teamId: selectedTeam.id,
              fitnessTestTypeId: selectedFitnessTestType.id,
              status: 'COMPLETED',
            },
          },
          include: {
            player: true,
            fitnessTestSession: true,
          },
          orderBy: {
            fitnessTestSession: {
              date: 'asc',
            },
          },
        })
      : []

  const validResults: ValidResult[] = rawResults.flatMap((result) => {
    if (result.resultValue === null) return []

    return [
      {
        playerId: result.playerId,
        resultValue: result.resultValue,
        player: result.player,
        fitnessTestSession: result.fitnessTestSession,
      },
    ]
  })

  const resultsByPlayer = new Map<string, ValidResult[]>()

  for (const result of validResults) {
    const playerResults = resultsByPlayer.get(result.playerId) ?? []
    playerResults.push(result)
    resultsByPlayer.set(result.playerId, playerResults)
  }

  const sessionAverages = Array.from(
    validResults.reduce((sessions, result) => {
      const session = sessions.get(result.fitnessTestSession.id) ?? {
        date: result.fitnessTestSession.date,
        values: [] as number[],
      }

      session.values.push(result.resultValue)
      sessions.set(result.fitnessTestSession.id, session)
      return sessions
    }, new Map<string, { date: Date; values: number[] }>())
  )
    .map(([sessionId, session]) => ({
      sessionId,
      date: session.date,
      average:
        session.values.reduce((total, value) => total + value, 0) /
        session.values.length,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const teamSummary = selectedFitnessTestType
    ? getProgressSummary(
        sessionAverages.map((session) => session.average),
        selectedFitnessTestType.higherIsBetter
      )
    : null

  const selectedPlayerResults = playerId
    ? resultsByPlayer.get(playerId) ?? []
    : []
  const selectedPlayer = playerId
    ? activePlayers.find((player) => player.id === playerId) ?? null
    : null
  const selectedPlayerSummary = selectedFitnessTestType
    ? getProgressSummary(
        selectedPlayerResults.map((result) => result.resultValue),
        selectedFitnessTestType.higherIsBetter
      )
    : null

  const biggestImprovers = selectedFitnessTestType
    ? Array.from(resultsByPlayer.values())
        .map((playerResults) => {
          const sortedResults = [...playerResults].sort(
            (a, b) =>
              a.fitnessTestSession.date.getTime() -
              b.fitnessTestSession.date.getTime()
          )
          const summary = getProgressSummary(
            sortedResults.map((result) => result.resultValue),
            selectedFitnessTestType.higherIsBetter
          )

          if (!summary) return null

          return {
            player: sortedResults[0].player,
            summary,
          }
        })
        .filter((item): item is { player: ValidResult['player']; summary: ProgressSummary } =>
          Boolean(item)
        )
        .sort((a, b) => b.summary.improvement - a.summary.improvement)
    : []

  const chartData = selectedPlayer
    ? selectedPlayerResults.map((result) => ({
        label: formatDate(result.fitnessTestSession.date),
        value: result.resultValue,
      }))
    : sessionAverages.map((session) => ({
        label: formatDate(session.date),
        value: Number(session.average.toFixed(2)),
      }))

  const hasSelection = Boolean(selectedTeam && selectedFitnessTestType)
  const hasEnoughData = validResults.length > 0 && sessionAverages.length >= 2

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fitness Progress</h1>
        <p className="mt-1 text-sm text-gray-500">
            Track player and team improvement across completed fitness tests.
          </p>
        </div>

        <Link href="/fitness" className="text-sm text-blue-600 hover:underline">
          Back to Fitness
        </Link>
      </div>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 text-xl font-bold">Select Report</h2>

        <form className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">
            Team
            <select
              name="teamId"
              required
              defaultValue={teamId ?? ''}
              className="mt-1 w-full rounded border p-2"
            >
              <option value="" disabled>
                Select team
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.club.name} - {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Test type
            <select
              name="fitnessTestTypeId"
              required
              defaultValue={fitnessTestTypeId ?? ''}
              className="mt-1 w-full rounded border p-2"
            >
              <option value="" disabled>
                Select test type
              </option>
              {fitnessTestTypes.map((fitnessTestType) => (
                <option key={fitnessTestType.id} value={fitnessTestType.id}>
                  {fitnessTestType.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Player optional
            <select
              name="playerId"
              defaultValue={playerId ?? ''}
              className="mt-1 w-full rounded border p-2"
            >
              <option value="">Team average</option>
              {activePlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.firstName} {player.surname}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end md:col-span-3">
            <button className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white">
              View Progress
            </button>
          </div>
        </form>
      </section>

      {!hasSelection ? (
        <EmptyState
          eyebrow="Progress report"
          title="Choose a team and test"
          description="Select a team and test from the report filters to see coach-friendly trend summaries and progress charts."
        />
      ) : !hasEnoughData ? (
        <EmptyState
          eyebrow="More data needed"
          title="Progress needs two completed tests"
          description="At least two completed sessions with valid numeric results are needed before the app can show trends, improvement and biggest improvers."
        />
      ) : (
        <div className="space-y-8">
          {selectedTeam && selectedFitnessTestType && teamSummary && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-bold">Team Progress</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedTeam.club.name} - {selectedTeam.name} /{' '}
                  {selectedFitnessTestType.name}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryCard
                  label="First Average"
                  value={`${formatNumber(teamSummary.first)} ${selectedFitnessTestType.resultUnit}`}
                />
                <SummaryCard
                  label="Latest Average"
                  value={`${formatNumber(teamSummary.latest)} ${selectedFitnessTestType.resultUnit}`}
                />
                <SummaryCard
                  label="Best Average"
                  value={`${formatNumber(teamSummary.best)} ${selectedFitnessTestType.resultUnit}`}
                />
                <SummaryCard
                  label="Improvement"
                  value={`${formatSignedNumber(teamSummary.improvement)} ${selectedFitnessTestType.resultUnit}`}
                  detail={
                    teamSummary.percentageImprovement === null
                      ? undefined
                      : `${teamSummary.percentageImprovement.toFixed(1)}%`
                  }
                />
              </div>

              <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-medium leading-6 text-blue-900">
                {getProgressInterpretation({
                  label: 'Team average',
                  summary: teamSummary,
                  unit: selectedFitnessTestType.resultUnit,
                })}
              </p>
            </section>
          )}

          {selectedPlayer && selectedPlayerSummary && selectedFitnessTestType && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">Player Progress</h2>

              <div className="grid gap-3 sm:grid-cols-4">
                <SummaryCard
                  label="First Result"
                  value={`${formatNumber(selectedPlayerSummary.first)} ${selectedFitnessTestType.resultUnit}`}
                />
                <SummaryCard
                  label="Latest Result"
                  value={`${formatNumber(selectedPlayerSummary.latest)} ${selectedFitnessTestType.resultUnit}`}
                />
                <SummaryCard
                  label="Best Result"
                  value={`${formatNumber(selectedPlayerSummary.best)} ${selectedFitnessTestType.resultUnit}`}
                />
                <SummaryCard
                  label="Improvement"
                  value={`${formatSignedNumber(selectedPlayerSummary.improvement)} ${selectedFitnessTestType.resultUnit}`}
                  detail={
                    selectedPlayerSummary.percentageImprovement === null
                      ? undefined
                      : `${selectedPlayerSummary.percentageImprovement.toFixed(1)}%`
                  }
                />
              </div>

              <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-medium leading-6 text-blue-900">
                {getProgressInterpretation({
                  label: getPlayerName(selectedPlayer),
                  summary: selectedPlayerSummary,
                  unit: selectedFitnessTestType.resultUnit,
                })}
              </p>
            </section>
          )}

          {chartData.length >= 2 && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">
                {selectedPlayer ? 'Player Trend' : 'Team Average Trend'}
              </h2>
              <FitnessProgressChart data={chartData} />
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-xl font-bold">Biggest Improvers</h2>

            {biggestImprovers.length === 0 ? (
              <EmptyState
                title="No biggest improvers yet"
                description="Players need at least two valid numeric results in completed sessions before improvement can be ranked."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left">Player</th>
                      <th className="p-3 text-left">First</th>
                      <th className="p-3 text-left">Latest</th>
                      <th className="p-3 text-left">Improvement</th>
                      <th className="p-3 text-left">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biggestImprovers.map((item) => (
                      <tr
                        key={`${item.player.firstName}-${item.player.surname}-${item.player.squadNumber}`}
                        className="border-b last:border-b-0"
                      >
                        <td className="p-3">{getPlayerName(item.player)}</td>
                        <td className="p-3">{formatNumber(item.summary.first)}</td>
                        <td className="p-3">{formatNumber(item.summary.latest)}</td>
                        <td className="p-3 font-medium">
                          {formatSignedNumber(item.summary.improvement)}
                        </td>
                        <td className="p-3">
                          {item.summary.percentageImprovement === null
                            ? 'N/A'
                            : `${item.summary.percentageImprovement.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {detail && <div className="mt-1 text-sm text-gray-500">{detail}</div>}
    </div>
  )
}
