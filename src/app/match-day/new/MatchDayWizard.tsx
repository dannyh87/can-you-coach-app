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
  value: string
  label: string
  category: string
  categoryLabel: string
  matchPhase: MatchPhase
  matchPhaseLabel: string
  agePhases: AgePhase[]
  fourCorner: string
  positionRelevance: string[]
  enabledByDefault: boolean
}

type MatchPhaseGroup = {
  value: MatchPhase
  label: string
  events: TaxonomyEvent[]
}

type WizardResult = { ok: false; reason: string } | void

const today = () => new Date().toISOString().split('T')[0]

const getRecommendedEventTypes = (events: TaxonomyEvent[], agePhase: AgePhase) => {
  const defaultEvents = events.filter((event) => event.enabledByDefault)
  const matchingEvents = defaultEvents.filter((event) =>
    agePhase === 'ALL' || event.agePhases.includes(agePhase)
  )

  return (matchingEvents.length > 0 ? matchingEvents : defaultEvents).map((event) => event.value)
}

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
  const [eventPositionFilter, setEventPositionFilter] = useState('ALL')
  const [eventFourCornerFilter, setEventFourCornerFilter] = useState('ALL')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0]
  const allEvents = useMemo(
    () => matchPhaseGroups.flatMap((group) => group.events),
    [matchPhaseGroups]
  )
  const recommendedEventTypes = useMemo(
    () => getRecommendedEventTypes(allEvents, selectedTeam?.inferredAgePhase ?? 'ALL'),
    [allEvents, selectedTeam?.inferredAgePhase]
  )
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(recommendedEventTypes)
  const totalSteps = 6
  const selectedEventTypeSet = useMemo(() => new Set(selectedEventTypes), [selectedEventTypes])
  const starterCount = selectedTeam?.players.filter((player) => (playerStatuses[player.id] ?? 'NOT_INVOLVED') === 'STARTER').length ?? 0
  const substituteCount = selectedTeam?.players.filter((player) => (playerStatuses[player.id] ?? 'NOT_INVOLVED') === 'SUBSTITUTE').length ?? 0
  const involvedCount = starterCount + substituteCount

  const goNext = () => setStep((currentStep) => Math.min(totalSteps, currentStep + 1))
  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1))
  const setPlayerStatus = (playerId: string, squadStatus: SquadStatus) => {
    setPlayerStatuses((currentStatuses) => ({ ...currentStatuses, [playerId]: squadStatus }))
  }
  const applyDefaultEvents = () => setSelectedEventTypes(recommendedEventTypes)
  const toggleEventType = (eventType: string) => {
    setSelectedEventTypes((currentEventTypes) =>
      currentEventTypes.includes(eventType)
        ? currentEventTypes.filter((value) => value !== eventType)
        : [...currentEventTypes, eventType]
    )
  }

  const createMatch = () => {
    setError(null)
    const formData = new FormData()
    formData.set('teamId', teamId)
    formData.set('date', date)
    formData.set('kickoffTime', kickoffTime)
    formData.set('opposition', opposition)
    formData.set('matchType', matchType)
    formData.set('venue', venue)
    selectedEventTypes.forEach((eventType) => formData.append('eventType', eventType))
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
                setSelectedEventTypes(getRecommendedEventTypes(allEvents, team.inferredAgePhase))
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
          eventPositionFilter={eventPositionFilter}
          setEventPositionFilter={setEventPositionFilter}
          eventFourCornerFilter={eventFourCornerFilter}
          setEventFourCornerFilter={setEventFourCornerFilter}
          selectedEventTypeSet={selectedEventTypeSet}
          selectedEventCount={selectedEventTypes.length}
          onToggleEvent={toggleEventType}
          onUseDefaults={applyDefaultEvents}
        />
      )}

      {step === 6 && selectedTeam && (
        <div className="space-y-3">
          <ReviewRow label="Opposition" value={opposition || 'Not set'} />
          <ReviewRow label="Date" value={`${date} at ${kickoffTime}`} />
          <ReviewRow label="Team" value={`${selectedTeam.clubName} / ${selectedTeam.name}`} />
          <ReviewRow label="Squad" value={`${starterCount} starters, ${substituteCount} substitutes`} />
          <ReviewRow label="Age suggestion" value={agePhaseLabels[selectedTeam.inferredAgePhase]} />
          <ReviewRow label="Events" value={`${selectedEventTypes.length} selected`} />
        </div>
      )}

      <WizardActions>
        <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1 || isPending}>Back</Button>
        <div className="ml-auto flex gap-2">
          {step === 5 && <Button type="button" variant="ghost" onClick={() => { applyDefaultEvents(); goNext() }}>Skip</Button>}
          {step < totalSteps ? (
            <Button type="button" onClick={goNext}>Next</Button>
          ) : (
            <Button type="button" onClick={createMatch} disabled={isPending || !opposition.trim()}>{isPending ? 'Creating...' : 'Create Match'}</Button>
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
  eventPositionFilter,
  setEventPositionFilter,
  eventFourCornerFilter,
  setEventFourCornerFilter,
  selectedEventTypeSet,
  selectedEventCount,
  onToggleEvent,
  onUseDefaults,
}: {
  agePhase: AgePhase
  events: TaxonomyEvent[]
  eventSearchTerm: string
  setEventSearchTerm: (value: string) => void
  eventMatchPhaseFilter: string
  setEventMatchPhaseFilter: (value: string) => void
  eventCategoryFilter: string
  setEventCategoryFilter: (value: string) => void
  eventPositionFilter: string
  setEventPositionFilter: (value: string) => void
  eventFourCornerFilter: string
  setEventFourCornerFilter: (value: string) => void
  selectedEventTypeSet: Set<string>
  selectedEventCount: number
  onToggleEvent: (eventType: string) => void
  onUseDefaults: () => void
}) {
  const normalizedSearchTerm = eventSearchTerm.trim().toLowerCase()
  const matchPhaseOptions = getUniqueOptions(events, 'matchPhase', 'matchPhaseLabel')
  const categoryOptions = getUniqueOptions(events, 'category', 'categoryLabel')
  const positionOptions = Array.from(new Set(events.flatMap((event) => event.positionRelevance))).sort()
  const fourCornerOptions = Array.from(new Set(events.map((event) => event.fourCorner))).sort()
  const visibleEvents = events.filter((event) => {
    if (normalizedSearchTerm && !event.label.toLowerCase().includes(normalizedSearchTerm)) return false
    if (eventMatchPhaseFilter !== 'ALL' && event.matchPhase !== eventMatchPhaseFilter) return false
    if (eventCategoryFilter !== 'ALL' && event.category !== eventCategoryFilter) return false
    if (eventPositionFilter !== 'ALL' && !event.positionRelevance.includes(eventPositionFilter)) return false
    if (eventFourCornerFilter !== 'ALL' && event.fourCorner !== eventFourCornerFilter) return false
    return true
  })
  const selectedEvents = events.filter((event) => selectedEventTypeSet.has(event.value))

  return (
    <div className="space-y-4">
      <EventSetupHeader agePhase={agePhase} selectedEventCount={selectedEventCount} onUseDefaults={onUseDefaults} />

      {selectedEvents.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected events</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedEvents.map((event) => (
              <button
                key={event.value}
                type="button"
                onClick={() => onToggleEvent(event.value)}
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
          const selected = selectedEventTypeSet.has(event.value)

          return (
            <label
              key={event.value}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? 'border-blue-700 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleEvent(event.value)}
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
                    {selected && (
                      <span className="rounded-full bg-blue-800 px-2 py-0.5 text-[11px] font-bold text-white">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {event.matchPhaseLabel} · {event.categoryLabel} · {formatEventMeta(event.fourCorner)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Relevant: {event.positionRelevance.map(formatEventMeta).join(', ')}
                  </p>
                </div>
              </div>
            </label>
          )
        })}
      </div>

      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Showing {visibleEvents.length} of {events.length} available observation events. Library-only events are not shown here yet.
      </p>
    </div>
  )
}

function EventSetupHeader({
  agePhase,
  selectedEventCount,
  onUseDefaults,
}: {
  agePhase: AgePhase
  selectedEventCount: number
  onUseDefaults: () => void
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
        <button type="button" onClick={onUseDefaults} className="font-semibold text-blue-800 hover:underline">
          Use defaults
        </button>
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
