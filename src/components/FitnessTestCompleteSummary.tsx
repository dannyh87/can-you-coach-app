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
  players: SummaryPlayer[]
  resultUnit: string
  higherIsBetter: boolean
  statusLabel: string
  rankingsHref: string
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
  players,
  resultUnit,
  higherIsBetter,
  statusLabel,
  rankingsHref,
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

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <Link
          href={rankingsHref}
          className="inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Full Rankings
        </Link>
      </div>

      {topPerformer && bottomPerformer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-800">Top performer</p>
            <p className="mt-1 font-bold">{getPlayerName(topPerformer)}</p>
            <p className="text-sm text-green-900">
              {formatResult(topPerformer.result, resultUnit)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Bottom performer</p>
            <p className="mt-1 font-bold">{getPlayerName(bottomPerformer)}</p>
            <p className="text-sm text-gray-700">
              {formatResult(bottomPerformer.result, resultUnit)}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
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
    </section>
  )
}
