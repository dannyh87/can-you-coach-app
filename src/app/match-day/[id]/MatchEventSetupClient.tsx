'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getMatchDayGroupLabel, type RecordableEventOption } from '@/lib/eventDefinitions'

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type EventOption = {
  label: string
  value: string
}

type EventDisplayGroup = {
  label: string
  events: RecordableEventOption[]
}

type MatchEventSetupClientProps = {
  matchDayId: string
  eventOptions: readonly RecordableEventOption[]
  categoryOptions: readonly EventOption[]
  selectedEventDefinitionIds: string[]
  updateMatchEventSetupAction: (formData: FormData) => Promise<MatchActionResult>
}

export default function MatchEventSetupClient({
  matchDayId,
  eventOptions,
  selectedEventDefinitionIds,
  updateMatchEventSetupAction,
}: MatchEventSetupClientProps) {
  const router = useRouter()
  const [selectedValues, setSelectedValues] = useState<string[]>(selectedEventDefinitionIds)
  const [openGroupLabels, setOpenGroupLabels] = useState<string[]>(() =>
    getDefaultOpenEventGroupLabels(eventOptions, selectedEventDefinitionIds)
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [subcategoryFilter, setSubcategoryFilter] = useState('ALL')
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(
    eventOptions.some((eventOption) => eventOption.requiresLocation && selectedEventDefinitionIds.includes(eventOption.id))
  )
  const [locationTrackingWarning, setLocationTrackingWarning] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleEventDefinition = (eventDefinitionId: string) => {
    setSelectedValues((currentValues) =>
      currentValues.includes(eventDefinitionId)
        ? currentValues.filter((value) => value !== eventDefinitionId)
        : [...currentValues, eventDefinitionId]
    )
  }

  const useDefaultSet = () => {
    setSelectedValues(eventOptions
      .filter((eventOption) => eventOption.enabledByDefault)
      .filter((eventOption) => locationTrackingEnabled || !eventOption.requiresLocation)
      .map((eventOption) => eventOption.id))
  }
  const setLocationTracking = (enabled: boolean) => {
    setLocationTrackingEnabled(enabled)
    setLocationTrackingWarning(null)

    if (!enabled) {
      const locationEventIds = new Set(eventOptions.filter((eventOption) => eventOption.requiresLocation).map((eventOption) => eventOption.id))
      setSelectedValues((currentValues) => {
        const nextValues = currentValues.filter((eventDefinitionId) => !locationEventIds.has(eventDefinitionId))

        if (nextValues.length !== currentValues.length) {
          setLocationTrackingWarning('Turning location tracking off will remove selected location-based events from this match setup.')
        }

        return nextValues
      })
    }
  }
  const subcategoryOptions = Array.from(new Set(eventOptions.map((eventOption) => eventOption.subcategory).filter((subcategory): subcategory is string => Boolean(subcategory)))).sort()
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const visibleEventOptions = eventOptions.filter((eventOption) => {
    if (!locationTrackingEnabled && eventOption.requiresLocation) return false
    if (normalizedSearchTerm && !`${eventOption.label} ${eventOption.description ?? ''}`.toLowerCase().includes(normalizedSearchTerm)) return false
    if (subcategoryFilter !== 'ALL' && eventOption.subcategory !== subcategoryFilter) return false
    return true
  })
  const selectedEventOptions = eventOptions.filter((eventOption) => selectedValues.includes(eventOption.id))
  const selectedSummaryEvents = selectedEventOptions.slice(0, 8)
  const hiddenSelectedCount = Math.max(0, selectedEventOptions.length - selectedSummaryEvents.length)
  const eventGroups = getEventDisplayGroups(visibleEventOptions)

  const saveEventSetup = async () => {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    selectedValues.forEach((eventDefinitionId) => formData.append('eventDefinitionId', eventDefinitionId))

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
    <section className="rounded-2xl bg-gray-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Event setup</h2>
          <p className="mt-1 text-sm text-gray-400">
            Choose the event buttons coaches will see during live play. These are locked once the match starts.
          </p>
        </div>
        <button
          type="button"
          onClick={useDefaultSet}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm disabled:opacity-50"
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
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Selected events appear in Event recording after kick-off, once tracked players are on the pitch.
        </p>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Optional tracking extras</p>
          <label className="mt-3 flex items-start gap-3 font-bold">
            <input
              type="checkbox"
              checked={locationTrackingEnabled}
              onChange={(event) => setLocationTracking(event.target.checked)}
              className="mt-1"
              disabled={isSaving}
            />
            <span>
              Location tracking
              <span className="mt-1 block font-normal leading-6 text-amber-900">
                Location tracking adds extra taps during the match. Choose a small number of events if you are recording live on your own.
              </span>
            </span>
          </label>
          {locationTrackingWarning && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-white/80 p-3 font-semibold text-amber-950">
              {locationTrackingWarning}
            </p>
          )}
        </section>
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Search events
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Search by name or description"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Subcategory
            <select value={subcategoryFilter} onChange={(event) => setSubcategoryFilter(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value="ALL">All</option>
              {subcategoryOptions.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
            </select>
          </label>
        </div>
        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-slate-950">
                {selectedValues.length} events selected
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                These buttons will be available during live event recording.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Match setup
            </span>
          </div>
          {selectedEventOptions.length === 0 ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Select at least one event before starting the match.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSummaryEvents.map((eventOption) => (
                <span key={eventOption.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {eventOption.label}
                </span>
              ))}
              {hiddenSelectedCount > 0 && (
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                  +{hiddenSelectedCount} more
                </span>
              )}
            </div>
          )}
        </section>

        {eventGroups.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
            No events match the current filters.
          </p>
        ) : eventGroups.map((group) => {
          const selectedCount = group.events.filter((eventOption) => selectedValues.includes(eventOption.id)).length
          const isGroupOpen = openGroupLabels.includes(group.label)

          return (
            <details
              key={group.label}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              open={isGroupOpen}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open
                setOpenGroupLabels((currentLabels) =>
                  isOpen
                    ? Array.from(new Set([...currentLabels, group.label]))
                    : currentLabels.filter((label) => label !== group.label)
                )
              }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden">
                <div>
                  <h3 className="text-base font-extrabold text-slate-950">
                    {group.label}
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {group.events.length} events · {selectedCount} selected
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Open
                </span>
              </summary>
              <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
                {group.events.map((eventOption) => {
                    const isSelected = selectedValues.includes(eventOption.id)

                    return (
                      <article
                        key={eventOption.id}
                        className={`rounded-2xl border text-left text-sm transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-950 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-900 hover:border-emerald-200 hover:bg-emerald-50/40'
                        }`}
                      >
                        <label className="flex min-h-24 cursor-pointer items-start gap-3 p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEventDefinition(eventOption.id)}
                            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                            disabled={isSaving}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block text-base font-extrabold">{eventOption.label}</span>
                            <span className="mt-1 block text-xs font-semibold uppercase tracking-wide opacity-70">
                              {eventOption.subcategory ?? eventOption.categoryLabel}
                            </span>
                            <span className="mt-3 flex flex-wrap gap-1">
                              {eventOption.enabledByDefault && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">Default</span>}
                              {eventOption.requiresLocation && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Requires pitch location</span>}
                              {isSelected && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-[11px] font-bold text-white">Selected</span>}
                            </span>
                          </div>
                        </label>
                        <EventGuidanceDetails event={eventOption} />
                      </article>
                    )
                })}
              </div>
            </details>
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

function getDefaultOpenEventGroupLabels(events: readonly RecordableEventOption[], selectedEventIds: string[]) {
  const selectedEventIdSet = new Set(selectedEventIds)

  return getEventDisplayGroups([...events])
    .filter((group) => group.events.some((event) => selectedEventIdSet.has(event.id) || event.enabledByDefault))
    .map((group) => group.label)
}

function getEventDisplayGroups(events: RecordableEventOption[]): EventDisplayGroup[] {
  const groupOrder = [
    'Goals & Outcomes',
    'Shooting',
    'Passing',
    'Possession',
    'Defending',
    'Discipline',
    'Goalkeeping',
    'Custom / Other',
  ]
  const groups = new Map(groupOrder.map((label) => [label, [] as RecordableEventOption[]]))

  for (const event of events) {
    const groupLabel = getEventDisplayGroupLabel(event)
    groups.get(groupLabel)?.push(event)
  }

  return groupOrder
    .map((label) => ({ label, events: groups.get(label) ?? [] }))
    .filter((group) => group.events.length > 0)
}

function getEventDisplayGroupLabel(event: RecordableEventOption) {
  const configuredGroupLabel = getMatchDayGroupLabel(event.matchDayGroup)
  if (configuredGroupLabel) return configuredGroupLabel

  const searchableText = `${event.label} ${event.category} ${event.categoryLabel} ${event.subcategory ?? ''} ${event.legacyEventType ?? ''}`.toLowerCase()

  if (event.legacyEventType === 'GOAL' || event.legacyEventType === 'ASSIST' || searchableText.includes('goal') || searchableText.includes('assist') || searchableText.includes('outcome')) {
    return 'Goals & Outcomes'
  }
  if (searchableText.includes('shot') || searchableText.includes('shooting') || searchableText.includes('finish')) return 'Shooting'
  if (searchableText.includes('pass') || searchableText.includes('cross')) return 'Passing'
  if (event.matchPhase === 'IN_POSSESSION' || searchableText.includes('possession') || searchableText.includes('touch') || searchableText.includes('receiving') || searchableText.includes('dribbling') || searchableText.includes('1v1')) return 'Possession'
  if (event.matchPhase === 'OUT_OF_POSSESSION' || searchableText.includes('defend') || searchableText.includes('tackle') || searchableText.includes('interception') || searchableText.includes('press')) return 'Defending'
  if (event.matchPhase === 'DISCIPLINE' || searchableText.includes('discipline') || searchableText.includes('card') || searchableText.includes('foul')) return 'Discipline'
  if (searchableText.includes('goalkeep') || searchableText.includes('keeper') || searchableText.includes('save')) return 'Goalkeeping'
  return 'Custom / Other'
}

function EventGuidanceDetails({ event }: { event: RecordableEventOption }) {
  const hasGuidance = event.description || event.videoUrl || event.requiresLocation || event.subcategory
  if (!hasGuidance) return null

  return (
    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-sm">
      <summary className="cursor-pointer text-xs font-bold text-blue-800">
        Recording guidance
      </summary>
      <div className="mt-2 space-y-2 text-slate-700">
        <div>
          <p className="font-bold text-slate-950">{event.label}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {event.categoryLabel}{event.subcategory ? ` · ${event.subcategory}` : ''}
          </p>
        </div>
        {event.description && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">What to count</p>
            <p className="mt-1 text-sm">{event.description}</p>
          </div>
        )}
        {event.requiresLocation && (
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            Requires pitch location
          </span>
        )}
        {event.videoUrl && (
          <a
            href={event.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-bold text-blue-700 hover:underline"
          >
            Watch guidance
          </a>
        )}
      </div>
    </details>
  )
}
