'use client'

import { useEffect, useState } from 'react'

type Venue = 'home' | 'away' | 'neutral'

type Match = {
  id: string
  opposition: string
  venue: Venue
  date: string
}

type ActionEvent = {
  matchId: string
  playerName: string
  action: string
  time: string
  gameSecond: number
  usScore: number
  themScore: number
}

const players = ['Jack', 'Oliver', 'Harry']

const actions = [
  'Successful Dribble',
  'Attempted Dribble',
  'Forward Pass',
  'Ball Carry',
  'Tackle Won',
  'Shot on Target',
]

export default function TrackPage() {
  const [selectedPlayer, setSelectedPlayer] = useState(players[0])
  const [events, setEvents] = useState<ActionEvent[]>([])
  const [match, setMatch] = useState<Match | null>(null)

  const [opposition, setOpposition] = useState('')
  const [venue, setVenue] = useState<Venue>('home')
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [gameSecond, setGameSecond] = useState(0)
  const [isClockRunning, setIsClockRunning] = useState(false)

  const [usScore, setUsScore] = useState(0)
  const [themScore, setThemScore] = useState(0)

  const [playerStatus, setPlayerStatus] = useState<
    Record<string, boolean>
  >({
    Jack: true,
    Oliver: true,
    Harry: true,
  })

  useEffect(() => {
    const savedEvents = localStorage.getItem('actionEvents')
    const savedMatch = localStorage.getItem('currentMatch')

    if (savedEvents) {
      setEvents(JSON.parse(savedEvents))
    }

    if (savedMatch) {
      setMatch(JSON.parse(savedMatch))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('actionEvents', JSON.stringify(events))
  }, [events])

  useEffect(() => {
    if (match) {
      localStorage.setItem('currentMatch', JSON.stringify(match))
    }
  }, [match])

  useEffect(() => {
    if (!isClockRunning) return

    const interval = setInterval(() => {
      setGameSecond((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isClockRunning])

  const startMatch = () => {
    if (!opposition.trim()) return

    const newMatch: Match = {
      id: crypto.randomUUID(),
      opposition,
      venue,
      date,
    }

    setMatch(newMatch)
    setGameSecond(0)
    setIsClockRunning(false)
    setUsScore(0)
    setThemScore(0)
  }

  const togglePlayerStatus = (player: string) => {
    const isCurrentlyOn = playerStatus[player]
  
    setPlayerStatus({
      ...playerStatus,
      [player]: !isCurrentlyOn,
    })
  
    if (!match) return
  
    const subEvent: ActionEvent = {
      matchId: match.id,
      playerName: player,
      action: isCurrentlyOn ? 'Subbed Off' : 'Subbed On',
      time: new Date().toISOString(),
      gameSecond,
      usScore,
      themScore,
    }
  
    setEvents((prev) => [...prev, subEvent])
  }

  const formatGameTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const recordAction = (action: string) => {
    if (!match) return

    const newEvent: ActionEvent = {
      matchId: match.id,
      playerName: selectedPlayer,
      action,
      time: new Date().toISOString(),
      gameSecond,
      usScore,
      themScore,
    }

    setEvents([...events, newEvent])
  }

  const getTotal = (action: string) => {
    if (!match) return 0

    return events.filter(
      (event) =>
        event.matchId === match.id &&
        event.playerName === selectedPlayer &&
        event.action === action
    ).length
  }

  const currentMatchEvents = match
    ? events.filter((event) => event.matchId === match.id)
    : []

  const currentMatchEventsNewestFirst = [
    ...currentMatchEvents,
  ].reverse()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        Track Game Actions
      </h1>

      <p className="text-gray-500 mb-6">
        Set up a match, then tap actions during the game.
      </p>

      <div className="border rounded-lg p-4 mb-6">
        <h2 className="text-xl font-bold mb-4">
          Match Setup
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            Opposition

            <input
              type="text"
              value={opposition}
              onChange={(e) => setOpposition(e.target.value)}
              placeholder="e.g. Burntwood Colts"
              className="mt-1 border rounded p-2 w-full"
            />
          </label>

          <label className="text-sm">
            Venue

            <select
              value={venue}
              onChange={(e) =>
                setVenue(e.target.value as Venue)
              }
              className="mt-1 border rounded p-2 w-full"
            >
              <option value="home">Home</option>
              <option value="away">Away</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>

          <label className="text-sm">
            Date

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 border rounded p-2 w-full"
            />
          </label>
        </div>

        <button
          onClick={startMatch}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
        >
          Start Match
        </button>
      </div>

      {match && (
        <>
          <div className="border rounded-lg p-4 mb-6 bg-gray-50">
            <h2 className="font-bold">Current Match</h2>

            <p>
              Opposition:{' '}
              <strong>{match.opposition}</strong>
            </p>

            <p>
              Venue: <strong>{match.venue}</strong>
            </p>

            <p>
              Date: <strong>{match.date}</strong>
            </p>

            <p>
              Events recorded:{' '}
              <strong>{currentMatchEvents.length}</strong>
            </p>
          </div>

          <div className="border rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold mb-4">
              Game Context
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-1">
                  Game Clock
                </div>

                <div className="text-4xl font-bold mb-4">
                  {formatGameTime(gameSecond)}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsClockRunning(true)}
                    className="bg-green-600 text-white px-3 py-2 rounded"
                  >
                    Start
                  </button>

                  <button
                    onClick={() => setIsClockRunning(false)}
                    className="bg-yellow-500 text-white px-3 py-2 rounded"
                  >
                    Pause
                  </button>

                  <button
                    onClick={() => {
                      setIsClockRunning(false)
                      setGameSecond(0)
                    }}
                    className="bg-gray-700 text-white px-3 py-2 rounded"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-sm text-gray-500 mb-3">
                  Score
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-medium mb-2">Us</div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setUsScore(
                            Math.max(0, usScore - 1)
                          )
                        }
                        className="border px-3 py-1 rounded"
                      >
                        -
                      </button>

                      <span className="text-3xl font-bold">
                        {usScore}
                      </span>

                      <button
                        onClick={() =>
                          setUsScore(usScore + 1)
                        }
                        className="border px-3 py-1 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="font-medium mb-2">Them</div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setThemScore(
                            Math.max(0, themScore - 1)
                          )
                        }
                        className="border px-3 py-1 rounded"
                      >
                        -
                      </button>

                      <span className="text-3xl font-bold">
                        {themScore}
                      </span>

                      <button
                        onClick={() =>
                          setThemScore(themScore + 1)
                        }
                        className="border px-3 py-1 rounded"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  Events store the score at the moment they
                  are recorded.
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select Player
            </label>

            <select
              value={selectedPlayer}
              onChange={(e) =>
                setSelectedPlayer(e.target.value)
              }
              className="border rounded p-2 w-full"
            >
              {players.map((player) => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </select>
          </div>

          <div className="border rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold mb-3">
              Player Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {players.map((player) => {
                const isOnPitch = playerStatus[player]

                return (
                  <button
                    key={player}
                    onClick={() =>
                      togglePlayerStatus(player)
                    }
                    className={`rounded-lg p-4 text-left border ${
                      isOnPitch
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-red-50 border-red-500 text-red-700'
                    }`}
                  >
                    <div className="font-bold">{player}</div>

                    <div className="text-sm">
                      {isOnPitch
                        ? '🟢 On Pitch'
                        : '🔴 Off Pitch'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => recordAction(action)}
                className="border rounded-lg p-4 text-left hover:bg-gray-50"
              >
                <div className="font-medium">{action}</div>

                <div className="text-sm text-gray-500">
                  Total: {getTotal(action)}
                </div>
              </button>
            ))}
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-bold mb-3">
              Current Totals: {selectedPlayer}
            </h2>

            <ul className="space-y-2">
              {actions.map((action) => (
                <li
                  key={action}
                  className="flex justify-between border-b pb-2"
                >
                  <span>{action}</span>

                  <strong>{getTotal(action)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="border rounded-lg p-4 mt-6">
            <h2 className="text-xl font-bold mb-3">
              Match Event Feed
            </h2>

            {currentMatchEventsNewestFirst.length === 0 ? (
              <p className="text-sm text-gray-500">
                No events recorded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {currentMatchEventsNewestFirst.map(
                  (event, index) => (
                    <li
                      key={index}
                      className="border-b pb-2 text-sm"
                    >
                      <div className="font-medium">
                        {formatGameTime(
                          event.gameSecond
                        )}{' '}
                        — {event.playerName} —{' '}
                        <span
  className={
    event.action.includes('Subbed')
      ? 'text-purple-600'
      : 'text-black'
  }
>
  {event.action}
</span>
                      </div>

                      <div className="text-gray-500">
                        Score: {event.usScore}-
                        {event.themScore}
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}