'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import PitchLocationPicker, { type PitchLocation } from '@/components/PitchLocationPicker'
import ModalShell from '@/components/ui/ModalShell'

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
  allowTeamEvents: boolean
  events: RecentEvent[]
  eventOptions: readonly EventOption[]
  categoryOptions: readonly EventCategoryOption[]
  recordMatchEventAction: (formData: FormData) => Promise<MatchActionResult>
  deleteMatchEventAction: (formData: FormData) => Promise<MatchActionResult>
}

const formatPlayerName = (player: EventPlayer) =>
  `${player.firstName} ${player.surname}`

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
  allowTeamEvents,
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
  const [isPlayerPickerOpen, setIsPlayerPickerOpen] = useState(false)
  const [pendingLocationEvent, setPendingLocationEvent] = useState<{
    eventOption: EventOption
    player: EventPlayer | null
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
  const selectedTargetLabel = selectedPlayer ? formatPlayerName(selectedPlayer) : allowTeamEvents ? 'Whole team' : 'Select player'
  const selectedEvent = eventOptions.find(
    (eventOption) => getEventOptionKey(eventOption) === effectiveSelectedEventKey
  )
  const categoryEvents = eventOptions.filter(
    (eventOption) => eventOption.category === effectiveSelectedCategory
  )
  const latestEvent = events[0] ?? null

  const selectPlayer = (matchDayPlayerId: string) => {
    setSelectedPlayerId(matchDayPlayerId)
    setIsPlayerPickerOpen(false)
  }

  const appendEventFields = (formData: FormData, eventOption: EventOption) => {
    if (eventOption.eventDefinitionId) {
      formData.set('eventDefinitionId', eventOption.eventDefinitionId)
    } else if (eventOption.legacyEventType) {
      formData.set('eventType', eventOption.legacyEventType)
    }
  }

  const recordEvent = async (eventOption: EventOption | undefined, player: EventPlayer | undefined) => {
    if (!canRecord || pendingAction || pendingLocationEvent || (!player && !allowTeamEvents) || !eventOption) return

    if (eventOption.requiresLocation) {
      setMessage(null)
      setError(null)
      setPendingLocationEvent({ eventOption, player: player ?? null })
      return
    }

    setPendingAction(player ? getPendingEventKey(eventOption, player.matchDayPlayerId) : getEventOptionKey(eventOption))
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    if (player) formData.set('matchDayPlayerId', player.matchDayPlayerId)
    appendEventFields(formData, eventOption)

    try {
      const result = await recordMatchEventAction(formData)

      if (result.ok) {
        setMessage(`${eventOption.label} recorded for ${player ? formatPlayerName(player) : 'Whole team'}.`)
        router.refresh()
      } else {
        setError(result.reason)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setPendingAction(null)
    }
  }

  const recordEventLocation = async (location: PitchLocation) => {
    if (!pendingLocationEvent || pendingAction) return

    const { eventOption, player } = pendingLocationEvent
    const pendingKey = player ? getPendingEventKey(eventOption, player.matchDayPlayerId) : getEventOptionKey(eventOption)

    setPendingAction(pendingKey)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    if (player) formData.set('matchDayPlayerId', player.matchDayPlayerId)
    appendEventFields(formData, eventOption)
    formData.set('x', String(location.x))
    formData.set('y', String(location.y))

    try {
      const result = await recordMatchEventAction(formData)

      if (result.ok) {
        setMessage(`${eventOption.label} recorded for ${player ? formatPlayerName(player) : 'Whole team'}.`)
        setPendingLocationEvent(null)
        router.refresh()
      } else {
        setError(result.reason)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setPendingAction(null)
    }
  }

  const undoEvent = async (eventId: string) => {
    if (isReadOnly || pendingAction) return

    setPendingAction(eventId)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('matchEventId', eventId)

    try {
      const result = await deleteMatchEventAction(formData)

      if (result.ok) {
        setMessage('Event removed.')
        router.refresh()
      } else {
        setError(result.reason)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <section className="rounded-xl bg-white p-2 shadow-sm sm:p-4">
      <div className="sticky top-16 z-20 border-b border-slate-200 bg-white/95 pb-2 pt-1 backdrop-blur sm:static sm:border-b-0 sm:bg-transparent sm:p-0">
        <div className="grid gap-2">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Events</p>
              <p className="break-words text-sm font-extrabold leading-tight text-slate-950">
                {selectedTargetLabel}
              </p>
            </div>
            {!allowTeamEvents && (
              <button
                type="button"
                onClick={() => setIsPlayerPickerOpen(true)}
                className="min-h-10 shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 disabled:opacity-50"
                disabled={players.length === 0 || Boolean(pendingAction)}
              >
                Change player
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-[11px] font-bold">
            <button
              type="button"
              role="radio"
              aria-checked={recordingMode === 'PLAYER_FIRST'}
              onClick={() => setRecordingMode('PLAYER_FIRST')}
              className={`rounded-md px-2 py-1.5 ${recordingMode === 'PLAYER_FIRST' ? 'bg-blue-700 text-white' : 'text-slate-700'}`}
            >
              Player
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={recordingMode === 'EVENT_FIRST'}
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

      {canRecord && players.length === 0 && !allowTeamEvents && (
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

      {canRecord && (players.length > 0 || allowTeamEvents) && (
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
                <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-3">
                    {visibleCategories.map((category) => {
                      const isSelected = effectiveSelectedCategory === category.value

                      return (
                        <button
                          key={category.value}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedCategory(category.value)
                            const firstCategoryEvent = eventOptions.find(
                              (eventOption) => eventOption.category === category.value
                            )
                            if (firstCategoryEvent) setSelectedEventKey(getEventOptionKey(firstCategoryEvent))
                          }}
                          className={`min-h-10 min-w-0 rounded-lg border px-2 py-2 text-xs font-bold leading-tight disabled:opacity-40 sm:text-sm ${
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
              )}
            </>
          )}

          {eventOptions.length > 0 && recordingMode === 'PLAYER_FIRST' ? (
            <>
              <div>
                <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
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
                        aria-busy={pendingAction === pendingKey || undefined}
                        onClick={() => recordEvent(eventOption, selectedPlayer)}
                        className="min-h-14 min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-xs font-black leading-tight text-slate-950 shadow-sm disabled:opacity-50 sm:text-sm"
                        disabled={(!selectedPlayer && !allowTeamEvents) || Boolean(pendingAction)}
                      >
                        <span className="block break-words">{pendingAction === pendingKey ? 'Saving...' : eventOption.label}</span>
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
                <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
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
                        aria-pressed={isSelected}
                        aria-busy={pendingAction === (selectedPlayer ? getPendingEventKey(eventOption, selectedPlayer.matchDayPlayerId) : eventOptionKey) || undefined}
                        onClick={() => {
                          setSelectedEventKey(eventOptionKey)
                          void recordEvent(eventOption, selectedPlayer)
                        }}
                        className={`min-h-14 min-w-0 rounded-xl border px-2 py-2 text-center text-xs font-black leading-tight sm:text-sm ${
                          isSelected
                            ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-gray-900 shadow-sm'
                        }`}
                        disabled={(!selectedPlayer && !allowTeamEvents) || Boolean(pendingAction)}
                      >
                        <span className="block break-words">{pendingAction === (selectedPlayer ? getPendingEventKey(eventOption, selectedPlayer.matchDayPlayerId) : eventOptionKey) ? 'Saving...' : eventOption.label}</span>
                        {eventOption.requiresLocation && <span className={`mt-1 block text-[10px] font-bold uppercase ${isSelected ? 'text-blue-100' : 'text-emerald-700'}`}>Location</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedEvent && (selectedPlayer || allowTeamEvents) && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">
                  {selectedEvent.label} selected for {selectedPlayer ? formatPlayerName(selectedPlayer) : 'Whole team'}.
                </p>
              )}
            </>
          ) : null}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur sm:static sm:mt-4 sm:rounded-xl sm:border sm:bg-gray-50 sm:shadow-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="min-w-0 text-xs">
            <p className="break-words font-black leading-tight text-slate-950">
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

      {isPlayerPickerOpen && (
        <ModalShell
          title="Change player"
          description="Choose the tracked player for the next event."
          onClose={() => setIsPlayerPickerOpen(false)}
          maxWidthClassName="max-w-lg"
        >
          {players.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-slate-600">
              No tracked on-pitch players are available.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {players.map((player) => {
                const isSelected = effectiveSelectedPlayerId === player.matchDayPlayerId

                return (
                  <button
                    key={player.matchDayPlayerId}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectPlayer(player.matchDayPlayerId)}
                    className={`min-h-11 min-w-0 rounded-lg border px-2 py-2 text-left text-sm font-black leading-tight ${
                      isSelected
                        ? 'border-blue-700 bg-blue-700 text-white'
                        : 'border-slate-200 bg-white text-slate-950'
                    }`}
                  >
                    <span className="break-words">{formatPlayerName(player)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </ModalShell>
      )}

    </section>
  )
}
