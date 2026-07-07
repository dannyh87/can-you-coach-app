'use client'

import { useMemo, useState, useTransition } from 'react'

import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/formStyles'
import { WizardActions, WizardOptionCard, WizardShell } from '@/components/ui/Wizard'
import { agePhaseLabels, type AgePhase, type MatchPhase } from '@/lib/matchEventTaxonomy'

type SquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'

type TeamOption = {
  id: string
  name: string
  clubName: string
  ageGroup: string
  inferredAgePhase: AgePhase
  players: Array<{
    id: string
    name: string
    squadNumber: number | null
    preferredPosition: string | null
  }>
}

type TaxonomyEvent = {
  id: string
  label: string
  category: string
  categoryLabel: string
  subcategory: string | null
  description: string | null
  videoUrl: string | null
  matchPhase: MatchPhase
  matchPhaseLabel: string
  agePhases: AgePhase[]
  fourCorner: string
  positionRelevance: string[]
  requiresLocation: boolean
  enabledByDefault: boolean
}

type MatchPhaseGroup = {
  value: MatchPhase
  label: string
  events: TaxonomyEvent[]
}

type WizardResult = { ok: false; reason: string } | void

const today = () => new Date().toISOString().split('T')[0]

const getRecommendedEventDefinitionIds = (events: TaxonomyEvent[], locationTrackingEnabled: boolean) =>
  events
    .filter((event) => event.enabledByDefault)
    .filter((event) => locationTrackingEnabled || !event.requiresLocation)
    .map((event) => event.id)

const zeroEventValidationMessage = 'Select at least one event to track for this match.'

