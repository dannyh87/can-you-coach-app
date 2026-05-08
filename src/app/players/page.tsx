'use client'

import { useState, useEffect } from 'react'
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

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [name, setName] = useState('')

  const addPlayer = () => {
    if (!name.trim()) return

    setPlayers([
      ...players,
      {
        name,
        ratings: [],
      },
    ])

    setName('')
  }

  const addRating = (index: number) => {
    const newRating: Rating = {
      technical: Math.floor(Math.random() * 10) + 1,
      tactical: Math.floor(Math.random() * 10) + 1,
      physical: Math.floor(Math.random() * 10) + 1,
      mental: Math.floor(Math.random() * 10) + 1,
      coachability: Math.floor(Math.random() * 10) + 1,
    }

    const updatedPlayers = [...players]
    updatedPlayers[index].ratings.push(newRating)

    setPlayers(updatedPlayers)
  }

  const getAverageRating = (player: Player) => {
    if (player.ratings.length === 0) return 0

    const totals = player.ratings.reduce(
      (acc, rating) => {
        acc.technical += rating.technical
        acc.tactical += rating.tactical
        acc.physical += rating.physical
        acc.mental += rating.mental
        acc.coachability += rating.coachability
        return acc
      },
      {
        technical: 0,
        tactical: 0,
        physical: 0,
        mental: 0,
        coachability: 0,
      }
    )

    const numRatings = player.ratings.length

    const avg =
      (totals.technical +
        totals.tactical +
        totals.physical +
        totals.mental +
        totals.coachability) /
      (numRatings * 5)

    return avg.toFixed(1)
  }

  const getChartData = (player: Player) => {
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

  useEffect(() => {
    const saved = localStorage.getItem('players')
    if (saved) {
      setPlayers(JSON.parse(saved))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('players', JSON.stringify(players))
  }, [players])

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Players</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Enter player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 flex-1 rounded"
        />

        <button
          onClick={addPlayer}
          className="bg-blue-500 text-white px-4 rounded"
        >
          Add
        </button>
      </div>

      <ul className="space-y-4">
        {players.map((player, index) => (
          <li key={index} className="p-4 border rounded">
            <div className="flex items-center justify-between">
              <span>
                {player.name} ({player.ratings.length} sessions) — Avg:{' '}
                {getAverageRating(player)}
              </span>

              <button
                onClick={() => addRating(index)}
                className="text-sm text-blue-500"
              >
                Add Rating
              </button>
            </div>

            {player.ratings.length > 0 && (
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getChartData(player)}>
                    <XAxis dataKey="session" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="average" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}