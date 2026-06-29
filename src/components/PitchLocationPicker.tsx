'use client'

import { useState, type PointerEvent } from 'react'

import Button from '@/components/ui/Button'

export type PitchLocation = {
  x: number
  y: number
}

type PitchLocationPickerProps = {
  isOpen: boolean
  onSelect: (location: PitchLocation) => void
  onClose: () => void
}

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value))

export default function PitchLocationPicker({
  isOpen,
  onSelect,
  onClose,
}: PitchLocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<PitchLocation | null>(null)

  if (!isOpen) return null

  const selectLocation = (event: PointerEvent<HTMLButtonElement>) => {
    const pitchBounds = event.currentTarget.getBoundingClientRect()
    const x = clampPercentage(((event.clientX - pitchBounds.left) / pitchBounds.width) * 100)
    const y = clampPercentage(((event.clientY - pitchBounds.top) / pitchBounds.height) * 100)
    const location = { x, y }

    setSelectedLocation(location)
    onSelect(location)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pitch-location-title">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pitch-location-title" className="text-xl font-extrabold text-slate-950 sm:text-2xl">
              Pick pitch location
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              Tap where the touch happened.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <div className="mt-4 min-h-0 flex-1">
          <button
            type="button"
            onPointerDown={selectLocation}
            className="relative h-[68vh] min-h-[420px] w-full overflow-hidden rounded-2xl border-4 border-white bg-emerald-700 shadow-inner outline outline-1 outline-emerald-900/20 focus-visible:ring-4 focus-visible:ring-emerald-300 sm:h-[70vh]"
            aria-label="Football pitch. Tap to choose the event location."
          >
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

            {selectedLocation && (
              <span
                className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-600 shadow-lg ring-4 ring-blue-300/60"
                style={{ left: `${selectedLocation.x}%`, top: `${selectedLocation.y}%` }}
              />
            )}
          </button>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          {selectedLocation ? (
            <p>
              Selected: x {selectedLocation.x.toFixed(1)}, y {selectedLocation.y.toFixed(1)}
            </p>
          ) : (
            <p>x runs goal line to goal line. y runs top touchline to bottom touchline.</p>
          )}
        </div>
      </div>
    </div>
  )
}
