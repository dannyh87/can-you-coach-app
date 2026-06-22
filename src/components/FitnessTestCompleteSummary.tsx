import Link from 'next/link'

type SummaryPlayer = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  result: {
    resultValue: number | null
    resultText: string | null
  } | null
}

type FitnessTestCompleteSummaryProps = {
  title: string
  description: string
  testTypeName: string
  teamName: string
  dateLabel: string
  sessionStatusLabel: string
  startedAtLabel: string
  completedAtLabel: string
  resultCount: number
  players: SummaryPlayer[]
  resultUnit: string
  higherIsBetter: boolean
  statusLabel: string
  rankingsHref: string
  progressHref: string
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const formatResult = (
  result: SummaryPlayer['result'],
  resultUnit: string
) => {
  if (!result) return 'Missing'
  if (result.resultText) return result.resultText
  if (result.resultValue !== null) return `${result.resultValue} ${resultUnit}`
  return 'Recorded'
}

const getPlayerName = (player: SummaryPlayer) =>
  `${player.firstName} ${player.surname}`

export default function FitnessTestCompleteSummary({
  title,
  description,
  testTypeName,
  teamName,
  dateLabel,
  sessionStatusLabel,
  startedAtLabel,
  completedAtLabel,
  resultCount,
  players,
  resultUnit,
  higherIsBetter,
  statusLabel,
  rankingsHref,
  progressHref,
}: FitnessTestCompleteSummaryProps) {
  const rankedPlayers = players
    .filter((player) => player.result)
    .sort((a, b) => {
      const firstValue = a.result?.resultValue
      const secondValue = b.result?.resultValue

      if (firstValue === null || firstValue === undefined) return 1
      if (secondValue === null || secondValue === undefined) return -1

      return higherIsBetter ? secondValue - firstValue : firstValue - secondValue
    })
  const topPerformer = rankedPlayers[0]
  const bottomPerformer = rankedPlayers[rankedPlayers.length - 1]
  const playersWithResults = players.filter((player) => player.result).length
  const rankingDirectionLabel = higherIsBetter
    ? 'Higher scores appear higher in the ranking.'
    : 'Lower scores appear higher in the ranking.'
  const metadata = [
    { label: 'Test type', value: testTypeName },
    { label: 'Team', value: teamName },
    { label: 'Date', value: dateLabel },
    { label: 'Status', value: sessionStatusLabel },
    { label: 'Started', value: startedAtLabel },
    { label: 'Completed', value: completedAtLabel },
    { label: 'Results saved', value: String(resultCount) },
  ]

  return (
    <section className="space-y-5 rounded-xl border border-green-200 bg-green-50/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold">{title}</h2>
            <span className="rounded-full bg-green-700 px-3 py-1 text-xs font-medium text-white">
              {sessionStatusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={rankingsHref}
            className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Full Rankings
          </Link>
          <Link
            href={progressHref}
            className="inline-flex rounded border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700"
          >
            Progress
          </Link>
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {metadata.map((item) => (
          <div key={item.label}>
            <dt className="font-medium text-gray-500">{item.label}</dt>
            <dd className="mt-1 font-semibold text-gray-950">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-medium leading-6 text-blue-900">
        {playersWithResults} player{playersWithResults === 1 ? '' : 's'} have saved results for this completed test. {rankingDirectionLabel} Use rankings for the full order and progress to compare against previous completed tests.
      </p>

      {topPerformer && bottomPerformer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-green-200 bg-white p-3">
            <p className="text-sm font-medium text-green-800">Top performer</p>
            <p className="mt-1 font-bold">{getPlayerName(topPerformer)}</p>
            <p className="text-sm text-green-900">
              {formatResult(topPerformer.result, resultUnit)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm font-medium text-gray-700">Bottom performer</p>
            <p className="mt-1 font-bold">{getPlayerName(bottomPerformer)}</p>
            <p className="text-sm text-gray-700">
              {formatResult(bottomPerformer.result, resultUnit)}
            </p>
          </div>
        </div>
      )}

      {rankedPlayers.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          No player results were saved for this completed test.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left">Rank</th>
                <th className="p-3 text-left">Player</th>
                <th className="p-3 text-left">Squad number</th>
                <th className="p-3 text-left">Result</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((player, index) => (
                <tr key={player.id} className="border-b last:border-b-0">
                  <td className="p-3 font-bold">{index + 1}</td>
                  <td className="p-3">{getPlayerName(player)}</td>
                  <td className="p-3">{formatSquadNumber(player.squadNumber)}</td>
                  <td className="p-3 font-medium">
                    {formatResult(player.result, resultUnit)}
                  </td>
                  <td className="p-3">{statusLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
