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

export default function MatchPitchClient({
  matchDayId,
  status,
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
    <section className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Players and substitutions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Tap Sub on or Sub off to track minutes from the touchline.
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
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
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No match squad players are available here. The squad is selected before kick-off; if no starters or substitutes were added before the match started, players cannot be subbed on or used for event recording in this match.
        </p>
      ) : (
        <>
        {canToggle && onPitchCount === 0 && (
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-900">
            Sub players on to make them available for Event recording. Only tracked players currently on the pitch can have events recorded.
          </p>
        )}
        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:gap-3">
          {players.map((player) => {
            const displayedMilliseconds = getDisplayedMilliseconds(player)
            const targetState = player.isOnPitch ? 'OFF' : 'ON'

            return (
              <article key={player.matchDayPlayerId} className="rounded-xl bg-gray-50 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold sm:text-lg">{getPlayerName(player)}</h3>
                    <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                      {formatSquadNumber(player.squadNumber)} · {formatSquadStatus(player.squadStatus)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      player.isOnPitch
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {player.isOnPitch ? 'On pitch' : 'Off pitch'}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <p className="text-gray-500">Minutes</p>
                  <p className="font-bold tabular-nums">{formatMinutes(displayedMilliseconds)}</p>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => togglePlayer(player, targetState)}
                    className={`mt-3 w-full rounded-lg px-4 py-3 text-base font-bold text-white disabled:opacity-50 sm:py-4 sm:text-lg ${
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
        </>
      )}
    </section>
  )
}
