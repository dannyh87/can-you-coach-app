'use client'

import { useState } from 'react'

import ModalShell from '@/components/ui/ModalShell'

type MatchLiveDetailsButtonProps = {
  headline: string
  dateLabel: string
  matchTypeLabel: string
  venueLabel: string
  statusLabel: string
  teamName: string
  opposition: string
  starterCount: number
  substituteCount: number
  trackedCount: number
  selectedEventLabels: string[]
}

export default function MatchLiveDetailsButton({
  headline,
  dateLabel,
  matchTypeLabel,
  venueLabel,
  statusLabel,
  teamName,
  opposition,
  starterCount,
  substituteCount,
  trackedCount,
  selectedEventLabels,
}: MatchLiveDetailsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-10 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
        aria-label={`Open match details for ${headline}`}
      >
        Details
      </button>

      {isOpen && (
        <ModalShell
          title="Match details"
          description="Reference only. Match timers, scores and recordings continue unchanged."
          onClose={() => setIsOpen(false)}
          maxWidthClassName="max-w-xl"
        >
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="text-lg font-bold text-slate-950">{headline}</h3>
              <p className="mt-1 text-slate-600">
                {teamName} vs {opposition}
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-gray-50 p-3">
                <dt className="font-bold text-slate-900">Date</dt>
                <dd className="mt-1 text-slate-600">{dateLabel}</dd>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <dt className="font-bold text-slate-900">Status</dt>
                <dd className="mt-1 text-slate-600">{statusLabel}</dd>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <dt className="font-bold text-slate-900">Match type</dt>
                <dd className="mt-1 text-slate-600">{matchTypeLabel}</dd>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <dt className="font-bold text-slate-900">Venue</dt>
                <dd className="mt-1 text-slate-600">{venueLabel}</dd>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <dt className="font-bold text-slate-900">Squad</dt>
                <dd className="mt-1 text-slate-600">
                  {starterCount} starters, {substituteCount} substitutes
                </dd>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <dt className="font-bold text-slate-900">Tracked players</dt>
                <dd className="mt-1 text-slate-600">{trackedCount}</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <p className="font-bold">Setup is locked after kick-off</p>
              <p className="mt-1">
                Squad setup, tracking focus and selected event types are read-only during live play.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-slate-950">Selected events</h3>
              {selectedEventLabels.length === 0 ? (
                <p className="mt-2 rounded-lg border p-3 text-slate-600">
                  No player event types were selected before kick-off.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedEventLabels.map((label) => (
                    <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