export default function MatchDayWizard({
  teams,
  matchPhaseGroups,
  createAction,
}: {
  teams: TeamOption[]
  matchPhaseGroups: MatchPhaseGroup[]
  createAction: (formData: FormData) => Promise<WizardResult>
}) {
  const [step, setStep] = useState(1)
  const [opposition, setOpposition] = useState('')
  const [date, setDate] = useState(today())
  const [kickoffTime, setKickoffTime] = useState('10:30')
  const [matchType, setMatchType] = useState('FRIENDLY')
  const [venue, setVenue] = useState('HOME')
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, SquadStatus>>({})
  const [eventSearchTerm, setEventSearchTerm] = useState('')
  const [eventMatchPhaseFilter, setEventMatchPhaseFilter] = useState('ALL')
  const [eventCategoryFilter, setEventCategoryFilter] = useState('ALL')
  const [eventSubcategoryFilter, setEventSubcategoryFilter] = useState('ALL')
  const [eventPositionFilter, setEventPositionFilter] = useState('ALL')
  const [eventFourCornerFilter, setEventFourCornerFilter] = useState('ALL')
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false)
  const [locationTrackingWarning, setLocationTrackingWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0]
  const allEvents = useMemo(
    () => matchPhaseGroups.flatMap((group) => group.events),
    [matchPhaseGroups]
  )
  const recommendedEventDefinitionIds = useMemo(
    () => getRecommendedEventDefinitionIds(allEvents, locationTrackingEnabled),
    [allEvents, locationTrackingEnabled]
  )
  const [selectedEventDefinitionIds, setSelectedEventDefinitionIds] = useState<string[]>([])
  const totalSteps = 6
  const selectedEventDefinitionIdSet = useMemo(() => new Set(selectedEventDefinitionIds), [selectedEventDefinitionIds])
  const starterCount = selectedTeam?.players.filter((player) => (playerStatuses[player.id] ?? 'NOT_INVOLVED') === 'STARTER').length ?? 0
  const substituteCount = selectedTeam?.players.filter((player) => (playerStatuses[player.id] ?? 'NOT_INVOLVED') === 'SUBSTITUTE').length ?? 0
  const involvedCount = starterCount + substituteCount
  const missingRequiredFields = [!opposition.trim() ? 'opposition' : null].filter(Boolean)
  const canCreateMatch = missingRequiredFields.length === 0

  const goNext = () => {
    if (step === 1 && !opposition.trim()) {
      setError('Add the opposition before continuing.')
      return
    }
    if (step === 5 && selectedEventDefinitionIds.length === 0) {
      setError(zeroEventValidationMessage)
      return
    }

    setError(null)
    setStep((currentStep) => Math.min(totalSteps, currentStep + 1))
  }
  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1))
  const setPlayerStatus = (playerId: string, squadStatus: SquadStatus) => {
    setPlayerStatuses((currentStatuses) => ({ ...currentStatuses, [playerId]: squadStatus }))
  }
  const selectRecommendedDefaults = () => setSelectedEventDefinitionIds(recommendedEventDefinitionIds)
  const setLocationTracking = (enabled: boolean) => {
    setLocationTrackingEnabled(enabled)
    setLocationTrackingWarning(null)

    if (!enabled) {
      const locationEventIds = new Set(
        allEvents.filter((event) => event.requiresLocation).map((event) => event.id)
      )
      setSelectedEventDefinitionIds((currentEventDefinitionIds) => {
        const nextEventDefinitionIds = currentEventDefinitionIds.filter((eventDefinitionId) => !locationEventIds.has(eventDefinitionId))

        if (nextEventDefinitionIds.length !== currentEventDefinitionIds.length) {
          setLocationTrackingWarning('Turning location tracking off will remove selected location-based events from this match setup.')
        }

        return nextEventDefinitionIds
      })
    }
  }
  const selectVisibleEvents = (visibleEventDefinitionIds: string[]) => {
    setSelectedEventDefinitionIds((currentEventDefinitionIds) =>
      Array.from(new Set([...currentEventDefinitionIds, ...visibleEventDefinitionIds]))
    )
  }
  const clearSelectedEvents = () => setSelectedEventDefinitionIds([])
  const toggleEventDefinition = (eventDefinitionId: string) => {
    setSelectedEventDefinitionIds((currentEventDefinitionIds) =>
      currentEventDefinitionIds.includes(eventDefinitionId)
        ? currentEventDefinitionIds.filter((value) => value !== eventDefinitionId)
        : [...currentEventDefinitionIds, eventDefinitionId]
    )
  }

  const createMatch = () => {
    setError(null)
    if (selectedEventDefinitionIds.length === 0) {
      setError(zeroEventValidationMessage)
      return
    }

    const formData = new FormData()
    formData.set('teamId', teamId)
    formData.set('date', date)
    formData.set('kickoffTime', kickoffTime)
    formData.set('opposition', opposition)
    formData.set('matchType', matchType)
    formData.set('venue', venue)
    selectedEventDefinitionIds.forEach((eventDefinitionId) => formData.append('eventDefinitionId', eventDefinitionId))
    selectedTeam?.players.forEach((player) => {
      formData.append('playerStatus', `${player.id}:${playerStatuses[player.id] ?? 'NOT_INVOLVED'}`)
    })

    startTransition(async () => {
      const result = await createAction(formData)
      if (result && !result.ok) setError(result.reason)
    })
  }

  if (teams.length === 0) {
    return <p className="rounded-xl border p-4 text-sm text-slate-600">Create a team before setting up Match Day.</p>
  }

  return (
    <WizardShell currentStep={step} totalSteps={totalSteps} title={getStepTitle(step)} description={getStepDescription(step)}>
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {step === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Opposition
            <input value={opposition} onChange={(event) => setOpposition(event.target.value)} className={fieldClassName} placeholder="Who are you playing?" />
            {!opposition.trim() && (
              <span className="mt-1 block text-xs font-semibold text-amber-700">
                Opposition is required before creating the match.
              </span>
            )}
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClassName} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Kick-off
            <input type="time" value={kickoffTime} onChange={(event) => setKickoffTime(event.target.value)} className={fieldClassName} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Match type
            <select value={matchType} onChange={(event) => setMatchType(event.target.value)} className={fieldClassName}>
              <option value="LEAGUE">League</option>
              <option value="CUP">Cup</option>
              <option value="FRIENDLY">Friendly</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Venue
            <select value={venue} onChange={(event) => setVenue(event.target.value)} className={fieldClassName}>
              <option value="HOME">Home</option>
              <option value="AWAY">Away</option>
              <option value="NEUTRAL">Neutral</option>
            </select>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          {teams.map((team) => (
            <WizardOptionCard
              key={team.id}
              title={team.name}
              description={team.clubName}
              meta={`${team.players.length} active players`}
              selected={team.id === teamId}
              onClick={() => {
                setTeamId(team.id)
              }}
            />
          ))}
        </div>
      )}

      {step === 3 && selectedTeam && (
        <div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
            <span className="rounded-full bg-green-100 px-3 py-1">Starters {starterCount}</span>
            <span className="rounded-full bg-blue-100 px-3 py-1">Subs {substituteCount}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Not involved {selectedTeam.players.length - involvedCount}</span>
          </div>
          <div className="grid gap-2">
            {selectedTeam.players.map((player) => {
              const status = playerStatuses[player.id] ?? 'NOT_INVOLVED'
              return (
                <article key={player.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-slate-950">{player.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {player.squadNumber === null ? 'No squad number' : `#${player.squadNumber}`} · {player.preferredPosition ?? 'No position'}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{formatStatus(status)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as SquadStatus[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPlayerStatus(player.id, option)}
                        className={`rounded-lg border px-2 py-2 text-xs font-bold ${status === option ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                      >
                        {formatStatus(option)}
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-xl border border-slate-200 p-4">
          <h2 className="font-bold text-slate-950">Match settings</h2>
          <p className="mt-2 text-sm text-slate-600">Venue is already set to {venue.toLowerCase()}. Half durations are not configurable in this version, so no admin-style match settings are needed.</p>
        </div>
      )}

      {step === 5 && (
        <EventPicker
          agePhase={selectedTeam?.inferredAgePhase ?? 'ALL'}
          events={allEvents}
          eventSearchTerm={eventSearchTerm}
          setEventSearchTerm={setEventSearchTerm}
          eventMatchPhaseFilter={eventMatchPhaseFilter}
          setEventMatchPhaseFilter={setEventMatchPhaseFilter}
          eventCategoryFilter={eventCategoryFilter}
          setEventCategoryFilter={setEventCategoryFilter}
          eventSubcategoryFilter={eventSubcategoryFilter}
          setEventSubcategoryFilter={setEventSubcategoryFilter}
          eventPositionFilter={eventPositionFilter}
          setEventPositionFilter={setEventPositionFilter}
          eventFourCornerFilter={eventFourCornerFilter}
          setEventFourCornerFilter={setEventFourCornerFilter}
          locationTrackingEnabled={locationTrackingEnabled}
          setLocationTrackingEnabled={setLocationTracking}
          locationTrackingWarning={locationTrackingWarning}
          selectedEventDefinitionIdSet={selectedEventDefinitionIdSet}
          selectedEventCount={selectedEventDefinitionIds.length}
          onToggleEvent={toggleEventDefinition}
          onSelectRecommendedDefaults={selectRecommendedDefaults}
          onSelectVisibleEvents={selectVisibleEvents}
          onClearAll={clearSelectedEvents}
        />
      )}

      {step === 6 && selectedTeam && (
        <div className="space-y-3">
          {!canCreateMatch && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Add the opposition before creating this match.
            </p>
          )}
          <ReviewRow label="Opposition" value={opposition || 'Not set'} />
          <ReviewRow label="Date" value={`${date} at ${kickoffTime}`} />
          <ReviewRow label="Team" value={`${selectedTeam.clubName} / ${selectedTeam.name}`} />
          <ReviewRow label="Squad" value={`${starterCount} starters, ${substituteCount} substitutes`} />
          <ReviewRow label="Age suggestion" value={agePhaseLabels[selectedTeam.inferredAgePhase]} />
          <ReviewRow label="Events" value={`${selectedEventDefinitionIds.length} selected`} />
        </div>
      )}

      <WizardActions>
        <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1 || isPending}>Back</Button>
        <div className="ml-auto flex gap-2">
          {step < totalSteps ? (
            <Button type="button" onClick={goNext}>Next</Button>
          ) : (
            <Button type="button" onClick={createMatch} disabled={isPending || !canCreateMatch}>{isPending ? 'Creating...' : 'Create Match'}</Button>
          )}
        </div>
      </WizardActions>
    </WizardShell>
  )
}

function getStepTitle(step: number) {
  if (step === 1) return 'Match details'
  if (step === 2) return 'Choose team'
  if (step === 3) return 'Pick the squad'
  if (step === 4) return 'Match settings'
  if (step === 5) return 'Events to track'
  return 'Review and create'
}

function EventPicker({
  agePhase,
  events,
  eventSearchTerm,
  setEventSearchTerm,
  eventMatchPhaseFilter,
  setEventMatchPhaseFilter,
  eventCategoryFilter,
  setEventCategoryFilter,
  eventSubcategoryFilter,
  setEventSubcategoryFilter,
  eventPositionFilter,
  setEventPositionFilter,
  eventFourCornerFilter,
  setEventFourCornerFilter,
  locationTrackingEnabled,
  setLocationTrackingEnabled,
  locationTrackingWarning,
  selectedEventDefinitionIdSet,
  selectedEventCount,
  onToggleEvent,
  onSelectRecommendedDefaults,
  onSelectVisibleEvents,
  onClearAll,
}: {
  agePhase: AgePhase
  events: TaxonomyEvent[]
  eventSearchTerm: string
  setEventSearchTerm: (value: string) => void
  eventMatchPhaseFilter: string
  setEventMatchPhaseFilter: (value: string) => void
  eventCategoryFilter: string
  setEventCategoryFilter: (value: string) => void
  eventSubcategoryFilter: string
  setEventSubcategoryFilter: (value: string) => void
  eventPositionFilter: string
  setEventPositionFilter: (value: string) => void
  eventFourCornerFilter: string
  setEventFourCornerFilter: (value: string) => void
  locationTrackingEnabled: boolean
  setLocationTrackingEnabled: (enabled: boolean) => void
  locationTrackingWarning: string | null
  selectedEventDefinitionIdSet: Set<string>
  selectedEventCount: number
  onToggleEvent: (eventType: string) => void
  onSelectRecommendedDefaults: () => void
  onSelectVisibleEvents: (visibleEventDefinitionIds: string[]) => void
  onClearAll: () => void
}) {
  const normalizedSearchTerm = eventSearchTerm.trim().toLowerCase()
  const matchPhaseOptions = getUniqueOptions(events, 'matchPhase', 'matchPhaseLabel')
  const categoryOptions = getUniqueOptions(events, 'category', 'categoryLabel')
  const subcategoryOptions = Array.from(new Set(events.map((event) => event.subcategory).filter((subcategory): subcategory is string => Boolean(subcategory))))
    .sort()
    .map((subcategory) => ({ value: subcategory, label: subcategory }))
  const positionOptions = Array.from(new Set(events.flatMap((event) => event.positionRelevance))).sort()
  const fourCornerOptions = Array.from(new Set(events.map((event) => event.fourCorner))).sort()
  const visibleEvents = events.filter((event) => {
    if (!locationTrackingEnabled && event.requiresLocation) return false
    if (normalizedSearchTerm && !`${event.label} ${event.description ?? ''}`.toLowerCase().includes(normalizedSearchTerm)) return false
    if (eventMatchPhaseFilter !== 'ALL' && event.matchPhase !== eventMatchPhaseFilter) return false
    if (eventCategoryFilter !== 'ALL' && event.category !== eventCategoryFilter) return false
    if (eventSubcategoryFilter !== 'ALL' && event.subcategory !== eventSubcategoryFilter) return false
    if (eventPositionFilter !== 'ALL' && !event.positionRelevance.includes(eventPositionFilter)) return false
    if (eventFourCornerFilter !== 'ALL' && event.fourCorner !== eventFourCornerFilter) return false
    return true
  })
  const selectedEvents = events.filter((event) => selectedEventDefinitionIdSet.has(event.id))
  const visibleEventIds = visibleEvents.map((event) => event.id)

  return (
    <div className="space-y-4">
      <OptionalTrackingExtras
        locationTrackingEnabled={locationTrackingEnabled}
        setLocationTrackingEnabled={setLocationTrackingEnabled}
        locationTrackingWarning={locationTrackingWarning}
      />

      <EventSetupHeader
        agePhase={agePhase}
        selectedEventCount={selectedEventCount}
        visibleEventCount={visibleEvents.length}
        onSelectRecommendedDefaults={onSelectRecommendedDefaults}
        onSelectAllVisible={() => onSelectVisibleEvents(visibleEventIds)}
        onClearAll={onClearAll}
      />

      {selectedEvents.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected events</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onToggleEvent(event.id)}
                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900 hover:bg-blue-200"
              >
                {event.label} ×
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Search events
          <input
            value={eventSearchTerm}
            onChange={(event) => setEventSearchTerm(event.target.value)}
            className={fieldClassName}
            placeholder="Search by event name"
          />
        </label>
        <EventFilterSelect label="Match phase" value={eventMatchPhaseFilter} onChange={setEventMatchPhaseFilter} options={matchPhaseOptions} />
        <EventFilterSelect label="Category" value={eventCategoryFilter} onChange={setEventCategoryFilter} options={categoryOptions} />
        <EventFilterSelect label="Subcategory" value={eventSubcategoryFilter} onChange={setEventSubcategoryFilter} options={subcategoryOptions} />
        <EventFilterSelect
          label="Position relevance"
          value={eventPositionFilter}
          onChange={setEventPositionFilter}
          options={positionOptions.map((value) => ({ value, label: formatEventMeta(value) }))}
        />
        <EventFilterSelect
          label="4 Corner"
          value={eventFourCornerFilter}
          onChange={setEventFourCornerFilter}
          options={fourCornerOptions.map((value) => ({ value, label: formatEventMeta(value) }))}
        />
        {/* TODO: Add tag filters when event tags exist in the data model. */}
      </div>

      <div className="grid gap-2">
        {visibleEvents.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No events match the current filters.
          </p>
        ) : visibleEvents.map((event) => {
          const selected = selectedEventDefinitionIdSet.has(event.id)

          return (
            <label
              key={event.id}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? 'border-blue-700 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleEvent(event.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-950">{event.label}</p>
                    {event.enabledByDefault && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">
                        Default
                      </span>
                    )}
                    {event.requiresLocation && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        Requires pitch location
                      </span>
                    )}
                    {selected && (
                      <span className="rounded-full bg-blue-800 px-2 py-0.5 text-[11px] font-bold text-white">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {event.matchPhaseLabel} · {event.categoryLabel}{event.subcategory ? ` · ${event.subcategory}` : ''} · {formatEventMeta(event.fourCorner)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Relevant: {event.positionRelevance.map(formatEventMeta).join(', ')}
                  </p>
                  <EventGuidanceDetails event={event} />
                </div>
              </div>
            </label>
          )
        })}
      </div>

      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Showing {visibleEvents.length} of {events.length} live-recordable observation events.
      </p>
    </div>
  )
}

function OptionalTrackingExtras({
  locationTrackingEnabled,
  setLocationTrackingEnabled,
  locationTrackingWarning,
}: {
  locationTrackingEnabled: boolean
  setLocationTrackingEnabled: (enabled: boolean) => void
  locationTrackingWarning: string | null
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Optional tracking extras</p>
      <label className="mt-3 flex items-start gap-3 font-bold">
        <input
          type="checkbox"
          checked={locationTrackingEnabled}
          onChange={(event) => setLocationTrackingEnabled(event.target.checked)}
          className="mt-1"
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
  )
}

function EventSetupHeader({
  agePhase,
  selectedEventCount,
  visibleEventCount,
  onSelectRecommendedDefaults,
  onSelectAllVisible,
  onClearAll,
}: {
  agePhase: AgePhase
  selectedEventCount: number
  visibleEventCount: number
  onSelectRecommendedDefaults: () => void
  onSelectAllVisible: () => void
  onClearAll: () => void
}) {
  const workloadGuidance = getWorkloadGuidance(selectedEventCount)

  return (
    <div className={`rounded-xl border p-3 text-sm ${workloadGuidance.className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">Choose what you want to observe</p>
          <p className="mt-1 text-xl font-extrabold">
            {selectedEventCount} event{selectedEventCount === 1 ? '' : 's'} selected
          </p>
          <p className="mt-1 font-semibold">{workloadGuidance.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSelectRecommendedDefaults} className="rounded-lg bg-white/80 px-3 py-2 font-semibold text-blue-800 hover:bg-white">
            Select recommended defaults
          </button>
          <button type="button" onClick={onSelectAllVisible} className="rounded-lg bg-white/80 px-3 py-2 font-semibold text-blue-800 hover:bg-white" disabled={visibleEventCount === 0}>
            Select all visible
          </button>
          <button type="button" onClick={onClearAll} className="rounded-lg bg-white/80 px-3 py-2 font-semibold text-slate-700 hover:bg-white" disabled={selectedEventCount === 0}>
            Clear all
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white/70 px-2.5 py-1">Suggested for {agePhaseLabels[agePhase]}</span>
        <span className="rounded-full bg-white/70 px-2.5 py-1">4-8 focused</span>
        <span className="rounded-full bg-white/70 px-2.5 py-1">9-12 busy</span>
        <span className="rounded-full bg-white/70 px-2.5 py-1">13+ too much</span>
      </div>
      <p className="mt-2">
        These are coaching observation buttons, not match admin fields. Choose only what you can realistically record live.
      </p>
    </div>
  )
}

function EventGuidanceDetails({ event }: { event: TaxonomyEvent }) {
  const hasGuidance = event.description || event.videoUrl || event.requiresLocation || event.subcategory
  if (!hasGuidance) return null

  return (
    <details
      className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2 text-sm"
      onClick={(clickEvent) => clickEvent.stopPropagation()}
      onToggle={(toggleEvent) => toggleEvent.stopPropagation()}
    >
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
        <div className="flex flex-wrap gap-1.5">
          {event.requiresLocation && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              Requires pitch location
            </span>
          )}
        </div>
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

function EventFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClassName}>
        <option value="ALL">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function getUniqueOptions(
  events: TaxonomyEvent[],
  valueKey: 'matchPhase' | 'category',
  labelKey: 'matchPhaseLabel' | 'categoryLabel'
) {
  const options = new Map<string, string>()

  for (const event of events) {
    options.set(event[valueKey], event[labelKey])
  }

  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((firstOption, secondOption) => firstOption.label.localeCompare(secondOption.label))
}

function formatEventMeta(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function getWorkloadGuidance(selectedEventCount: number) {
  if (selectedEventCount === 0) {
    return {
      label: 'Select a few events or use defaults.',
      className: 'border-amber-200 bg-amber-50 text-amber-950',
    }
  }
  if (selectedEventCount <= 8) {
    return {
      label: 'Focused match view.',
      className: 'border-green-200 bg-green-50 text-green-950',
    }
  }
  if (selectedEventCount <= 12) {
    return {
      label: 'Busy but manageable.',
      className: 'border-blue-200 bg-blue-50 text-blue-950',
    }
  }

  return {
    label: 'This may be too much for one person to record live.',
    className: 'border-red-200 bg-red-50 text-red-950',
  }
}

function getStepDescription(step: number) {
  if (step === 3) return 'Keep it quick. You can mark starters, substitutes and players not involved.'
  if (step === 5) return 'Choose only what helps your coaching observation.'
  if (step === 6) return 'Check the setup before opening the match workspace.'
  return undefined
}

function formatStatus(status: SquadStatus) {
  if (status === 'STARTER') return 'Starter'
  if (status === 'SUBSTITUTE') return 'Sub'
  return 'Not involved'
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="text-right font-bold text-slate-950">{value}</dd>
    </div>
  )
}
