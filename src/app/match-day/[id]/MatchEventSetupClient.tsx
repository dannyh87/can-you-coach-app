'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type EventOption = {
  value: MatchEventType
  label: string
  category: MatchEventCategory
}

type EventCategoryOption = {
  value: MatchEventCategory
  label: string
}

type MatchEventSetupClientProps = {
  matchDayId: string
  eventOptions: readonly EventOption[]
  categoryOptions: readonly EventCategoryOption[]
  selectedEventTypes: MatchEventType[]
  updateMatchEventSetupAction: (formData: FormData) => Promise<MatchActionResult>
}

export default function MatchEventSetupClient({
  matchDayId,
  eventOptions,
  categoryOptions,
  selectedEventTypes,
  updateMatchEventSetupAction,
}: MatchEventSetupClientProps) {
  const router = useRouter()
  const [selectedValues, setSelectedValues] = useState<MatchEventType[]>(selectedEventTypes)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleEventType = (eventType: MatchEventType) => {
    setSelectedValues((currentValues) =>
      currentValues.includes(eventType)
        ? currentValues.filter((value) => value !== eventType)
        : [...currentValues, eventType]
    )
  }

  const useDefaultSet = () => {
    setSelectedValues(eventOptions.map((eventOption) => eventOption.value))
  }

  const saveEventSetup = async () => {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    selectedValues.forEach((eventType) => formData.append('eventType', eventType))

    const result = await updateMatchEventSetupAction(formData)

    if (result.ok) {
      setMessage('Event setup saved.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSaving(false)
  }

  return (
    <section className="rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Event setup</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose the standard event types available for this match before kick-off.
          </p>
        </div>
        <button
          type="button"
          onClick={useDefaultSet}
          className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={isSaving}
        >
          Use default event set
        </button>
      </div>

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

      <div className="mt-4 space-y-4">
        {categoryOptions.map((category) => {
          const categoryEvents = eventOptions.filter(
            (eventOption) => eventOption.category === category.value
          )

          return (
            <div key={category.value} className="rounded-lg border bg-gray-50 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                {category.label}
              </h3>
              {categoryEvents.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No standard events yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {categoryEvents.map((eventOption) => {
                    const isSelected = selectedValues.includes(eventOption.value)

                    return (
                      <button
                        key={eventOption.value}
                        type="button"
                        onClick={() => toggleEventType(eventOption.value)}
                        className={`rounded-lg border px-3 py-4 text-sm font-bold ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'bg-white text-gray-900'
                        }`}
                        disabled={isSaving}
                      >
                        {eventOption.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={saveEventSetup}
        className="mt-4 w-full rounded bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        disabled={isSaving || selectedValues.length === 0}
      >
        {isSaving ? 'Saving...' : 'Save event setup'}
      </button>
    </section>
  )
}
