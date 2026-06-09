'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type MatchStatus = 'DRAFT' | 'IN_PROGRESS' | 'HALF_TIME' | 'COMPLETED'
type SquadStatus = 'STARTER' | 'SUBSTITUTE'
type TargetState = 'ON' | 'OFF'

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type PitchPlayer = {
  matchDayPlayerId: string
  playerId: string
  firstName: string
  surname: string
  squadNumber: number | null
  squadStatus: SquadStatus
  isOnPitch: boolean
  openStintStartedAt: string | null
  totalMilliseconds: number
}

type MatchPitchClientProps = {
  matchDayId: string
  status: MatchStatus
  matchElapsedMilliseconds: number
  players: PitchPlayer[]
  togglePlayerOnPitchAction: (formData: FormData) => Promise<MatchActionResult>
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const getPlayerName = (player: PitchPlayer) =>
  `${player.firstName} ${player.surname}`

const formatSquadStatus = (status: SquadStatus) =>
  status === 'STARTER' ? 'Starter' : 'Substitute'

const formatMinutes = (milliseconds: number) => {
  const minutes = Math.round(Math.max(0, milliseconds) / 60000)
  return `${minutes} min${minutes === 1 ? '' : 's'}`
}

const getPercentage = (playedMilliseconds: number, matchElapsedMilliseconds: number) => {
  if (matchElapsedMilliseconds <= 0) return null
  return Math.round((playedMilliseconds / matchElapsedMilliseconds) * 100)
}

export default function MatchPitchClient({
  matchDayId,
  status,
  matchElapsedMilliseconds,
  players,
  togglePlayerOnPitchAction,
}: MatchPitchClientProps) {
  const router = useRouter()
  const [now, setNow] = useState(0)
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isReadOnly = status === 'COMPLETED'
  const canToggle = status === 'IN_PROGRESS'
  const onPitchCount = players.filter((player) => player.isOnPitch).length
  const hasOpenStints = players.some((player) => player.openStintStartedAt)

  useEffect(() => {
    if (!hasOpenStints) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [hasOpenStints])

  const getDisplayedMilliseconds = (player: PitchPlayer) => {
    if (!player.openStintStartedAt || now === 0) return player.totalMilliseconds
    return player.totalMilliseconds + Math.max(0, now - new Date(player.openStintStartedAt).getTime())
  }

  const togglePlayer = async (player: PitchPlayer, targetState: TargetState) => {
    if (!canToggle || isReadOnly || pendingPlayerId) return

    setPendingPlayerId(player.matchDayPlayerId)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchDayPlayerId', player.matchDayPlayerId)
    formData.set('targetState', targetState)

    const result = await togglePlayerOnPitchAction(formData)

    if (result.ok) {
      setMessage(`${getPlayerName(player)} subbed ${targetState === 'ON' ? 'on' : 'off'}.`)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingPlayerId(null)
  }

  return (
    <section className="rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">On pitch</h2>
          <p className="mt-1 text-sm text-gray-500">
            Toggle players on and off during live match play. Minutes are approximate.
          </p>
        </div>
        <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm">
          <span className="font-bold">{onPitchCount}</span> on pitch
        </div>
      </div>

      {isReadOnly && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Match completed. On/off tracking is read-only.
        </p>
      )}

      {!isReadOnly && status === 'DRAFT' && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Start the match before toggling players on or off.
        </p>
      )}

      {!isReadOnly && status === 'HALF_TIME' && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          On/off changes are paused at half-time. Start the second half to continue.
        </p>
      )}

      {message && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {players.length === 0 ? (
        <p className="mt-4 rounded-lg border p-4 text-sm text-gray-500">
          Add starters or substitutes in the squad section before tracking on-pitch time.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {players.map((player) => {
            const displayedMilliseconds = getDisplayedMilliseconds(player)
            const percentage = getPercentage(displayedMilliseconds, matchElapsedMilliseconds)
            const targetState = player.isOnPitch ? 'OFF' : 'ON'

            return (
              <article key={player.matchDayPlayerId} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{getPlayerName(player)}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatSquadNumber(player.squadNumber)} · {formatSquadStatus(player.squadStatus)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      player.isOnPitch
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {player.isOnPitch ? 'On pitch' : 'Off pitch'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <p className="text-gray-500">Minutes played</p>
                    <p className="mt-1 text-xl font-bold">{formatMinutes(displayedMilliseconds)}</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <p className="text-gray-500">Match played</p>
                    <p className="mt-1 text-xl font-bold">
                      {percentage === null ? 'N/A' : `${percentage}%`}
                    </p>
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => togglePlayer(player, targetState)}
                    className={`mt-4 w-full rounded-lg px-4 py-4 text-lg font-bold text-white disabled:opacity-50 ${
                      player.isOnPitch ? 'bg-red-700' : 'bg-green-700'
                    }`}
                    disabled={!canToggle || pendingPlayerId === player.matchDayPlayerId}
                  >
                    {pendingPlayerId === player.matchDayPlayerId
                      ? 'Saving...'
                      : player.isOnPitch
                        ? 'Sub off'
                        : 'Sub on'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
