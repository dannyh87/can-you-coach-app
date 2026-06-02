'use  client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

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

export default function PlayerPage() {
  const params = useParams()
  const id = Number(params.id)

  const [player, setPlayer] = useState<Player | null>(null)

  const [newRating, setNewRating] = useState<Rating>({
    technical: 5,
    tactical: 5,
    physical: 5,
    mental: 5,
    coachability: 5,
  })

  useEffect(() => {
    const saved = localStorage.getItem('players')

    if (saved) {
      const players: Player[] = JSON.parse(saved)
      setPlayer(players[id])
    }
  }, [id])

  if (!player) {
    return <div className="p-6">Loading...</div>
  }

  const saveRating = () => {
    const saved = localStorage.getItem('players')
    if (!saved) return

    const players: Player[] = JSON.parse(saved)

    const updatedPlayer = {
      ...players[id],
      ratings: [...players[id].ratings, newRating],
    }

    players[id] = updatedPlayer

    localStorage.setItem('players', JSON.stringify(players))
    setPlayer(updatedPlayer)

    setNewRating({
      technical: 5,
      tactical: 5,
      physical: 5,
      mental: 5,
      coachability: 5,
    })
  }

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

  const updateRatingField = (field: keyof Rating, value: number) => {
    setNewRating({
      ...newRating,
      [field]: value,
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        href="/players"
        className="text-sm text-blue-500 hover:underline"
      >
        ← Back to Players
      </Link>

      <div className="mt-6 border rounded-xl p-6 shadow-sm">
        <h1 className="text-3xl font-bold">{player.name}</h1>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-sm text-gray-500">Average Rating</div>
            <div className="text-2xl font-bold">{getAverageRating()}</div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="text-sm text-gray-500">Best Attribute</div>
            <div className="text-2xl font-bold">{getBestAttribute()}</div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="text-sm text-gray-500">Sessions</div>
            <div className="text-2xl font-bold">{player.ratings.length}</div>
          </div>
        </div>

        <div className="mt-8 border rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">Add Session Rating</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <label className="text-sm">
              Technical
              <input
                type="number"
                min="1"
                max="10"
                value={newRating.technical}
                onChange={(e) =>
                  updateRatingField('technical', Number(e.target.value))
                }
                className="mt-1 w-full border rounded p-2"
              />
            </label>

            <label className="text-sm">
              Tactical
              <input
                type="number"
                min="1"
                max="10"
                value={newRating.tactical}
                onChange={(e) =>
                  updateRatingField('tactical', Number(e.target.value))
                }
                className="mt-1 w-full border rounded p-2"
              />
            </label>

            <label className="text-sm">
              Physical
              <input
                type="number"
                min="1"
                max="10"
                value={newRating.physical}
                onChange={(e) =>
                  updateRatingField('physical', Number(e.target.value))
                }
                className="mt-1 w-full border rounded p-2"
              />
            </label>

            <label className="text-sm">
              Mental
              <input
                type="number"
                min="1"
                max="10"
                value={newRating.mental}
                onChange={(e) =>
                  updateRatingField('mental', Number(e.target.value))
                }
                className="mt-1 w-full border rounded p-2"
              />
            </label>

            <label className="text-sm">
              Coachability
              <input
                type="number"
                min="1"
                max="10"
                value={newRating.coachability}
                onChange={(e) =>
                  updateRatingField('coachability', Number(e.target.value))
                }
                className="mt-1 w-full border rounded p-2"
              />
            </label>
          </div>

          <button
            onClick={saveRating}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          >
            Save Rating
          </button>
        </div>

        <div className="mt-8 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={getChartData()}>
              <XAxis dataKey="session" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Line type="monotone" dataKey="average" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 overflow-x-auto">
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
                  <td className="p-2">{rating.technical}</td>
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
    </div>
  )
}