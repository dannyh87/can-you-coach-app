'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { formatMatchEventType } from '@/lib/matchEventTaxonomy'

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

type MatchEventCategory =
  | 'ATTACKING'
  | 'IN_POSSESSION'
  | 'OUT_OF_POSSESSION'
  | 'TRANSITION'

type RecordingMode = 'PLAYER_FIRST' | 'EVENT_FIRST'

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

type EventOption = {
  value: MatchEventType
  label: string
  category: MatchEventCategory
}

type EventCategoryOption = {
  value: MatchEventCategory
  label: string
}

type MatchEventsClientProps = {
  matchDayId: string
  status: MatchStatus
  players: EventPlayer[]
  events: RecentEvent[]
  eventOptions: readonly EventOption[]
  categoryOptions: readonly EventCategoryOption[]
  recordMatchEventAction: (formData: FormData) => Promise<MatchActionResult>
  deleteMatchEventAction: (formData: FormData) => Promise<MatchActionResult>
}

const formatPlayerName = (player: EventPlayer) =>
  `${player.firstName} ${player.surname}`

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const formatHalf = (half: MatchHalf) =>
  half === 'FIRST_HALF' ? '1H' : '2H'

const formatMatchTime = (matchSecond: number) => {
  const minutes = Math.floor(matchSecond / 60)
  const seconds = matchSecond % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getPendingEventKey = (eventType: MatchEventType, matchDayPlayerId: string) =>
  `${eventType}:${matchDayPlayerId}`

export default function MatchEventsClient({
  matchDayId,
  status,
  players,
  events,
  eventOptions,
  categoryOptions,
  recordMatchEventAction,
  deleteMatchEventAction,
}: MatchEventsClientProps) {
  const router = useRouter()
  const availableCategories = categoryOptions.filter((category) =>
    eventOptions.some((eventOption) => eventOption.category === category.value)
  )
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('PLAYER_FIRST')
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.matchDayPlayerId ?? '')
  const [selectedCategory, setSelectedCategory] = useState<MatchEventCategory>(
    availableCategories[0]?.value ?? 'ATTACKING'
  )
  const [selectedEventType, setSelectedEventType] = useState<MatchEventType | ''>(
    eventOptions[0]?.value ?? ''
  )
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canRecord = status === 'IN_PROGRESS'
  const isReadOnly = status === 'COMPLETED'
  const visibleCategories = availableCategories.filter((category) =>
    eventOptions.some((eventOption) => eventOption.category === category.value)
  )
  const effectiveSelectedPlayerId = players.some(
    (player) => player.matchDayPlayerId === selectedPlayerId
  )
    ? selectedPlayerId
    : players[0]?.matchDayPlayerId ?? ''
  const selectedCategoryHasEvents = eventOptions.some(
    (eventOption) => eventOption.category === selectedCategory
  )
  const effectiveSelectedCategory = selectedCategoryHasEvents
    ? selectedCategory
    : visibleCategories[0]?.value ?? selectedCategory
  const firstCategoryEvent = eventOptions.find(
    (eventOption) => eventOption.category === effectiveSelectedCategory
  )
  const effectiveSelectedEventType = eventOptions.some(
    (eventOption) => eventOption.value === selectedEventType
  )
    ? selectedEventType
    : firstCategoryEvent?.value ?? eventOptions[0]?.value ?? ''
  const selectedPlayer = players.find(
    (player) => player.matchDayPlayerId === effectiveSelectedPlayerId
  )
  const selectedEvent = eventOptions.find(
    (eventOption) => eventOption.value === effectiveSelectedEventType
  )
  const categoryEvents = eventOptions.filter(
    (eventOption) => eventOption.category === effectiveSelectedCategory
  )

  const recordEvent = async (eventType: MatchEventType | '', player: EventPlayer | undefined) => {
    if (!canRecord || pendingAction || !player || !eventType) return

    setPendingAction(getPendingEventKey(eventType, player.matchDayPlayerId))
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchDayPlayerId', player.matchDayPlayerId)
    formData.set('eventType', eventType)

    const result = await recordMatchEventAction(formData)

    if (result.ok) {
      setMessage(`${formatMatchEventType(eventType)} recorded for ${formatPlayerName(player)}.`)
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
    <section className="rounded-xl bg-white p-3 shadow-sm sm:p-4">
      <div>
        <h2 className="text-lg font-bold sm:text-xl">Event recording</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick the fastest flow for the moment, then tap once to record.
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
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">No players are available for event recording yet.</p>
          <p className="mt-1">
            Events can only be recorded for tracked players who are currently on the pitch. Go to Players and substitutions, sub tracked players on, then event buttons will appear here.
          </p>
          <a
            href="#players-and-substitutions"
            className="mt-3 inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
          >
            Go to Players and substitutions
          </a>
        </div>
      )}

      {canRecord && players.length > 0 && (
        <div className="mt-3 space-y-3">
          {eventOptions.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No event types were selected before kick-off, so there are no event buttons available for this match. Goal buttons can still update the score, but player event recording is unavailable.
            </p>
          ) : (
            <>
              <details className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <summary className="cursor-pointer font-bold">
                  Event buttons selected ({eventOptions.length})
                </summary>
                <p className="mt-2">
                  {eventOptions.map((eventOption) => eventOption.label).join(', ')}
                </p>
              </details>

              {visibleCategories.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Event types were selected, but none match the available event categories. Check event setup before starting future matches.
                </p>
              ) : (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 sm:text-sm">
                    Event category
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {visibleCategories.map((category) => {
                      const isSelected = effectiveSelectedCategory === category.value

                      return (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(category.value)
                            const firstCategoryEvent = eventOptions.find(
                              (eventOption) => eventOption.category === category.value
                            )
                            if (firstCategoryEvent) setSelectedEventType(firstCategoryEvent.value)
                          }}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 sm:text-sm ${
                            isSelected
                              ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                              : 'bg-white text-gray-900'
                          }`}
                          disabled={Boolean(pendingAction)}
                        >
                          <span className="block">{category.label}</span>
                          {isSelected && <span className="mt-0.5 block text-[11px] uppercase tracking-wide">Selected</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="rounded-xl bg-gray-100 p-1">
            <p className="px-2 pb-1 pt-1 text-xs font-medium text-gray-600">
              Choose how you want to record
            </p>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setRecordingMode('PLAYER_FIRST')}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-bold transition sm:px-4 sm:py-3 sm:text-base ${
                  recordingMode === 'PLAYER_FIRST'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700'
                }`}
              >
                <span className="block">Player first</span>
                <span className="block text-xs font-medium opacity-80">Pick player, tap event</span>
              </button>
              <button
                type="button"
                onClick={() => setRecordingMode('EVENT_FIRST')}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-bold transition sm:px-4 sm:py-3 sm:text-base ${
                  recordingMode === 'EVENT_FIRST'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700'
                }`}
              >
                <span className="block">Event first</span>
                <span className="block text-xs font-medium opacity-80">Pick event, tap player</span>
              </button>
            </div>
          </div>

          {eventOptions.length > 0 && recordingMode === 'PLAYER_FIRST' ? (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 sm:text-sm">
                  1. Players available for event tracking
                </h3>
                <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
                  Only tracked players currently on pitch appear here.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {players.map((player) => {
                    const isSelected = effectiveSelectedPlayerId === player.matchDayPlayerId

                    return (
                      <button
                        key={player.matchDayPlayerId}
                        type="button"
                        onClick={() => setSelectedPlayerId(player.matchDayPlayerId)}
                        className={`rounded-lg border p-3 text-left font-medium sm:p-4 ${
                          isSelected
                            ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                            : 'bg-white text-gray-900'
                        }`}
                      >
                        <span className="block truncate text-sm font-bold sm:text-base">{formatPlayerName(player)}</span>
                        <span className="mt-1 block text-xs text-gray-500 sm:text-sm">
                          {formatSquadNumber(player.squadNumber)}
                        </span>
                        {isSelected && <span className="mt-2 inline-flex rounded-full bg-blue-700 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Selected</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 sm:text-sm">
                  2. Tap event
                </h3>
                {selectedPlayer && (
                  <p className="mt-1 rounded-lg bg-blue-50 p-2 text-sm text-blue-900">
                    Selected player: <span className="font-bold">{formatPlayerName(selectedPlayer)}</span>. Now tap an event.
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoryEvents.length === 0 ? (
                    <p className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      No selected event buttons are available in this category. Choose another category above.
                    </p>
                  ) : categoryEvents.map((eventOption) => {
                    const pendingKey = selectedPlayer
                      ? getPendingEventKey(eventOption.value, selectedPlayer.matchDayPlayerId)
                      : eventOption.value

                    return (
                      <button
                        key={eventOption.value}
                        type="button"
                        onClick={() => recordEvent(eventOption.value, selectedPlayer)}
                        className="rounded-lg border bg-white px-3 py-3 text-sm font-bold disabled:opacity-50 sm:py-4"
                        disabled={!selectedPlayer || Boolean(pendingAction)}
                      >
                        {pendingAction === pendingKey ? 'Saving...' : eventOption.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : eventOptions.length > 0 ? (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 sm:text-sm">
                  1. Select event
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoryEvents.length === 0 ? (
                    <p className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      No selected event buttons are available in this category. Choose another category above.
                    </p>
                  ) : categoryEvents.map((eventOption) => {
                    const isSelected = effectiveSelectedEventType === eventOption.value

                    return (
                      <button
                        key={eventOption.value}
                        type="button"
                        onClick={() => setSelectedEventType(eventOption.value)}
                        className={`rounded-lg border px-3 py-3 text-sm font-bold sm:py-4 ${
                          isSelected
                            ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                            : 'bg-white text-gray-900'
                        }`}
                      >
                        <span className="block">{eventOption.label}</span>
                        {isSelected && <span className="mt-1 block text-[11px] uppercase tracking-wide">Selected</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 sm:text-sm">
                  2. Players available for event tracking
                </h3>
                <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
                  Only tracked players currently on pitch appear here.
                </p>
                {selectedEvent && (
                  <p className="mt-1 rounded-lg bg-blue-50 p-2 text-sm text-blue-900">
                    Selected event: <span className="font-bold">{selectedEvent.label}</span>. Now tap a player.
                  </p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {players.map((player) => {
                    const pendingKey = effectiveSelectedEventType
                      ? getPendingEventKey(effectiveSelectedEventType, player.matchDayPlayerId)
                      : ''

                    return (
                      <button
                        key={player.matchDayPlayerId}
                        type="button"
                        onClick={() => recordEvent(effectiveSelectedEventType, player)}
                        className="rounded-lg border bg-white p-3 text-left font-medium text-gray-900 disabled:opacity-50 sm:p-4"
                        disabled={!effectiveSelectedEventType || Boolean(pendingAction)}
                      >
                        <span className="block truncate text-sm font-bold sm:text-base">
                          {pendingAction === pendingKey ? 'Saving...' : formatPlayerName(player)}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500 sm:text-sm">
                          {formatSquadNumber(player.squadNumber)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      <details className="mt-5 rounded-xl border bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-bold text-gray-900">
          Recent events and corrections ({events.length})
        </summary>
        <p className="mt-2 text-sm text-gray-500">
          Open this when you need to check or undo a mistaken tap.
        </p>
        {events.length === 0 ? (
          <p className="mt-2 rounded-lg border p-4 text-sm text-gray-500">
            No match events recorded yet.
          </p>
        ) : (
          <div className="mt-3 divide-y rounded-lg border">
            {events.map((event) => (
              <article key={event.id} className="p-2.5 sm:p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">
                      {formatHalf(event.half)} {formatMatchTime(event.matchSecond)} · {formatMatchEventType(event.eventType)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {event.playerName} · {event.ownScoreAtTime}-{event.oppositionScoreAtTime}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => undoEvent(event.id)}
                      className="rounded border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
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
      </details>

    </section>
  )
}
