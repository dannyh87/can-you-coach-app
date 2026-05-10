'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import Link from 'next/link'

type Rating = {
  technical: number
  tactical: number
  physical: number
  mental: number
  coachability: number
}

type Player = {
  name: string
  ratings: Rating[]
}

type Props = {
  player: Player
  index: number
  addRating: (index: number) => void
  deletePlayer: (index: number) => void
}

export default function PlayerCard({
  player,
  index,
  addRating,
  deletePlayer,
}: Props) {
  const getAverageRating = () => {
    if (player.ratings.length === 0) return 0

    const total = player.ratings.reduce((sum, r) => {
      return (
        sum +
        r.technical +
        r.tactical +
        r.physical +
        r.mental +
        r.coachability
      )
    }, 0)

    return (total / (player.ratings.length * 5)).toFixed(1)
  }

  const getBestAttribute = () => {
    if (player.ratings.length === 0) return 'No data'
  
    const totals = {
      technical: 0,
      tactical: 0,
      physical: 0,
      mental: 0,
      coachability: 0,
    }
  
    player.ratings.forEach((rating) => {
      totals.technical += rating.technical
      totals.tactical += rating.tactical
      totals.physical += rating.physical
      totals.mental += rating.mental
      totals.coachability += rating.coachability
    })
  
    let bestKey = 'technical'
    let bestValue = totals.technical
  
    Object.entries(totals).forEach(([key, value]) => {
      if (value > bestValue) {
        bestKey = key
        bestValue = value
      }
    })
  
    return bestKey.charAt(0).toUpperCase() + bestKey.slice(1)
  }

  const getChartData = () => {
    return player.ratings.map((rating, index) => {
      const avg =
        (rating.technical +
          rating.tactical +
          rating.physical +
          rating.mental +
          rating.coachability) /
        5

      return {
        session: index + 1,
        average: Number(avg.toFixed(1)),
      }
    })
  }

  return (
    <li className="p-4 border rounded">
      <div className="flex items-center justify-between">
      <Link href={`/players/${index}`} className="font-medium hover:underline">
      <div>
  <div>
    {player.name} ({player.ratings.length} sessions) — Avg:{' '}
    {getAverageRating()}
  </div>

  <div className="text-sm text-gray-500">
    Best Attribute: {getBestAttribute()}
  </div>
</div>
</Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => addRating(index)}
            className="text-sm text-blue-500"
          >
            Add Rating
          </button>

          <button
            onClick={() => deletePlayer(index)}
            className="text-sm text-red-500"
          >
            Delete
          </button>
        </div>
      </div>

      {player.ratings.length > 0 && (
  <div>
    <div className="mt-4 h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={getChartData()}>
          <XAxis dataKey="session" />
          <YAxis domain={[0, 10]} />
          <Tooltip />
          <Line type="monotone" dataKey="average" />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Session</th>
            <th className="text-left p-2">Tech</th>
            <th className="text-left p-2">Tactical</th>
            <th className="text-left p-2">Physical</th>
            <th className="text-left p-2">Mental</th>
            <th className="text-left p-2">Coachability</th>
          </tr>
        </thead>

        <tbody>
          {player.ratings.map((rating, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{i + 1}</td>

              <td
                className={`p-2 ${
                  rating.technical >= 7
                    ? 'text-green-600'
                    : rating.technical <= 4
                    ? 'text-red-600'
                    : ''
                }`}
              >
                {rating.technical}
              </td>

              <td className="p-2">{rating.tactical}</td>
              <td className="p-2">{rating.physical}</td>
              <td className="p-2">{rating.mental}</td>
              <td className="p-2">{rating.coachability}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
    </li>
  )
}