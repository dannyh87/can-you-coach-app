'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import PitchLocationPicker, { type PitchLocation } from '@/components/PitchLocationPicker'

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
  | 'TOUCH'

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
  label: string
  half: MatchHalf
  matchSecond: number
  ownScoreAtTime: number
  oppositionScoreAtTime: number
  playerName: string
}

type EventOption = {
  matchDayEventTypeId: string
  eventDefinitionId: string | null
  legacyEventType: MatchEventType | null
  label: string
  category: string
  categoryLabel?: string
  subcategory: string | null
  description: string | null
  videoUrl: string | null
  requiresLocation: boolean
}

type EventCategoryOption = {
  value: string
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

const getEventOptionKey = (eventOption: EventOption) =>
  eventOption.eventDefinitionId ?? eventOption.legacyEventType ?? eventOption.matchDayEventTypeId

const getPendingEventKey = (eventOption: EventOption, matchDayPlayerId: string) =>
  `${getEventOptionKey(eventOption)}:${matchDayPlayerId}`

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
  const [selectedCategory, setSelectedCategory] = useState(
    availableCategories[0]?.value ?? 'ATTACKING'
  )
  const [selectedEventKey, setSelectedEventKey] = useState(
    eventOptions[0] ? getEventOptionKey(eventOptions[0]) : ''
  )
  const [pendingLocationEvent, setPendingLocationEvent] = useState<{
    eventOption: EventOption
    player: EventPlayer
  } | null>(null)
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
  const effectiveSelectedEventKey = eventOptions.some(
    (eventOption) => getEventOptionKey(eventOption) === selectedEventKey
  )
    ? selectedEventKey
    : firstCategoryEvent ? getEventOptionKey(firstCategoryEvent) : eventOptions[0] ? getEventOptionKey(eventOptions[0]) : ''
  const selectedPlayer = players.find(
    (player) => player.matchDayPlayerId === effectiveSelectedPlayerId
  )
  const selectedEvent = eventOptions.find(
    (eventOption) => getEventOptionKey(eventOption) === effectiveSelectedEventKey
  )
  const categoryEvents = eventOptions.filter(
    (eventOption) => eventOption.category === effectiveSelectedCategory
  )
  const latestEvent = events[0] ?? null

  const appendEventFields = (formData: FormData, eventOption: EventOption) => {
    if (eventOption.eventDefinitionId) {
      formData.set('eventDefinitionId', eventOption.eventDefinitionId)
    } else if (eventOption.legacyEventType) {
      formData.set('eventType', eventOption.legacyEventType)
    }
  }

  const recordEvent = async (eventOption: EventOption | undefined, player: EventPlayer | undefined) => {
    if (!canRecord || pendingAction || pendingLocationEvent || !player || !eventOption) return

    if (eventOption.requiresLocation) {
      setMessage(null)
      setError(null)
      setPendingLocationEvent({ eventOption, player })
      return
    }

    setPendingAction(getPendingEventKey(eventOption, player.matchDayPlayerId))
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchDayPlayerId', player.matchDayPlayerId)
    appendEventFields(formData, eventOption)

    const result = await recordMatchEventAction(formData)

    if (result.ok) {
      setMessage(`${eventOption.label} recorded for ${formatPlayerName(player)}.`)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  const recordEventLocation = async (location: PitchLocation) => {
    if (!pendingLocationEvent || pendingAction) return

    const { eventOption, player } = pendingLocationEvent
    const pendingKey = getPendingEventKey(eventOption, player.matchDayPlayerId)

    setPendingAction(pendingKey)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchDayPlayerId', player.matchDayPlayerId)
    appendEventFields(formData, eventOption)
    formData.set('x', String(location.x))
    formData.set('y', String(location.y))

    const result = await recordMatchEventAction(formData)

    if (result.ok) {
      setMessage(`${eventOption.label} recorded for ${formatPlayerName(player)}.`)
      setPendingLocationEvent(null)
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
    <section className="rounded-xl bg-white p-2 shadow-sm sm:p-4">
      <div className="sticky top-16 z-20 -mx-2 border-b border-slate-200 bg-white/95 px-2 pb-2 pt-1 backdrop-blur sm:static sm:mx-0 sm:border-b-0 sm:bg-transparent sm:p-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-blue-700">Events</p>
            <p className="truncate text-sm font-extrabold text-slate-950">
              {selectedPlayer ? formatPlayerName(selectedPlayer) : 'Select player'}
              {selectedEvent && recordingMode === 'EVENT_FIRST' ? ` · ${selectedEvent.label}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setRecordingMode('PLAYER_FIRST')}
              className={`rounded-md px-2 py-1.5 ${recordingMode === 'PLAYER_FIRST' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
            >
              Player
            </button>
            <button
              type="button"
              onClick={() => setRecordingMode('EVENT_FIRST')}
              className={`rounded-md px-2 py-1.5 ${recordingMode === 'EVENT_FIRST' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
            >
              Event
            </button>
          </div>
        </div>
      </div>

      {status === 'DRAFT' && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Start the match before recording events.
        </p>
      )}

      {status === 'HALF_TIME' && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Event recording is paused at half-time.
        </p>
      )}

      {isReadOnly && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Match completed. Events are read-only.
        </p>
      )}

      {message && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm font-bold text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm font-bold text-red-700">
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
        <div className="mt-2 space-y-2 pb-20 sm:pb-3">
          {eventOptions.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              No event types were selected before kick-off, so there are no event buttons available for this match. Goal buttons can still update the score, but player event recording is unavailable.
            </p>
          ) : (
            <>
              {visibleCategories.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Event types were selected, but none match the available event categories. Check event setup before starting future matches.
                </p>
              ) : (
                <div className="-mx-2 overflow-x-auto px-2">
                  <div className="flex gap-2 pb-1">
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
                            if (firstCategoryEvent) setSelectedEventKey(getEventOptionKey(firstCategoryEvent))
                          }}
                          className={`min-h-10 shrink-0 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40 sm:text-sm ${
                            isSelected
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-200 bg-white text-gray-900'
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

          {eventOptions.length > 0 && recordingMode === 'PLAYER_FIRST' ? (
            <>
              <div className="sticky top-[6.8rem] z-10 -mx-2 border-b border-slate-100 bg-white/95 px-2 py-2 backdrop-blur sm:static sm:border-b-0 sm:bg-transparent sm:p-0">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {players.map((player) => {
                    const isSelected = effectiveSelectedPlayerId === player.matchDayPlayerId

                    return (
                      <button
                        key={player.matchDayPlayerId}
                        type="button"
                        onClick={() => setSelectedPlayerId(player.matchDayPlayerId)}
                        className={`min-h-11 min-w-[7.25rem] shrink-0 rounded-xl border px-3 py-2 text-left font-medium ${
                          isSelected
                            ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-gray-900'
                        }`}
                      >
                        <span className="block truncate text-xs font-black sm:text-sm">{formatPlayerName(player)}</span>
                        <span className={`block text-[11px] font-bold ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                          {formatSquadNumber(player.squadNumber)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-3">
                  {categoryEvents.length === 0 ? (
                    <p className="col-span-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      No selected event buttons are available in this category. Choose another category above.
                    </p>
                  ) : categoryEvents.map((eventOption) => {
                      const eventOptionKey = getEventOptionKey(eventOption)
                      const pendingKey = selectedPlayer
                        ? getPendingEventKey(eventOption, selectedPlayer.matchDayPlayerId)
                        : eventOptionKey

                    return (
                      <button
                        key={eventOptionKey}
                        type="button"
                        onClick={() => recordEvent(eventOption, selectedPlayer)}
                        className="min-h-14 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-sm font-black text-slate-950 shadow-sm disabled:opacity-50"
                        disabled={!selectedPlayer || Boolean(pendingAction)}
                      >
                        <span className="block truncate">{pendingAction === pendingKey ? 'Saving...' : eventOption.label}</span>
                        {eventOption.requiresLocation && <span className="mt-1 block text-[10px] font-bold uppercase text-emerald-700">Location</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : eventOptions.length > 0 ? (
            <>
              <div>
                <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-3 sm:grid-cols-3">
                  {categoryEvents.length === 0 ? (
                    <p className="col-span-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      No selected event buttons are available in this category. Choose another category above.
                    </p>
                  ) : categoryEvents.map((eventOption) => {
                    const eventOptionKey = getEventOptionKey(eventOption)
                    const isSelected = effectiveSelectedEventKey === eventOptionKey

                    return (
                      <button
                        key={eventOptionKey}
                        type="button"
                        onClick={() => setSelectedEventKey(eventOptionKey)}
                        className={`min-h-14 rounded-xl border px-2 py-2 text-center text-sm font-black ${
                          isSelected
                            ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-gray-900 shadow-sm'
                        }`}
                      >
                        <span className="block truncate">{eventOption.label}</span>
                        {eventOption.requiresLocation && <span className={`mt-1 block text-[10px] font-bold uppercase ${isSelected ? 'text-blue-100' : 'text-emerald-700'}`}>Location</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {players.map((player) => {
                    const pendingKey = selectedEvent
                      ? getPendingEventKey(selectedEvent, player.matchDayPlayerId)
                      : ''

                    return (
                      <button
                        key={player.matchDayPlayerId}
                        type="button"
                        onClick={() => recordEvent(selectedEvent, player)}
                        className="min-h-11 min-w-[7.25rem] shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left font-medium text-gray-900 disabled:opacity-50"
                        disabled={!selectedEvent || Boolean(pendingAction)}
                      >
                        <span className="block truncate text-xs font-black sm:text-sm">
                          {pendingAction === pendingKey ? 'Saving...' : formatPlayerName(player)}
                        </span>
                        <span className="block text-[11px] font-bold text-gray-500">
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur sm:static sm:mt-4 sm:rounded-xl sm:border sm:bg-gray-50 sm:shadow-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="min-w-0 text-xs">
            <p className="font-black text-slate-950">
              {latestEvent ? `${latestEvent.label} · ${latestEvent.playerName}` : 'No events yet'}
            </p>
            <p className="text-slate-500">
              {latestEvent ? `${formatHalf(latestEvent.half)} ${formatMatchTime(latestEvent.matchSecond)} · ${latestEvent.ownScoreAtTime}-${latestEvent.oppositionScoreAtTime}` : `${recordingMode === 'PLAYER_FIRST' ? 'Player first' : 'Event first'} mode`}
            </p>
          </div>
          {latestEvent && !isReadOnly && (
            <button
              type="button"
              onClick={() => undoEvent(latestEvent.id)}
              className="min-h-10 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700 disabled:opacity-50"
              disabled={Boolean(pendingAction)}
            >
              {pendingAction === latestEvent.id ? 'Undoing...' : 'Undo'}
            </button>
          )}
        </div>
      </div>

      <details className="mt-3 rounded-xl border bg-gray-50 p-3 text-sm">
        <summary className="cursor-pointer text-sm font-bold text-gray-900">
          Full event history ({events.length})
        </summary>
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
                      {formatHalf(event.half)} {formatMatchTime(event.matchSecond)} · {event.label}
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

      <PitchLocationPicker
        isOpen={pendingLocationEvent !== null}
        onSelect={recordEventLocation}
        onClose={() => {
          if (!pendingAction) setPendingLocationEvent(null)
        }}
      />

    </section>
  )
}
