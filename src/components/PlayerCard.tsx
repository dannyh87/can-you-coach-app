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
  {player.name} ({player.ratings.length} sessions) — Avg: {getAverageRating()}
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
      )}
    </li>
  )
}