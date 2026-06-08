'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type MatchStatus = 'DRAFT' | 'IN_PROGRESS' | 'HALF_TIME' | 'COMPLETED'
type MatchHalf = 'FIRST_HALF' | 'SECOND_HALF'
type MatchEventType =
  | 'GOAL'
  | 'ASSIST'
  | 'SHOT_ON_TARGET'
  | 'SHOT_OFF_TARGET'
  | 'PASS_COMPLETE'
  | 'PASS_INCOMPLETE'
  | 'ONE_V_ONE_SUCCESS'
  | 'ONE_V_ONE_UNSUCCESSFUL'

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type EventPlayer = {
  matchDayPlayerId: string
  playerId: string
  firstName: string
  surname: string
  squadNumber: number | null
}

type RecentEvent = {
  id: string
  eventType: MatchEventType
  half: MatchHalf
  matchSecond: number
  ownScoreAtTime: number
  oppositionScoreAtTime: number
  playerName: string
}

type MatchEventsClientProps = {
  matchDayId: string
  status: MatchStatus
  players: EventPlayer[]
  events: RecentEvent[]
  recordMatchEventAction: (formData: FormData) => Promise<MatchActionResult>
  deleteMatchEventAction: (formData: FormData) => Promise<MatchActionResult>
}

const eventOptions: Array<{ value: MatchEventType; label: string }> = [
  { value: 'GOAL', label: 'Goal' },
  { value: 'ASSIST', label: 'Assist' },
  { value: 'SHOT_ON_TARGET', label: 'Shot on target' },
  { value: 'SHOT_OFF_TARGET', label: 'Shot off target' },
  { value: 'PASS_COMPLETE', label: 'Pass complete' },
  { value: 'PASS_INCOMPLETE', label: 'Pass incomplete' },
  { value: 'ONE_V_ONE_SUCCESS', label: '1v1 success' },
  { value: 'ONE_V_ONE_UNSUCCESSFUL', label: '1v1 unsuccessful' },
]

const formatPlayerName = (player: EventPlayer) =>
  `${player.firstName} ${player.surname}`

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const formatEventType = (eventType: MatchEventType) =>
  eventOptions.find((option) => option.value === eventType)?.label ?? eventType

const formatHalf = (half: MatchHalf) =>
  half === 'FIRST_HALF' ? '1H' : '2H'

const formatMatchTime = (matchSecond: number) => {
  const minutes = Math.floor(matchSecond / 60)
  const seconds = matchSecond % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function MatchEventsClient({
  matchDayId,
  status,
  players,
  events,
  recordMatchEventAction,
  deleteMatchEventAction,
}: MatchEventsClientProps) {
  const router = useRouter()
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.matchDayPlayerId ?? '')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canRecord = status === 'IN_PROGRESS'
  const isReadOnly = status === 'COMPLETED'
  const selectedPlayer = players.find(
    (player) => player.matchDayPlayerId === selectedPlayerId
  )

  const recordEvent = async (eventType: MatchEventType) => {
    if (!canRecord || pendingAction || !selectedPlayer) return

    setPendingAction(eventType)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchDayPlayerId', selectedPlayer.matchDayPlayerId)
    formData.set('eventType', eventType)

    const result = await recordMatchEventAction(formData)

    if (result.ok) {
      setMessage(`${formatEventType(eventType)} recorded for ${formatPlayerName(selectedPlayer)}.`)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  const undoEvent = async (eventId: string) => {
    if (isReadOnly || pendingAction) return

    setPendingAction(eventId)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchEventId', eventId)

    const result = await deleteMatchEventAction(formData)

    if (result.ok) {
      setMessage('Event removed.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  return (
    <section className="rounded-xl border p-5">
      <div>
        <h2 className="text-xl font-bold">Events</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick a player on the pitch, then tap an event to record it immediately.
        </p>
      </div>

      {status === 'DRAFT' && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Start the match before recording events.
        </p>
      )}

      {status === 'HALF_TIME' && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Event recording is paused at half-time.
        </p>
      )}

      {isReadOnly && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Match completed. Events are read-only.
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

      {canRecord && players.length === 0 && (
        <p className="mt-4 rounded-lg border p-4 text-sm text-gray-500">
          Put a player on the pitch before recording events.
        </p>
      )}

      {canRecord && players.length > 0 && (
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
              1. Select player
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {players.map((player) => {
                const isSelected = selectedPlayerId === player.matchDayPlayerId

                return (
                  <button
                    key={player.matchDayPlayerId}
                    type="button"
                    onClick={() => setSelectedPlayerId(player.matchDayPlayerId)}
                    className={`rounded-lg border p-4 text-left font-medium ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'bg-white text-gray-900'
                    }`}
                  >
                    <span className="block text-base font-bold">{formatPlayerName(player)}</span>
                    <span className="mt-1 block text-sm text-gray-500">
                      {formatSquadNumber(player.squadNumber)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
              2. Tap event
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {eventOptions.map((eventOption) => (
                <button
                  key={eventOption.value}
                  type="button"
                  onClick={() => recordEvent(eventOption.value)}
                  className="rounded-lg border bg-white px-3 py-4 text-sm font-bold disabled:opacity-50"
                  disabled={!selectedPlayer || Boolean(pendingAction)}
                >
                  {pendingAction === eventOption.value ? 'Saving...' : eventOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-bold">Recent events</h3>
        {events.length === 0 ? (
          <p className="mt-2 rounded-lg border p-4 text-sm text-gray-500">
            No match events recorded yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {events.map((event) => (
              <article key={event.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{formatEventType(event.eventType)}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatHalf(event.half)} {formatMatchTime(event.matchSecond)} ·{' '}
                      {event.playerName} · {event.ownScoreAtTime}-{event.oppositionScoreAtTime}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => undoEvent(event.id)}
                      className="rounded border px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                      disabled={Boolean(pendingAction)}
                    >
                      {pendingAction === event.id ? 'Undoing...' : 'Undo'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        TODO: Team-level and opposition events will come later.
      </p>
    </section>
  )
}
