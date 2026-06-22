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

const formatEventType = (eventOptions: readonly EventOption[], eventType: MatchEventType) =>
  eventOptions.find((option) => option.value === eventType)?.label ?? eventType

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
      setMessage(`${formatEventType(eventOptions, eventType)} recorded for ${formatPlayerName(player)}.`)
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
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-xl font-bold">Event recording</h2>
        <p className="mt-1 text-sm text-gray-400">
          Choose player first or event first, then tap once to record the action.
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
        <div className="mt-4 space-y-5">
          {eventOptions.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No event types were selected before kick-off, so there are no event buttons available for this match. Goal buttons can still update the score, but player event recording is unavailable.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-bold">Selected event buttons</p>
                <p className="mt-1">
                  {eventOptions.map((eventOption) => eventOption.label).join(', ')}
                </p>
              </div>

              {visibleCategories.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Event types were selected, but none match the available event categories. Check event setup before starting future matches.
                </p>
              ) : (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
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
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50 text-blue-900'
                              : 'bg-white text-gray-900'
                          }`}
                          disabled={Boolean(pendingAction)}
                        >
                          {category.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setRecordingMode('PLAYER_FIRST')}
              className={`rounded-lg px-4 py-3 text-sm font-bold transition sm:text-base ${
                recordingMode === 'PLAYER_FIRST'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700'
              }`}
            >
              Player first
            </button>
            <button
              type="button"
              onClick={() => setRecordingMode('EVENT_FIRST')}
              className={`rounded-lg px-4 py-3 text-sm font-bold transition sm:text-base ${
                recordingMode === 'EVENT_FIRST'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700'
              }`}
            >
              Event first
            </button>
          </div>

          {eventOptions.length > 0 && recordingMode === 'PLAYER_FIRST' ? (
            <>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                  1. Players available for event tracking
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {players.map((player) => {
                    const isSelected = effectiveSelectedPlayerId === player.matchDayPlayerId

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
                {selectedPlayer && (
                  <p className="mt-1 rounded-lg bg-blue-50 p-2 text-sm text-blue-900">
                    Selected player: <span className="font-bold">{formatPlayerName(selectedPlayer)}</span>. Now tap an event.
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
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
                        className="rounded-lg border bg-white px-3 py-4 text-sm font-bold disabled:opacity-50"
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
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                  1. Select event
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
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
                        className={`rounded-lg border px-3 py-4 text-sm font-bold ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                            : 'bg-white text-gray-900'
                        }`}
                      >
                        {eventOption.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                  2. Players available for event tracking
                </h3>
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
                        className="rounded-lg border bg-white p-4 text-left font-medium text-gray-900 disabled:opacity-50"
                        disabled={!effectiveSelectedEventType || Boolean(pendingAction)}
                      >
                        <span className="block text-base font-bold">
                          {pendingAction === pendingKey ? 'Saving...' : formatPlayerName(player)}
                        </span>
                        <span className="mt-1 block text-sm text-gray-500">
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

      <div className="mt-6">
        <h3 className="text-lg font-bold">Recent events and corrections</h3>
        <p className="mt-1 text-sm text-gray-500">
          Use undo only when an event was tapped by mistake.
        </p>
        {events.length === 0 ? (
          <p className="mt-2 rounded-lg border p-4 text-sm text-gray-500">
            No match events recorded yet.
          </p>
        ) : (
          <div className="mt-3 divide-y rounded-lg border">
            {events.map((event) => (
              <article key={event.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">
                      {formatHalf(event.half)} {formatMatchTime(event.matchSecond)} · {formatEventType(eventOptions, event.eventType)}
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
      </div>

    </section>
  )
}
