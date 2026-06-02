'use client'

import { useState, useEffect } from 'react'
import PlayerCard from '@/components/PlayerCard'


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
  const [players, setPlayers] = useState<Player[]>(() => {
    if (typeof window === 'undefined') return []

    const saved = localStorage.getItem('players')
    return saved ? JSON.parse(saved) : []
  })
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

  const deletePlayer = (index: number) => {
    const updatedPlayers = players.filter((_, i) => i !== index)
    setPlayers(updatedPlayers)
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
    <PlayerCard
      key={index}
      player={player}
      index={index}
      addRating={addRating}
      deletePlayer={deletePlayer}
    />
  ))}
</ul>
    </div>
  )
}
