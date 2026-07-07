'use client'

import { useState } from 'react'

import EmptyState from '@/components/ui/EmptyState'

export type TouchMapEvent = {
  id: string
  x: number | null | undefined
  y: number | null | undefined
  label?: string | null
  playerName?: string | null
  half?: string | null
  minute?: number | null
}

type TouchMapProps = {
  events: TouchMapEvent[]
}

const periodOptions = ['First half', 'Second half'] as const

const isLocatedTouch = (
  event: TouchMapEvent
): event is TouchMapEvent & { x: number; y: number } =>
  typeof event.x === 'number' &&
  Number.isFinite(event.x) &&
  typeof event.y === 'number' &&
  Number.isFinite(event.y)

const getTouchLabel = (event: TouchMapEvent) => {
  const details = [
    event.playerName,
    event.half,
    event.minute !== null && event.minute !== undefined ? `${event.minute}'` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const eventLabel = event.label ?? 'Location event'

  return details ? `${eventLabel}: ${details}` : eventLabel
}

export default function TouchMap({ events }: TouchMapProps) {
  const locatedTouches = events.filter(isLocatedTouch)
  const playerNames = Array.from(
    new Set(locatedTouches.map((event) => event.playerName).filter((playerName): playerName is string => Boolean(playerName)))
  ).sort((firstPlayer, secondPlayer) => firstPlayer.localeCompare(secondPlayer))
  const eventLabels = Array.from(
    new Set(locatedTouches.map((event) => event.label).filter((label): label is string => Boolean(label)))
  ).sort((firstEvent, secondEvent) => firstEvent.localeCompare(secondEvent))
  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const [selectedEventLabel, setSelectedEventLabel] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const availablePeriods = periodOptions.filter((period) =>
    locatedTouches.some((event) => event.half === period)
  )
  const playerFilteredTouches = selectedPlayerName
    ? locatedTouches.filter((event) => event.playerName === selectedPlayerName)
    : locatedTouches
  const eventFilteredTouches = selectedEventLabel
    ? playerFilteredTouches.filter((event) => event.label === selectedEventLabel)
    : playerFilteredTouches
  const visibleTouches = selectedPeriod
    ? eventFilteredTouches.filter((event) => event.half === selectedPeriod)
    : eventFilteredTouches
  const selectedPlayerTouchCount = selectedPlayerName
    ? locatedTouches.filter((event) => event.playerName === selectedPlayerName).length
    : null

  if (locatedTouches.length === 0) {
    return (
      <EmptyState
        eyebrow="Location maps"
        title="No location events recorded yet."
        description="Record events that require pitch location during live match play and tap the pitch to plot them here."
      />
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Shown</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-950">{visibleTouches.length}</p>
          <p className="text-xs text-slate-600">located event{visibleTouches.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Players</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-950">{playerNames.length}</p>
          <p className="text-xs text-slate-600">with located events</p>
        </div>
        {selectedPlayerName && selectedPlayerTouchCount !== null && (
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Selected player</p>
            <p className="mt-1 text-2xl font-extrabold text-blue-950">{selectedPlayerTouchCount}</p>
            <p className="truncate text-xs text-blue-900">{selectedPlayerName}</p>
          </div>
        )}
      </div>

      <div className="mb-3 space-y-2">
        {eventLabels.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedEventLabel('')}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
                selectedEventLabel === ''
                  ? 'border-purple-700 bg-purple-50 text-purple-950 ring-2 ring-purple-200'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              All events
            </button>
            {eventLabels.map((eventLabel) => (
              <button
                key={eventLabel}
                type="button"
                onClick={() => setSelectedEventLabel(eventLabel)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
                  selectedEventLabel === eventLabel
                    ? 'border-purple-700 bg-purple-50 text-purple-950 ring-2 ring-purple-200'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {eventLabel}
              </button>
            ))}
          </div>
        )}

        {playerNames.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedPlayerName('')}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
                selectedPlayerName === ''
                  ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              All players
            </button>
            {playerNames.map((playerName) => (
              <button
                key={playerName}
                type="button"
                onClick={() => setSelectedPlayerName(playerName)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
                  selectedPlayerName === playerName
                    ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {playerName}
              </button>
            ))}
          </div>
        )}

        {availablePeriods.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedPeriod('')}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
                selectedPeriod === ''
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              All periods
            </button>
            {availablePeriods.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
                  selectedPeriod === period
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative h-[420px] overflow-hidden rounded-2xl border-4 border-white bg-emerald-700 shadow-inner outline outline-1 outline-emerald-900/20 sm:h-[520px]">
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_50%,transparent_50%)] bg-[length:18%_100%]" />
        <span className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/85" />
        <span className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-0.5 -translate-x-1/2 bg-white/85" />
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/85 sm:h-32 sm:w-32" />
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" />

        <span className="pointer-events-none absolute left-3 top-1/2 h-44 w-16 -translate-y-1/2 border-2 border-l-0 border-white/85 sm:h-56 sm:w-24" />
        <span className="pointer-events-none absolute right-3 top-1/2 h-44 w-16 -translate-y-1/2 border-2 border-r-0 border-white/85 sm:h-56 sm:w-24" />
        <span className="pointer-events-none absolute left-3 top-1/2 h-20 w-7 -translate-y-1/2 border-2 border-l-0 border-white/85 sm:h-28 sm:w-10" />
        <span className="pointer-events-none absolute right-3 top-1/2 h-20 w-7 -translate-y-1/2 border-2 border-r-0 border-white/85 sm:h-28 sm:w-10" />
        <span className="pointer-events-none absolute left-0 top-1/2 h-16 w-3 -translate-y-1/2 rounded-r border-2 border-l-0 border-white/85" />
        <span className="pointer-events-none absolute right-0 top-1/2 h-16 w-3 -translate-y-1/2 rounded-l border-2 border-r-0 border-white/85" />

        {visibleTouches.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className="rounded-2xl bg-white/95 p-4 text-center shadow-lg">
              <p className="text-base font-extrabold text-slate-950">No location events match this filter.</p>
              <p className="mt-1 text-sm text-slate-600">Try All events, All players or All periods.</p>
            </div>
          </div>
        )}

        {visibleTouches.map((event) => (
          <span
            key={event.id}
            className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow-lg ring-2 ring-blue-300/60"
            style={{ left: `${event.x}%`, top: `${event.y}%` }}
            title={getTouchLabel(event)}
            aria-label={getTouchLabel(event)}
          />
        ))}
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Showing {visibleTouches.length} located event{visibleTouches.length === 1 ? '' : 's'}.
      </p>
    </div>
  )
}
