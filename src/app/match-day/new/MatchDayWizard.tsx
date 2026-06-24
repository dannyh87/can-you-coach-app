'use client'

import { useMemo, useState, useTransition } from 'react'

import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/formStyles'
import { WizardActions, WizardOptionCard, WizardShell } from '@/components/ui/Wizard'
import { agePhaseLabels, getRecommendedEventTypes, type AgePhase, type MatchPhase } from '@/lib/matchEventTaxonomy'

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
  const [eventView, setEventView] = useState<'phases' | 'categories' | 'events'>('phases')
  const [selectedMatchPhase, setSelectedMatchPhase] = useState<MatchPhase | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0]
  const recommendedEventTypes = useMemo(
    () => getRecommendedEventTypes(selectedTeam?.inferredAgePhase ?? 'ALL'),
    [selectedTeam?.inferredAgePhase]
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
  const toggleCategory = (category: string) => {
    const categoryEvents = matchPhaseGroups.flatMap((group) => group.events).filter((event) => event.category === category)
    const allSelected = categoryEvents.every((event) => selectedEventTypeSet.has(event.value))

    setSelectedEventTypes((currentEventTypes) => {
      const currentSet = new Set(currentEventTypes)
      categoryEvents.forEach((event) => {
        if (allSelected) currentSet.delete(event.value)
        else currentSet.add(event.value)
      })
      return Array.from(currentSet)
    })
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
                setSelectedEventTypes(getRecommendedEventTypes(team.inferredAgePhase))
                setEventView('phases')
                setSelectedMatchPhase(null)
                setSelectedCategory(null)
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
        <EventDrillDownSelector
          agePhase={selectedTeam?.inferredAgePhase ?? 'ALL'}
          eventView={eventView}
          setEventView={setEventView}
          selectedMatchPhase={selectedMatchPhase}
          setSelectedMatchPhase={setSelectedMatchPhase}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          matchPhaseGroups={matchPhaseGroups}
          selectedEventTypeSet={selectedEventTypeSet}
          selectedEventCount={selectedEventTypes.length}
          onToggleCategory={toggleCategory}
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

function EventDrillDownSelector({
  agePhase,
  eventView,
  setEventView,
  selectedMatchPhase,
  setSelectedMatchPhase,
  selectedCategory,
  setSelectedCategory,
  matchPhaseGroups,
  selectedEventTypeSet,
  selectedEventCount,
  onToggleCategory,
  onToggleEvent,
  onUseDefaults,
}: {
  agePhase: AgePhase
  eventView: 'phases' | 'categories' | 'events'
  setEventView: (view: 'phases' | 'categories' | 'events') => void
  selectedMatchPhase: MatchPhase | null
  setSelectedMatchPhase: (matchPhase: MatchPhase | null) => void
  selectedCategory: string | null
  setSelectedCategory: (category: string | null) => void
  matchPhaseGroups: MatchPhaseGroup[]
  selectedEventTypeSet: Set<string>
  selectedEventCount: number
  onToggleCategory: (category: string) => void
  onToggleEvent: (eventType: string) => void
  onUseDefaults: () => void
}) {
  const selectableGroups = matchPhaseGroups.filter((group) => group.events.length > 0)
  const selectedGroup = matchPhaseGroups.find((group) => group.value === selectedMatchPhase)
  const categories = getCategoryGroups(selectedGroup?.events ?? [])
  const selectedCategoryGroup = categories.find((category) => category.value === selectedCategory)

  if (eventView === 'categories' && selectedGroup) {
    return (
      <div className="space-y-3">
        <EventSetupHeader
          agePhase={agePhase}
          selectedEventCount={selectedEventCount}
          onUseDefaults={onUseDefaults}
        />
        <button
          type="button"
          onClick={() => {
            setEventView('phases')
            setSelectedMatchPhase(null)
          }}
          className="text-sm font-semibold text-blue-800 hover:underline"
        >
          Back to focus areas
        </button>
        <div className="grid gap-3">
          {categories.map((category) => {
            const selectedCount = category.events.filter((event) => selectedEventTypeSet.has(event.value)).length
            return (
              <button
                key={category.value}
                type="button"
                onClick={() => {
                  setSelectedCategory(category.value)
                  setEventView('events')
                }}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-950">{category.label}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {selectedCount} of {category.events.length} selected
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (eventView === 'events' && selectedCategoryGroup) {
    return (
      <div className="space-y-3">
        <EventSetupHeader
          agePhase={agePhase}
          selectedEventCount={selectedEventCount}
          onUseDefaults={onUseDefaults}
        />
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setEventView('categories')
              setSelectedCategory(null)
            }}
            className="font-semibold text-blue-800 hover:underline"
          >
            Back to categories
          </button>
          <button
            type="button"
            onClick={() => onToggleCategory(selectedCategoryGroup.value)}
            className="font-semibold text-blue-800 hover:underline"
          >
            Toggle all in {selectedCategoryGroup.label}
          </button>
        </div>
        <div className="grid gap-2">
          {selectedCategoryGroup.events.map((event) => {
            const selected = selectedEventTypeSet.has(event.value)
            return (
              <button
                key={event.value}
                type="button"
                onClick={() => onToggleEvent(event.value)}
                className={`rounded-xl border p-4 text-left ${
                  selected ? 'border-blue-700 bg-blue-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{event.label}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {event.fourCorner.replace('_', ' ').toLowerCase()} · Relevant: {event.positionRelevance.join(', ')}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {selected ? 'Selected' : 'Add'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <EventSetupHeader
        agePhase={agePhase}
        selectedEventCount={selectedEventCount}
        onUseDefaults={onUseDefaults}
      />
      <div className="grid gap-3">
        {selectableGroups.map((group) => {
          const selectedCount = group.events.filter((event) => selectedEventTypeSet.has(event.value)).length
          return (
            <button
              key={group.value}
              type="button"
              onClick={() => {
                setSelectedMatchPhase(group.value)
                setEventView('categories')
              }}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/40"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-950">{group.label}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {selectedCount} selected
                </span>
              </div>
            </button>
          )
        })}
      </div>
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        More areas such as out of possession, transition, set pieces and discipline are planned for the future event library.
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
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          Suggested for {agePhaseLabels[agePhase]} · {selectedEventCount} events selected
        </p>
        <button type="button" onClick={onUseDefaults} className="font-semibold text-blue-800 hover:underline">
          Use defaults
        </button>
      </div>
      <p className="mt-1 text-blue-900">
        These are coaching observation buttons, not match admin fields. You can customise them before creating the match.
      </p>
    </div>
  )
}

function getCategoryGroups(events: TaxonomyEvent[]) {
  const groups = new Map<string, { value: string; label: string; events: TaxonomyEvent[] }>()

  for (const event of events) {
    const group = groups.get(event.category) ?? {
      value: event.category,
      label: event.categoryLabel,
      events: [],
    }
    group.events.push(event)
    groups.set(event.category, group)
  }

  return Array.from(groups.values())
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
