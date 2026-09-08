'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'

import Button from '@/components/ui/Button'
import { fieldClassName } from '@/components/ui/formStyles'
import ModalShell from '@/components/ui/ModalShell'
import { WizardActions, WizardOptionCard, WizardShell } from '@/components/ui/Wizard'
import {
  curriculumFocusOptions,
  getCurriculumRecommendation,
  getDefaultCurriculumFocus,
  inferMatchFormat,
  type CurriculumFocus,
} from '@/lib/curriculumRecommendations'
import {
  getClassicObservationLimitState,
  limitClassicRecommendedEventIds,
  MAX_CLASSIC_OBSERVATIONS,
  sanitizeClassicTemplateSetup,
} from '@/lib/matchDayClassicSetup'
import { agePhaseLabels, type AgePhase, type MatchPhase } from '@/lib/matchEventTaxonomy'

type SquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'

type TeamOption = {
  id: string
  clubId: string
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
  scope: string
  clubId: string | null
  label: string
  slug: string
  normalizedName: string
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
  source?: 'CORE' | 'CUSTOM'
  clubTrackingDefinitionId?: string | null
  customScopeLabel?: 'Custom · Your team' | 'Custom · Your club'
  countingDefinition?: string | null
  guidance?: string | null
  polarity?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
}

type CustomObservation = {
  id: string
  clubId: string
  teamId: string | null
  visibilityScope: 'TEAM' | 'CLUB'
  label: string
  normalizedName: string
  countingDefinition: string | null
  guidance: string | null
  category: string | null
  categoryLabel: string
  polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  requiresLocation: boolean
  sourceLabel: 'Custom · Your team' | 'Custom · Your club'
}

type QuickCustomActionResult =
  | { ok: true; value: CustomObservation }
  | { ok: false; reason: string; code?: string; existing?: CustomObservation | { source: 'CORE'; id: string; label: string; countingDefinition: string | null }; similar?: Array<CustomObservation | { source: 'CORE'; id: string; label: string; countingDefinition: string | null }> }

type CustomConflictItem = CustomObservation | { source: 'CORE'; id: string; label: string; countingDefinition: string | null }
type CustomConflictActionResult = { ok: true; value: { exact: CustomConflictItem | null; similar: CustomConflictItem[] } } | { ok: false; reason: string }

type MatchPhaseGroup = {
  value: MatchPhase
  label: string
  events: TaxonomyEvent[]
}

type WizardResult = { ok: false; reason: string } | void
type TemplateValidationResult = { ok: true } | { ok: false; reason: string }
type CurriculumRecommendation = ReturnType<typeof getCurriculumRecommendation>
type EventStartMethod = 'UNSET' | 'RECOMMENDED' | 'PREVIOUS' | 'MANUAL'

type PreviousSetup = {
  id: string
  teamId: string
  teamName: string
  clubName: string
  opposition: string
  kickoffAt: string
  eventTrackingScope: 'TEAM' | 'PLAYER'
  trackPlayerMinutes: boolean
  locationTrackingEnabled: boolean
  selectedEventDefinitionIds: string[]
  selectedClubTrackingDefinitionIds?: string[]
  eventLabels: string[]
  players: Array<{
    playerId: string
    playerName: string
    squadStatus: SquadStatus
    startingPosition: string | null
    shirtNumberSnapshot: number | null
    isTracked: boolean
  }>
}

const today = () => new Date().toISOString().split('T')[0]

const getRecommendedEventDefinitionIds = (events: TaxonomyEvent[], locationTrackingEnabled: boolean) =>
  events
    .filter((event) => event.enabledByDefault)
    .filter((event) => locationTrackingEnabled || !event.requiresLocation)
    .map((event) => event.id)

const zeroEventValidationMessage = 'Select at least one event to track for this match.'
const controlInteractionClassName = 'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 active:translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:translate-y-0 motion-reduce:active:scale-100'
const primaryBlueButtonClassName = `${controlInteractionClassName} rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 active:bg-blue-900`
const secondaryButtonClassName = `${controlInteractionClassName} rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 active:border-slate-400 active:bg-slate-100`
const subtleBlueButtonClassName = `${controlInteractionClassName} rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 hover:border-blue-200 hover:bg-blue-100 active:bg-blue-200`
const chipButtonClassName = `${controlInteractionClassName} rounded-full px-3 py-2 text-sm font-bold`
const selectedChipClassName = 'bg-blue-700 text-white ring-2 ring-blue-200'
const unselectedChipClassName = 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100'
const selectedCardButtonClassName = `${controlInteractionClassName} border-blue-800 bg-blue-700 text-white ring-2 ring-blue-200`
const unselectedCardButtonClassName = `${controlInteractionClassName} border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100`

export default function MatchDayWizard({
  teams,
  matchPhaseGroups,
  previousSetups,
  customObservationsEnabled = false,
  customObservationsByTeamId = {},
  maxCustomObservations = 2,
  createCustomObservationAction,
  checkCustomObservationConflictsAction,
  validateTemplateAction,
  createAction,
}: {
  teams: TeamOption[]
  matchPhaseGroups: MatchPhaseGroup[]
  previousSetups: PreviousSetup[]
  customObservationsEnabled?: boolean
  customObservationsByTeamId?: Record<string, CustomObservation[]>
  maxCustomObservations?: number
  createCustomObservationAction?: (formData: FormData) => Promise<QuickCustomActionResult>
  checkCustomObservationConflictsAction?: (formData: FormData) => Promise<CustomConflictActionResult>
  validateTemplateAction: (formData: FormData) => Promise<TemplateValidationResult>
  createAction: (formData: FormData) => Promise<WizardResult>
}) {
  const [step, setStep] = useState(1)
  const [opposition, setOpposition] = useState('')
  const [date, setDate] = useState(today())
  const [kickoffTime, setKickoffTime] = useState('10:30')
  const [matchType, setMatchType] = useState('FRIENDLY')
  const [venue, setVenue] = useState('HOME')
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [curriculumFocus, setCurriculumFocus] = useState<CurriculumFocus>(getDefaultCurriculumFocus(teams[0]?.ageGroup))
  const [curriculumWeekNumber, setCurriculumWeekNumber] = useState(1)
  const [trackPlayerMinutes, setTrackPlayerMinutesState] = useState(false)
  const [eventTrackingScope, setEventTrackingScopeState] = useState<'TEAM' | 'PLAYER'>('TEAM')
  const [trackedPlayerIds, setTrackedPlayerIds] = useState<string[]>([])
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, SquadStatus>>({})
  const [startingPositions, setStartingPositions] = useState<Record<string, string>>({})
  const [trackedStateById, setTrackedStateById] = useState<Record<string, boolean>>({})
  const [eventSearchTerm, setEventSearchTerm] = useState('')
  const [eventMatchPhaseFilter, setEventMatchPhaseFilter] = useState('ALL')
  const [eventCategoryFilter, setEventCategoryFilter] = useState('ALL')
  const [eventSubcategoryFilter, setEventSubcategoryFilter] = useState('ALL')
  const [eventPositionFilter, setEventPositionFilter] = useState('ALL')
  const [eventFourCornerFilter, setEventFourCornerFilter] = useState('ALL')
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(false)
  const [locationTrackingWarning, setLocationTrackingWarning] = useState<string | null>(null)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateWarning, setTemplateWarning] = useState<string | null>(null)
  const [recommendationApplied, setRecommendationApplied] = useState(false)
  const [eventStartMethod, setEventStartMethod] = useState<EventStartMethod>('UNSET')
  const [eventSelectorOpen, setEventSelectorOpen] = useState(false)
  const [advancedEventFiltersOpen, setAdvancedEventFiltersOpen] = useState(false)
  const [eventSelectionNotice, setEventSelectionNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isTemplatePending, setIsTemplatePending] = useState(false)
  const eventSelectionRef = useRef<HTMLDivElement>(null)
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0]
  const allEvents = useMemo(
    () => matchPhaseGroups.flatMap((group) => group.events),
    [matchPhaseGroups]
  )
  const scopedEvents = useMemo(
    () => allEvents.filter((event) => event.scope === 'GLOBAL' || event.clubId === selectedTeam?.clubId),
    [allEvents, selectedTeam?.clubId]
  )
  const [localCustomObservationsByTeamId, setLocalCustomObservationsByTeamId] = useState(customObservationsByTeamId)
  const selectedTeamCustomObservations = useMemo(
    () => customObservationsEnabled && selectedTeam ? localCustomObservationsByTeamId[selectedTeam.id] ?? [] : [],
    [customObservationsEnabled, localCustomObservationsByTeamId, selectedTeam]
  )
  const customEvents = useMemo(() => selectedTeamCustomObservations.map(mapCustomObservationToTaxonomyEvent), [selectedTeamCustomObservations])
  const selectableEvents = customObservationsEnabled ? [...scopedEvents, ...customEvents] : scopedEvents
  const curriculumRecommendation = useMemo(
    () => getCurriculumRecommendation({
      ageGroup: selectedTeam?.ageGroup,
      matchFormat: inferMatchFormat(selectedTeam?.ageGroup),
      focus: curriculumFocus,
      weekNumber: curriculumWeekNumber,
        availableEvents: scopedEvents.map((event) => ({
        id: event.id,
        name: event.label,
        label: event.label,
        slug: event.slug,
        normalizedName: event.normalizedName,
        scope: event.scope,
        clubId: event.clubId,
      })),
    }),
    [curriculumFocus, curriculumWeekNumber, scopedEvents, selectedTeam?.ageGroup]
  )
  const recommendedEventDefinitionIds = useMemo(
    () => getRecommendedEventDefinitionIds(scopedEvents, locationTrackingEnabled),
    [scopedEvents, locationTrackingEnabled]
  )
  const [selectedEventDefinitionIds, setSelectedEventDefinitionIds] = useState<string[]>([])
  const [selectedClubTrackingDefinitionIds, setSelectedClubTrackingDefinitionIds] = useState<string[]>([])
  const totalSteps = 5
  const selectedEventDefinitionIdSet = useMemo(() => new Set(selectedEventDefinitionIds), [selectedEventDefinitionIds])
  const selectedClubTrackingDefinitionIdSet = useMemo(() => new Set(selectedClubTrackingDefinitionIds), [selectedClubTrackingDefinitionIds])
  const selectedObservationCount = selectedEventDefinitionIds.length + selectedClubTrackingDefinitionIds.length
  const eventLimitState = getClassicObservationLimitState(selectedObservationCount)
  const selectedTeamPreviousSetups = previousSetups.filter((setup) => setup.teamId === selectedTeam?.id)
  const selectedTemplate = selectedTeamPreviousSetups.find((setup) => setup.id === selectedTemplateId) ?? selectedTeamPreviousSetups[0]
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
    if (step === 3 && !trackPlayerMinutes && eventTrackingScope === 'PLAYER' && trackedPlayerIds.length === 0) {
      setError('Select at least one player to track.')
      return
    }
    if (step === 4 && selectedObservationCount === 0) {
      setError(zeroEventValidationMessage)
      eventSelectionRef.current?.focus()
      return
    }
    if (step === 4 && !eventLimitState.canProceed) {
      setError(eventLimitState.message)
      eventSelectionRef.current?.focus()
      return
    }

    setError(null)
    setStep((currentStep) => Math.min(totalSteps, currentStep + 1))
  }
  const goBack = () => setStep((currentStep) => Math.max(1, currentStep - 1))
  const setPlayerStatus = (playerId: string, squadStatus: SquadStatus) => {
    setPlayerStatuses((currentStatuses) => ({ ...currentStatuses, [playerId]: squadStatus }))
    setTrackedStateById((currentTracked) => ({ ...currentTracked, [playerId]: squadStatus !== 'NOT_INVOLVED' }))
  }
  const setTrackPlayerMinutes = (enabled: boolean) => {
    setTrackPlayerMinutesState(enabled)
    if (!enabled) setPlayerStatuses({})
  }
  const setEventTrackingScope = (scope: 'TEAM' | 'PLAYER') => {
    setEventTrackingScopeState(scope)
    if (scope === 'TEAM') setTrackedPlayerIds([])
  }
  const toggleTrackedPlayer = (playerId: string) => {
    setEventTrackingScope('PLAYER')
    setTrackedPlayerIds((currentIds) => currentIds.includes(playerId) ? currentIds.filter((id) => id !== playerId) : [...currentIds, playerId])
    setTrackedStateById((currentTracked) => ({ ...currentTracked, [playerId]: !(currentTracked[playerId] ?? trackedPlayerIds.includes(playerId)) }))
  }
  const selectRecommendedDefaults = () => setSelectedEventDefinitionIds(limitClassicRecommendedEventIds(recommendedEventDefinitionIds))
  const selectCurriculumRecommendation = () => {
    const nextEventDefinitionIds = curriculumRecommendation.matchedEventDefinitionIds.filter((eventDefinitionId) => {
      const event = scopedEvents.find((scopedEvent) => scopedEvent.id === eventDefinitionId)
      return event && (locationTrackingEnabled || !event.requiresLocation)
    })
    setSelectedEventDefinitionIds(limitClassicRecommendedEventIds(nextEventDefinitionIds))
    setRecommendationApplied(true)
    setEventStartMethod('RECOMMENDED')
    setEventSelectionNotice(null)
  }
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
  const selectVisibleEvents = (visibleObservations: TaxonomyEvent[]) => {
    const visibleEventDefinitionIds = visibleObservations.filter((event) => event.source !== 'CUSTOM').map((event) => event.id)
    const visibleCustomIds = customObservationsEnabled ? visibleObservations.flatMap((event) => event.source === 'CUSTOM' && event.clubTrackingDefinitionId ? [event.clubTrackingDefinitionId] : []) : []
    setSelectedEventDefinitionIds((currentEventDefinitionIds) => {
      const nextEventDefinitionIds = Array.from(new Set([...currentEventDefinitionIds, ...visibleEventDefinitionIds]))
      const roomForStandards = Math.max(0, MAX_CLASSIC_OBSERVATIONS - selectedClubTrackingDefinitionIds.length)
      if (nextEventDefinitionIds.length > roomForStandards) {
        setEventSelectionNotice(`You can select up to ${MAX_CLASSIC_OBSERVATIONS} events for one match setup.`)
        return nextEventDefinitionIds.slice(0, roomForStandards)
      }
      setEventSelectionNotice(null)
      return nextEventDefinitionIds
    })
    if (customObservationsEnabled) {
      setSelectedClubTrackingDefinitionIds((currentIds) => {
        const nextIds = Array.from(new Set([...currentIds, ...visibleCustomIds]))
        if (nextIds.length > maxCustomObservations) {
          setEventSelectionNotice(`You can select up to ${MAX_CLASSIC_OBSERVATIONS} observations in total, including up to ${maxCustomObservations} custom observations.`)
          return nextIds.slice(0, maxCustomObservations)
        }
        return nextIds
      })
    }
  }
  const clearSelectedEvents = () => {
    setSelectedEventDefinitionIds([])
    setSelectedClubTrackingDefinitionIds([])
    setEventSelectionNotice(null)
  }
  const toggleEventDefinition = (eventDefinitionId: string) => {
    setSelectedEventDefinitionIds((currentEventDefinitionIds) =>
      {
        if (currentEventDefinitionIds.includes(eventDefinitionId)) {
          setEventSelectionNotice(null)
          return currentEventDefinitionIds.filter((value) => value !== eventDefinitionId)
        }
        if (currentEventDefinitionIds.length + selectedClubTrackingDefinitionIds.length >= MAX_CLASSIC_OBSERVATIONS) {
          setEventSelectionNotice(`You can select up to ${MAX_CLASSIC_OBSERVATIONS} events for one match setup.`)
          return currentEventDefinitionIds
        }
        setEventSelectionNotice(null)
        return [...currentEventDefinitionIds, eventDefinitionId]
      }
    )
  }
  const toggleCustomObservation = (clubTrackingDefinitionId: string) => {
    if (!customObservationsEnabled) return
    setSelectedClubTrackingDefinitionIds((currentIds) => {
      if (currentIds.includes(clubTrackingDefinitionId)) {
        setEventSelectionNotice(null)
        return currentIds.filter((value) => value !== clubTrackingDefinitionId)
      }
      if (currentIds.length >= maxCustomObservations || selectedEventDefinitionIds.length + currentIds.length >= MAX_CLASSIC_OBSERVATIONS) {
        setEventSelectionNotice(`You can select up to ${MAX_CLASSIC_OBSERVATIONS} observations in total, including up to ${maxCustomObservations} custom observations.`)
        return currentIds
      }
      setEventSelectionNotice(null)
      return [...currentIds, clubTrackingDefinitionId]
    })
  }

  const applyTemplate = (template: PreviousSetup) => {
    if (!selectedTeam || isTemplatePending) return

    const validEventDefinitionIds = new Set(scopedEvents.map((event) => event.id))
    const validCustomIds = new Set(selectedTeamCustomObservations.map((observation) => observation.id))
    setIsTemplatePending(true)
    void (async () => {
      const formData = new FormData()
      formData.set('templateId', template.id)
      formData.set('teamId', selectedTeam.id)
      try {
        const result = await validateTemplateAction(formData)
        if (!result.ok) {
          setError(result.reason)
          return
        }

        const sanitizedTemplate = sanitizeClassicTemplateSetup({
          template,
          activePlayers: selectedTeam.players,
          validEventDefinitionIds,
        })
        setEventTrackingScopeState(sanitizedTemplate.eventTrackingScope)
        setTrackPlayerMinutesState(sanitizedTemplate.trackPlayerMinutes)
        setLocationTrackingEnabled(sanitizedTemplate.locationTrackingEnabled)
        setSelectedEventDefinitionIds(sanitizedTemplate.selectedEventDefinitionIds)
        const copiedCustomIds = customObservationsEnabled ? (template.selectedClubTrackingDefinitionIds ?? []).filter((id) => validCustomIds.has(id)) : []
        setSelectedClubTrackingDefinitionIds(copiedCustomIds)
        setTrackedPlayerIds(sanitizedTemplate.trackedPlayerIds)
        setPlayerStatuses(sanitizedTemplate.playerStatuses)
        setStartingPositions(sanitizedTemplate.startingPositions)
        setTrackedStateById(Object.fromEntries(sanitizedTemplate.trackedPlayerIds.map((playerId) => [playerId, true])))
        setTemplateWarning(getTemplateWarning(sanitizedTemplate.omittedPlayers, sanitizedTemplate.omittedEventDefinitionCount + ((template.selectedClubTrackingDefinitionIds?.length ?? 0) - copiedCustomIds.length)))
        setEventStartMethod('PREVIOUS')
        setEventSelectionNotice(sanitizedTemplate.selectedEventDefinitionIds.length + copiedCustomIds.length > MAX_CLASSIC_OBSERVATIONS ? getClassicObservationLimitState(sanitizedTemplate.selectedEventDefinitionIds.length + copiedCustomIds.length).message : null)
        setError(null)
        setTemplateModalOpen(false)
      } catch {
        setError('Could not apply that setup. Try again.')
      } finally {
        setIsTemplatePending(false)
      }
    })()
  }

  const createMatch = () => {
    if (isPending) return

    setError(null)
    if (selectedObservationCount === 0) {
      setError(zeroEventValidationMessage)
      eventSelectionRef.current?.focus()
      return
    }
    if (!eventLimitState.canProceed) {
      setError(eventLimitState.message)
      eventSelectionRef.current?.focus()
      return
    }

    const formData = new FormData()
    formData.set('teamId', teamId)
    formData.set('date', date)
    formData.set('kickoffTime', kickoffTime)
    formData.set('opposition', opposition)
    formData.set('matchType', matchType)
    formData.set('venue', venue)
    formData.set('eventTrackingScope', eventTrackingScope)
    formData.set('trackPlayerMinutes', trackPlayerMinutes ? 'true' : 'false')
    trackedPlayerIds.forEach((playerId) => formData.append('trackedPlayerId', playerId))
    selectedEventDefinitionIds.forEach((eventDefinitionId) => formData.append('eventDefinitionId', eventDefinitionId))
    selectedClubTrackingDefinitionIds.forEach((clubTrackingDefinitionId) => formData.append('clubTrackingDefinitionId', clubTrackingDefinitionId))
    selectedTeam?.players.forEach((player) => {
      formData.append('playerStatus', `${player.id}:${playerStatuses[player.id] ?? 'NOT_INVOLVED'}`)
      formData.append('startingPosition', `${player.id}:${startingPositions[player.id] ?? ''}`)
      formData.append('playerTracked', `${player.id}:${trackedStateById[player.id] ?? trackedPlayerIds.includes(player.id) ?? false}`)
    })

    setIsPending(true)
    void (async () => {
      try {
        const result = await createAction(formData)
        if (result && !result.ok) setError(result.reason)
      } catch {
        setError('Could not create the match. Try again.')
      } finally {
        setIsPending(false)
      }
    })()
  }

  if (teams.length === 0) {
    return <p className="rounded-xl border p-4 text-sm text-slate-600">Create a team before setting up Match Day.</p>
  }

  return (
    <WizardShell currentStep={step} totalSteps={totalSteps} title={getStepTitle(step)} description={getStepDescription(step)}>
      {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {templateWarning && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{templateWarning}</p>}

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
                setCurriculumFocus(getDefaultCurriculumFocus(team.ageGroup))
                setTrackedPlayerIds([])
                const validEventIds = new Set(
                  allEvents
                    .filter((event) => event.scope === 'GLOBAL' || event.clubId === team.clubId)
                    .map((event) => event.id)
                )
                setSelectedEventDefinitionIds((currentEventDefinitionIds) =>
                  currentEventDefinitionIds.filter((eventDefinitionId) => validEventIds.has(eventDefinitionId))
                )
                if (customObservationsEnabled) {
                  const validCustomIds = new Set((localCustomObservationsByTeamId[team.id] ?? []).map((observation) => observation.id))
                  setSelectedClubTrackingDefinitionIds((currentIds) => currentIds.filter((clubTrackingDefinitionId) => validCustomIds.has(clubTrackingDefinitionId)))
                } else {
                  setSelectedClubTrackingDefinitionIds([])
                }
              }}
            />
          ))}
        </div>
      )}

      {step === 3 && selectedTeam && (
        <div>
          <section className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <h2 className="text-lg font-extrabold text-slate-950">Who are you observing?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" role="radio" aria-checked={eventTrackingScope === 'TEAM'} onClick={() => setEventTrackingScope('TEAM')} className={`rounded-xl border p-4 text-left font-bold ${eventTrackingScope === 'TEAM' ? selectedCardButtonClassName : unselectedCardButtonClassName}`}>The whole team<span className={`mt-1 block text-sm font-normal ${eventTrackingScope === 'TEAM' ? 'text-blue-50' : 'text-slate-700'}`}>Record team totals without choosing a player.</span><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${eventTrackingScope === 'TEAM' ? 'bg-white text-blue-800' : 'bg-slate-100 text-slate-600'}`}>{eventTrackingScope === 'TEAM' ? 'Selected ✓' : 'Not selected'}</span></button>
              <button type="button" role="radio" aria-checked={eventTrackingScope === 'PLAYER'} onClick={() => setEventTrackingScope('PLAYER')} className={`rounded-xl border p-4 text-left font-bold ${eventTrackingScope === 'PLAYER' ? selectedCardButtonClassName : unselectedCardButtonClassName}`}>Individual players<span className={`mt-1 block text-sm font-normal ${eventTrackingScope === 'PLAYER' ? 'text-blue-50' : 'text-slate-700'}`}>Record which player completed each action.</span><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${eventTrackingScope === 'PLAYER' ? 'bg-white text-blue-800' : 'bg-slate-100 text-slate-600'}`}>{eventTrackingScope === 'PLAYER' ? 'Selected ✓' : 'Not selected'}</span></button>
            </div>
          </section>
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <label className="flex items-start gap-3 text-sm font-bold text-slate-950">
              <input type="checkbox" checked={trackPlayerMinutes} onChange={(event) => setTrackPlayerMinutes(event.target.checked)} className="mt-1 h-5 w-5 accent-blue-700" />
              <span>
                Track player minutes and substitutions
                <span className="mt-1 block font-normal leading-6 text-slate-700">Turn this on if you want to record starters, substitutes and how long each player plays.</span>
              </span>
            </label>
          </div>
          {trackPlayerMinutes ? (
            <>
              {eventTrackingScope === 'PLAYER' && <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-900">Player event tracking uses the squad players marked as tracked for events. You can refine those on the draft setup page before kick-off.</p>}
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
                          <p className="mt-1 text-sm text-slate-500">{player.squadNumber === null ? 'No squad number' : `#${player.squadNumber}`} · {player.preferredPosition ?? 'No position'}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{formatStatus(status)}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {(['STARTER', 'SUBSTITUTE', 'NOT_INVOLVED'] as SquadStatus[]).map((option) => <button key={option} type="button" role="radio" aria-checked={status === option} onClick={() => setPlayerStatus(player.id, option)} className={`${controlInteractionClassName} rounded-lg border px-2 py-2 text-xs font-bold ${status === option ? 'border-blue-700 bg-blue-700 text-white ring-2 ring-blue-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100'}`}>{formatStatus(option)}{status === option ? ' selected ✓' : ''}</button>)}
                      </div>
                      {(status === 'STARTER' || status === 'SUBSTITUTE') && <input className={`${fieldClassName} mt-3`} placeholder="Starting position or role" value={startingPositions[player.id] ?? ''} onChange={(event) => setStartingPositions({ ...startingPositions, [player.id]: event.target.value })} />}
                    </article>
                  )
                })}
              </div>
            </>
          ) : eventTrackingScope === 'PLAYER' ? (
            <div className="space-y-4">
              <div><h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Players to track</h2><div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedTeam.players.map((player) => { const selected = trackedPlayerIds.includes(player.id); return <button key={player.id} type="button" aria-pressed={selected} onClick={() => toggleTrackedPlayer(player.id)} className={`rounded-xl border p-4 text-left ${selected ? selectedCardButtonClassName : unselectedCardButtonClassName}`}><span className="block font-bold">{player.name}</span><span className={`mt-1 block text-sm ${selected ? 'text-blue-50' : 'text-slate-500'}`}>{player.squadNumber === null ? 'No squad number' : `#${player.squadNumber}`} · {selected ? 'Selected ✓' : 'Not selected'}</span></button> })}</div></div>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No player selection is needed for team event tracking.</p>
          )}
        </div>
      )}

      {step === 4 && (
        <EventPicker
          agePhase={selectedTeam?.inferredAgePhase ?? 'ALL'}
          teamAgeGroup={selectedTeam?.ageGroup ?? 'Unknown age group'}
          recommendation={curriculumRecommendation}
          curriculumFocus={curriculumFocus}
          setCurriculumFocus={setCurriculumFocus}
          curriculumWeekNumber={curriculumWeekNumber}
          setCurriculumWeekNumber={setCurriculumWeekNumber}
          events={selectableEvents}
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
          selectedClubTrackingDefinitionIdSet={selectedClubTrackingDefinitionIdSet}
          selectedCustomObservationCount={selectedClubTrackingDefinitionIds.length}
          selectedEventCount={selectedObservationCount}
          onToggleEvent={toggleEventDefinition}
          onToggleCustomObservation={toggleCustomObservation}
          customObservationsEnabled={customObservationsEnabled}
          maxCustomObservations={maxCustomObservations}
          teamId={selectedTeam?.id ?? ''}
          onCustomObservationCreated={(observation) => {
            setLocalCustomObservationsByTeamId((current) => ({ ...current, [observation.teamId ?? selectedTeam?.id ?? '']: [...(current[observation.teamId ?? selectedTeam?.id ?? ''] ?? []), observation] }))
            setSelectedClubTrackingDefinitionIds((currentIds) => Array.from(new Set([...currentIds, observation.id])))
            setEventSelectionNotice(null)
          }}
          createCustomObservationAction={createCustomObservationAction}
          checkCustomObservationConflictsAction={checkCustomObservationConflictsAction}
          currentEventDefinitionIds={selectedEventDefinitionIds}
          currentClubTrackingDefinitionIds={selectedClubTrackingDefinitionIds}
          onUseCurriculumRecommendation={selectCurriculumRecommendation}
          onSelectRecommendedDefaults={selectRecommendedDefaults}
          onSelectVisibleEvents={selectVisibleEvents}
          onClearAll={clearSelectedEvents}
          onOpenTemplatePicker={() => setTemplateModalOpen(true)}
          recommendationApplied={recommendationApplied}
          eventTrackingScope={eventTrackingScope}
          eventSelectionRef={eventSelectionRef}
          eventStartMethod={eventStartMethod}
          setEventStartMethod={setEventStartMethod}
          eventSelectorOpen={eventSelectorOpen}
          setEventSelectorOpen={setEventSelectorOpen}
          advancedFiltersOpen={advancedEventFiltersOpen}
          setAdvancedFiltersOpen={setAdvancedEventFiltersOpen}
          eventSelectionNotice={eventSelectionNotice}
          setEventSelectionNotice={setEventSelectionNotice}
        />
      )}

      {step === 5 && selectedTeam && (
        <div className="space-y-3">
          {!canCreateMatch && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Add the opposition before creating this match.
            </p>
          )}
          <ReviewRow label="Opposition" value={opposition || 'Not set'} />
          <ReviewRow label="Date" value={`${date} at ${kickoffTime}`} />
          <ReviewRow label="Team" value={`${selectedTeam.clubName} / ${selectedTeam.name}`} />
          <ReviewRow label="What you are tracking" value={eventTrackingScope === 'PLAYER' ? 'Selected players' : 'Team events'} />
          <ReviewRow label="Playing-time tracking" value={trackPlayerMinutes ? 'On' : 'Off'} />
          <ReviewRow label="Players" value={trackPlayerMinutes ? `${starterCount} starters, ${substituteCount} substitutes` : eventTrackingScope === 'PLAYER' ? `${trackedPlayerIds.length} selected players` : 'Not required'} />
          <ReviewRow label="Age suggestion" value={agePhaseLabels[selectedTeam.inferredAgePhase]} />
          <ReviewRow label="Events" value={`${formatEventCount(selectedObservationCount)} selected`} />
          <ReviewRow label="Location tracking" value={locationTrackingEnabled ? 'On' : 'Off'} />
        </div>
      )}

      <WizardActions>
        <Button type="button" variant="secondary" onClick={goBack} disabled={step === 1 || isPending}>Back</Button>
        <div className="ml-auto flex gap-2">
          {step < totalSteps ? (
            <Button type="button" onClick={goNext}>Next</Button>
          ) : (
            <Button type="button" onClick={createMatch} disabled={!canCreateMatch || isPending} isPending={isPending} pendingText="Creating Match Day…">Create Match</Button>
          )}
        </div>
      </WizardActions>
      {templateModalOpen && selectedTeam && (
        <TemplatePickerModal
          templates={selectedTeamPreviousSetups}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplateId}
          onApplyTemplate={applyTemplate}
          onClose={() => setTemplateModalOpen(false)}
          isPending={isTemplatePending}
        />
      )}
    </WizardShell>
  )
}

function getStepTitle(step: number) {
  if (step === 1) return 'Match details'
  if (step === 2) return 'Choose team'
  if (step === 3) return 'Tracking and squad'
  if (step === 4) return 'Events to record'
  return 'Review and create'
}

function EventPicker({
  agePhase,
  teamAgeGroup,
  recommendation,
  curriculumFocus,
  setCurriculumFocus,
  curriculumWeekNumber,
  setCurriculumWeekNumber,
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
  selectedClubTrackingDefinitionIdSet,
  selectedCustomObservationCount,
  selectedEventCount,
  onToggleEvent,
  onToggleCustomObservation,
  customObservationsEnabled,
  maxCustomObservations,
  teamId,
  onCustomObservationCreated,
  createCustomObservationAction,
  checkCustomObservationConflictsAction,
  currentEventDefinitionIds,
  currentClubTrackingDefinitionIds,
  onUseCurriculumRecommendation,
  onSelectRecommendedDefaults,
  onSelectVisibleEvents,
  onClearAll,
  onOpenTemplatePicker,
  recommendationApplied,
  eventTrackingScope,
  eventSelectionRef,
  eventStartMethod,
  setEventStartMethod,
  eventSelectorOpen,
  setEventSelectorOpen,
  advancedFiltersOpen,
  setAdvancedFiltersOpen,
  eventSelectionNotice,
  setEventSelectionNotice,
}: {
  agePhase: AgePhase
  teamAgeGroup: string
  recommendation: CurriculumRecommendation
  curriculumFocus: CurriculumFocus
  setCurriculumFocus: (value: CurriculumFocus) => void
  curriculumWeekNumber: number
  setCurriculumWeekNumber: (value: number) => void
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
  selectedClubTrackingDefinitionIdSet: Set<string>
  selectedCustomObservationCount: number
  selectedEventCount: number
  onToggleEvent: (eventType: string) => void
  onToggleCustomObservation: (clubTrackingDefinitionId: string) => void
  customObservationsEnabled: boolean
  maxCustomObservations: number
  teamId: string
  onCustomObservationCreated: (observation: CustomObservation) => void
  createCustomObservationAction?: (formData: FormData) => Promise<QuickCustomActionResult>
  checkCustomObservationConflictsAction?: (formData: FormData) => Promise<CustomConflictActionResult>
  currentEventDefinitionIds: string[]
  currentClubTrackingDefinitionIds: string[]
  onUseCurriculumRecommendation: () => void
  onSelectRecommendedDefaults: () => void
  onSelectVisibleEvents: (visibleObservations: TaxonomyEvent[]) => void
  onClearAll: () => void
  onOpenTemplatePicker: () => void
  recommendationApplied: boolean
  eventTrackingScope: 'TEAM' | 'PLAYER'
  eventSelectionRef: RefObject<HTMLDivElement | null>
  eventStartMethod: EventStartMethod
  setEventStartMethod: (method: EventStartMethod) => void
  eventSelectorOpen: boolean
  setEventSelectorOpen: (open: boolean) => void
  advancedFiltersOpen: boolean
  setAdvancedFiltersOpen: (open: boolean) => void
  eventSelectionNotice: string | null
  setEventSelectionNotice: (notice: string | null) => void
}) {
  const selectorTriggerRef = useRef<HTMLButtonElement>(null)
  const [customCreateOpen, setCustomCreateOpen] = useState(false)
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
  const selectedEvents = events.filter((event) => event.source === 'CUSTOM' ? Boolean(event.clubTrackingDefinitionId && selectedClubTrackingDefinitionIdSet.has(event.clubTrackingDefinitionId)) : selectedEventDefinitionIdSet.has(event.id))
  const eventGroups = getTaxonomyEventGroups(visibleEvents)
  const recommendedEventIds = new Set(recommendation.matchedEventDefinitionIds)
  const recommendedEvents = events.filter((event) => recommendedEventIds.has(event.id) && (locationTrackingEnabled || !event.requiresLocation))
  const defaultEvents = events.filter((event) => event.enabledByDefault && (locationTrackingEnabled || !event.requiresLocation))
  const hasAdvancedFilters = eventMatchPhaseFilter !== 'ALL' || eventSubcategoryFilter !== 'ALL' || eventPositionFilter !== 'ALL' || eventFourCornerFilter !== 'ALL'
  const selectorEvents = normalizedSearchTerm || eventCategoryFilter !== 'ALL' || hasAdvancedFilters
    ? visibleEvents
    : (recommendedEvents.length > 0 ? recommendedEvents : defaultEvents)
  const limitState = getClassicObservationLimitState(selectedEventCount)
  const shouldShowStart = eventStartMethod === 'UNSET' && selectedEventCount === 0

  const openSelector = () => {
    setEventStartMethod(eventStartMethod === 'UNSET' ? 'MANUAL' : eventStartMethod)
    setEventSelectorOpen(true)
  }

  const chooseManual = () => {
    setEventStartMethod('MANUAL')
    setEventSelectorOpen(true)
  }

  const startAgain = () => {
    onClearAll()
    setEventStartMethod('UNSET')
    setEventSelectorOpen(false)
    setAdvancedFiltersOpen(false)
    setEventSelectionNotice(null)
  }

  return (
    <div className="space-y-4">
      {shouldShowStart ? (
        <EventStartMethodSelection
          onUseRecommendation={onUseCurriculumRecommendation}
          onUsePrevious={onOpenTemplatePicker}
          onChooseManual={chooseManual}
          recommendationAvailable={recommendation.matchedEventDefinitionIds.length > 0}
        />
      ) : (
        <SelectedEventSummary
          eventSelectionRef={eventSelectionRef}
          selectedEvents={selectedEvents}
          selectedEventCount={selectedEventCount}
          eventTrackingScope={eventTrackingScope}
          limitState={limitState}
          recommendationApplied={recommendationApplied && eventStartMethod === 'RECOMMENDED'}
          recommendation={recommendation}
          teamAgeGroup={teamAgeGroup}
          curriculumFocus={curriculumFocus}
          setCurriculumFocus={setCurriculumFocus}
          curriculumWeekNumber={curriculumWeekNumber}
          setCurriculumWeekNumber={setCurriculumWeekNumber}
          onUseCurriculumRecommendation={onUseCurriculumRecommendation}
          onToggleEvent={onToggleEvent}
          onToggleCustomObservation={onToggleCustomObservation}
          onOpenSelector={openSelector}
          onStartAgain={startAgain}
          selectorTriggerRef={selectorTriggerRef}
          locationTrackingEnabled={locationTrackingEnabled}
          setLocationTrackingEnabled={setLocationTrackingEnabled}
          locationTrackingWarning={locationTrackingWarning}
          hasLocationEvents={events.some((event) => event.requiresLocation)}
          notice={eventSelectionNotice}
        />
      )}

      {eventSelectorOpen && (
        <EventSelectorModal
          agePhase={agePhase}
          events={selectorEvents}
          totalEventCount={events.length}
          selectedEventDefinitionIdSet={selectedEventDefinitionIdSet}
          selectedClubTrackingDefinitionIdSet={selectedClubTrackingDefinitionIdSet}
          selectedCustomObservationCount={selectedCustomObservationCount}
          maxCustomObservations={maxCustomObservations}
          customObservationsEnabled={customObservationsEnabled}
          selectedEventCount={selectedEventCount}
          eventSearchTerm={eventSearchTerm}
          setEventSearchTerm={setEventSearchTerm}
          eventCategoryFilter={eventCategoryFilter}
          setEventCategoryFilter={setEventCategoryFilter}
          categoryOptions={categoryOptions}
          advancedFiltersOpen={advancedFiltersOpen}
          setAdvancedFiltersOpen={setAdvancedFiltersOpen}
          hasAdvancedFilters={hasAdvancedFilters}
          eventMatchPhaseFilter={eventMatchPhaseFilter}
          setEventMatchPhaseFilter={setEventMatchPhaseFilter}
          matchPhaseOptions={matchPhaseOptions}
          eventSubcategoryFilter={eventSubcategoryFilter}
          setEventSubcategoryFilter={setEventSubcategoryFilter}
          subcategoryOptions={subcategoryOptions}
          eventPositionFilter={eventPositionFilter}
          setEventPositionFilter={setEventPositionFilter}
          positionOptions={positionOptions}
          eventFourCornerFilter={eventFourCornerFilter}
          setEventFourCornerFilter={setEventFourCornerFilter}
          fourCornerOptions={fourCornerOptions}
          eventGroups={eventGroups}
          onToggleEvent={onToggleEvent}
          onToggleCustomObservation={onToggleCustomObservation}
          onSelectRecommendedDefaults={onSelectRecommendedDefaults}
          onSelectVisibleEvents={() => onSelectVisibleEvents(visibleEvents)}
          onClearAll={onClearAll}
          onClose={() => setEventSelectorOpen(false)}
          notice={eventSelectionNotice}
          onOpenCustomCreate={() => setCustomCreateOpen(true)}
        />
      )}
      {customCreateOpen && customObservationsEnabled && createCustomObservationAction && checkCustomObservationConflictsAction && (
        <CustomObservationModal
          teamId={teamId}
          currentEventDefinitionIds={currentEventDefinitionIds}
          currentClubTrackingDefinitionIds={currentClubTrackingDefinitionIds}
          createAction={createCustomObservationAction}
          checkConflictsAction={checkCustomObservationConflictsAction}
          onCreated={(observation) => {
            onCustomObservationCreated(observation)
            setCustomCreateOpen(false)
          }}
          onSelectExisting={(item) => {
            if ('source' in item && item.source === 'CORE') onToggleEvent(item.id)
            else onToggleCustomObservation(item.id)
            setCustomCreateOpen(false)
          }}
          onClose={() => setCustomCreateOpen(false)}
        />
      )}
    </div>
  )
}

function EventStartMethodSelection({
  onUseRecommendation,
  onUsePrevious,
  onChooseManual,
  recommendationAvailable,
}: {
  onUseRecommendation: () => void
  onUsePrevious: () => void
  onChooseManual: () => void
  recommendationAvailable: boolean
}) {
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <h2 className="text-2xl font-extrabold text-slate-950">How would you like to start?</h2>
      <p className="mt-2 text-sm text-slate-700">Choose one starting point. You can adjust the events before creating the match.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={onUseRecommendation} className={`${controlInteractionClassName} rounded-xl border border-emerald-200 bg-white p-4 text-left text-sm font-bold text-emerald-900 shadow-sm hover:bg-emerald-50 active:border-emerald-400 active:bg-emerald-100`} disabled={!recommendationAvailable}>Recommended for this team<span className="mt-1 block font-normal text-slate-600">Start with a focused set based on this team&apos;s age group.</span></button>
        <button type="button" onClick={onUsePrevious} className={`${controlInteractionClassName} rounded-xl border border-blue-200 bg-white p-4 text-left text-sm font-bold text-blue-900 shadow-sm hover:bg-blue-50 active:border-blue-400 active:bg-blue-100`}>Use my last setup<span className="mt-1 block font-normal text-slate-600">Preview and apply setup inside this wizard.</span></button>
        <button type="button" onClick={onChooseManual} className={`${controlInteractionClassName} rounded-xl border border-slate-200 bg-white p-4 text-left text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50 active:border-slate-400 active:bg-slate-100`}>Choose events myself<span className="mt-1 block font-normal text-slate-600">Open a focused event selector.</span></button>
      </div>
    </section>
  )
}

function SelectedEventSummary({
  eventSelectionRef,
  selectedEvents,
  selectedEventCount,
  eventTrackingScope,
  limitState,
  recommendationApplied,
  recommendation,
  teamAgeGroup,
  curriculumFocus,
  setCurriculumFocus,
  curriculumWeekNumber,
  setCurriculumWeekNumber,
  onUseCurriculumRecommendation,
  onToggleEvent,
  onToggleCustomObservation,
  onOpenSelector,
  onStartAgain,
  selectorTriggerRef,
  locationTrackingEnabled,
  setLocationTrackingEnabled,
  locationTrackingWarning,
  hasLocationEvents,
  notice,
}: {
  eventSelectionRef: RefObject<HTMLDivElement | null>
  selectedEvents: TaxonomyEvent[]
  selectedEventCount: number
  eventTrackingScope: 'TEAM' | 'PLAYER'
  limitState: ReturnType<typeof getClassicObservationLimitState>
  recommendationApplied: boolean
  recommendation: CurriculumRecommendation
  teamAgeGroup: string
  curriculumFocus: CurriculumFocus
  setCurriculumFocus: (value: CurriculumFocus) => void
  curriculumWeekNumber: number
  setCurriculumWeekNumber: (value: number) => void
  onUseCurriculumRecommendation: () => void
  onToggleEvent: (eventType: string) => void
  onToggleCustomObservation: (clubTrackingDefinitionId: string) => void
  onOpenSelector: () => void
  onStartAgain: () => void
  selectorTriggerRef: RefObject<HTMLButtonElement | null>
  locationTrackingEnabled: boolean
  setLocationTrackingEnabled: (enabled: boolean) => void
  locationTrackingWarning: string | null
  hasLocationEvents: boolean
  notice: string | null
}) {
  return (
    <section ref={eventSelectionRef} tabIndex={-1} className={`rounded-xl border bg-white p-4 ${getLimitStateClassName(limitState.tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Events selected</p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-950">{formatEventCount(selectedEventCount)} selected of {MAX_CLASSIC_OBSERVATIONS}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-700">{limitState.message}</p>
          <p className="mt-1 text-sm text-slate-600">{eventTrackingScope === 'PLAYER' ? 'These events will be attributed to your selected players.' : 'These events will be recorded for the whole team.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button ref={selectorTriggerRef} type="button" onClick={onOpenSelector} className={primaryBlueButtonClassName}>Add or change events</button>
          <button type="button" onClick={onStartAgain} className={secondaryButtonClassName}>Start again</button>
        </div>
      </div>
      {notice && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{notice}</p>}
      {selectedEvents.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedEvents.map((event) => (
            <button key={getObservationKey(event)} type="button" onClick={() => event.source === 'CUSTOM' && event.clubTrackingDefinitionId ? onToggleCustomObservation(event.clubTrackingDefinitionId) : onToggleEvent(event.id)} className={`${controlInteractionClassName} rounded-full bg-blue-100 px-3 py-2 text-xs font-bold text-blue-900 ring-1 ring-blue-200 hover:bg-blue-200 active:bg-blue-300`} aria-label={`Remove ${event.label}`}>
              {event.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No events selected yet. Choose at least one event to continue.</p>}
      {selectedEventCount > 0 && hasLocationEvents && (
        <LocationTrackingPrompt locationTrackingEnabled={locationTrackingEnabled} setLocationTrackingEnabled={setLocationTrackingEnabled} locationTrackingWarning={locationTrackingWarning} />
      )}
      {recommendationApplied && (
        <details className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <summary className="cursor-pointer text-sm font-bold">Why these events?</summary>
          <div className="mt-3"><CurriculumRecommendationPanel teamAgeGroup={teamAgeGroup} recommendation={recommendation} curriculumFocus={curriculumFocus} setCurriculumFocus={setCurriculumFocus} curriculumWeekNumber={curriculumWeekNumber} setCurriculumWeekNumber={setCurriculumWeekNumber} onUseCurriculumRecommendation={onUseCurriculumRecommendation} /></div>
        </details>
      )}
    </section>
  )
}

function LocationTrackingPrompt({ locationTrackingEnabled, setLocationTrackingEnabled, locationTrackingWarning }: { locationTrackingEnabled: boolean; setLocationTrackingEnabled: (enabled: boolean) => void; locationTrackingWarning: string | null }) {
  return (
    <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <label className="flex items-start gap-3 font-bold">
        <input type="checkbox" checked={locationTrackingEnabled} onChange={(event) => setLocationTrackingEnabled(event.target.checked)} className="mt-1 h-5 w-5 accent-blue-700" />
        <span>
          Add pitch locations?
          <span className="mt-1 block font-normal leading-6 text-amber-900">Record where selected events happen.</span>
        </span>
      </label>
      {locationTrackingWarning && <p className="mt-3 rounded-lg border border-amber-300 bg-white/80 p-3 font-semibold text-amber-950">{locationTrackingWarning}</p>}
    </section>
  )
}

function EventSelectorModal({
  agePhase,
  events,
  totalEventCount,
  selectedEventDefinitionIdSet,
  selectedClubTrackingDefinitionIdSet,
  selectedCustomObservationCount,
  maxCustomObservations,
  customObservationsEnabled,
  selectedEventCount,
  eventSearchTerm,
  setEventSearchTerm,
  eventCategoryFilter,
  setEventCategoryFilter,
  categoryOptions,
  advancedFiltersOpen,
  setAdvancedFiltersOpen,
  hasAdvancedFilters,
  eventMatchPhaseFilter,
  setEventMatchPhaseFilter,
  matchPhaseOptions,
  eventSubcategoryFilter,
  setEventSubcategoryFilter,
  subcategoryOptions,
  eventPositionFilter,
  setEventPositionFilter,
  positionOptions,
  eventFourCornerFilter,
  setEventFourCornerFilter,
  fourCornerOptions,
  eventGroups,
  onToggleEvent,
  onToggleCustomObservation,
  onSelectRecommendedDefaults,
  onSelectVisibleEvents,
  onClearAll,
  onClose,
  notice,
  onOpenCustomCreate,
}: {
  agePhase: AgePhase
  events: TaxonomyEvent[]
  totalEventCount: number
  selectedEventDefinitionIdSet: Set<string>
  selectedClubTrackingDefinitionIdSet: Set<string>
  selectedCustomObservationCount: number
  maxCustomObservations: number
  customObservationsEnabled: boolean
  selectedEventCount: number
  eventSearchTerm: string
  setEventSearchTerm: (value: string) => void
  eventCategoryFilter: string
  setEventCategoryFilter: (value: string) => void
  categoryOptions: Array<{ value: string; label: string }>
  advancedFiltersOpen: boolean
  setAdvancedFiltersOpen: (open: boolean) => void
  hasAdvancedFilters: boolean
  eventMatchPhaseFilter: string
  setEventMatchPhaseFilter: (value: string) => void
  matchPhaseOptions: Array<{ value: string; label: string }>
  eventSubcategoryFilter: string
  setEventSubcategoryFilter: (value: string) => void
  subcategoryOptions: Array<{ value: string; label: string }>
  eventPositionFilter: string
  setEventPositionFilter: (value: string) => void
  positionOptions: string[]
  eventFourCornerFilter: string
  setEventFourCornerFilter: (value: string) => void
  fourCornerOptions: string[]
  eventGroups: Array<{ label: string; events: TaxonomyEvent[] }>
  onToggleEvent: (eventType: string) => void
  onToggleCustomObservation: (clubTrackingDefinitionId: string) => void
  onSelectRecommendedDefaults: () => void
  onSelectVisibleEvents: () => void
  onClearAll: () => void
  onClose: () => void
  notice: string | null
  onOpenCustomCreate: () => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    titleRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  const limitState = getClassicObservationLimitState(selectedEventCount)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="event-selector-title">
      <div className="flex max-h-screen w-full flex-col overflow-hidden bg-white shadow-xl sm:max-h-[90vh] sm:max-w-5xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 border-b bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="event-selector-title" ref={titleRef} tabIndex={-1} className="text-2xl font-extrabold text-slate-950">Add or change events</h2>
              <p className="mt-1 text-sm font-semibold text-slate-700">{formatEventCount(selectedEventCount)} selected of {MAX_CLASSIC_OBSERVATIONS} · {limitState.label}</p>
              {customObservationsEnabled && <p className="mt-1 text-xs font-bold text-slate-500">Custom observations: {selectedCustomObservationCount} of {maxCustomObservations}</p>}
            </div>
            <button type="button" onClick={onClose} className={primaryBlueButtonClassName}>Done</button>
          </div>
          {notice && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{notice}</p>}
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="text-sm font-semibold text-slate-700">
              Search events
              <input value={eventSearchTerm} onChange={(event) => setEventSearchTerm(event.target.value)} className={fieldClassName} placeholder="Search by event name" />
            </label>
            <div>
              <p className="text-sm font-semibold text-slate-700">Category</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Event category">
                {[{ value: 'ALL', label: 'All' }, ...categoryOptions].map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={eventCategoryFilter === option.value} onClick={() => setEventCategoryFilter(option.value)} className={`${chipButtonClassName} ${eventCategoryFilter === option.value ? selectedChipClassName : unselectedChipClassName}`}>{option.label}{eventCategoryFilter === option.value ? ' selected ✓' : ''}</button>
                ))}
              </div>
            </div>
            <div>
              <button type="button" onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)} className={`${secondaryButtonClassName} ${advancedFiltersOpen ? 'border-blue-700 bg-blue-50 text-blue-900 ring-2 ring-blue-100' : ''}`} aria-expanded={advancedFiltersOpen}>
                Filters{advancedFiltersOpen ? ' open' : ''}{hasAdvancedFilters ? ' active' : ''}
              </button>
              {advancedFiltersOpen && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <EventFilterSelect label="Match phase" value={eventMatchPhaseFilter} onChange={setEventMatchPhaseFilter} options={matchPhaseOptions} />
                  <EventFilterSelect label="Subcategory" value={eventSubcategoryFilter} onChange={setEventSubcategoryFilter} options={subcategoryOptions} />
                  <EventFilterSelect label="Position relevance" value={eventPositionFilter} onChange={setEventPositionFilter} options={positionOptions.map((value) => ({ value, label: formatEventMeta(value) }))} />
                  <EventFilterSelect label="4 Corner" value={eventFourCornerFilter} onChange={setEventFourCornerFilter} options={fourCornerOptions.map((value) => ({ value, label: formatEventMeta(value) }))} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onSelectRecommendedDefaults} className={subtleBlueButtonClassName}>Replace with recommended events</button>
            <button type="button" onClick={onSelectVisibleEvents} className={subtleBlueButtonClassName} disabled={events.length === 0}>Select visible</button>
            <button type="button" onClick={onClearAll} className={secondaryButtonClassName} disabled={selectedEventCount === 0}>Clear all</button>
          </div>
          {customObservationsEnabled && (
            <div className="mt-4 rounded-xl border border-dashed border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-semibold text-blue-950">Can&apos;t find it?</p>
              <button type="button" onClick={onOpenCustomCreate} className={`${subtleBlueButtonClassName} mt-2`}>Create a team observation</button>
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {eventGroups.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No events match the current filters.</p>
            ) : eventGroups.map((group) => (
              <section key={group.label} className="rounded-2xl border bg-white p-3">
                <h3 className="font-extrabold text-slate-950">{group.label} <span className="text-xs font-bold text-slate-500">{formatEventCount(group.events.length)} · {formatEventCount(group.events.filter((event) => selectedEventDefinitionIdSet.has(event.id)).length)} selected</span></h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.events.map((event) => <EventSelectionCard key={getObservationKey(event)} event={event} selected={event.source === 'CUSTOM' ? Boolean(event.clubTrackingDefinitionId && selectedClubTrackingDefinitionIdSet.has(event.clubTrackingDefinitionId)) : selectedEventDefinitionIdSet.has(event.id)} selectedEventCount={selectedEventCount} selectedCustomObservationCount={selectedCustomObservationCount} maxCustomObservations={maxCustomObservations} onToggleEvent={onToggleEvent} onToggleCustomObservation={onToggleCustomObservation} />)}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Showing {formatEventCount(events.length)} of {formatEventCount(totalEventCount)} live-recordable observations. Suggested for {agePhaseLabels[agePhase]}: 4-6 events.</p>
        </div>
      </div>
    </div>
  )
}

function EventSelectionCard({ event, selected, selectedEventCount, selectedCustomObservationCount, maxCustomObservations, onToggleEvent, onToggleCustomObservation }: { event: TaxonomyEvent; selected: boolean; selectedEventCount: number; selectedCustomObservationCount: number; maxCustomObservations: number; onToggleEvent: (eventType: string) => void; onToggleCustomObservation: (clubTrackingDefinitionId: string) => void }) {
  const isCustom = event.source === 'CUSTOM'
  const cannotAdd = !selected && (selectedEventCount >= MAX_CLASSIC_OBSERVATIONS || (isCustom && selectedCustomObservationCount >= maxCustomObservations))
  const checkboxId = `${isCustom ? 'custom-observation' : 'event-definition'}-${event.id}`
  const toggle = () => isCustom && event.clubTrackingDefinitionId ? onToggleCustomObservation(event.clubTrackingDefinitionId) : onToggleEvent(event.id)

  return (
    <article className={`rounded-xl border p-3 text-left transition ${selected ? 'border-blue-800 bg-blue-50 shadow-sm ring-2 ring-blue-100' : cannotAdd ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'} motion-reduce:transition-none`}>
      <div className="flex min-h-24 flex-col gap-3">
        <label htmlFor={checkboxId} className={`flex cursor-pointer items-start gap-3 rounded-lg p-2 ${controlInteractionClassName} ${selected ? 'bg-white text-blue-950' : cannotAdd ? 'text-slate-500' : 'text-slate-950 hover:bg-blue-50 active:bg-blue-100'}`}>
          <input id={checkboxId} type="checkbox" checked={selected} disabled={cannotAdd} onChange={toggle} className="mt-1 h-5 w-5 accent-blue-700" aria-label={`${selected ? 'Remove' : 'Add'} ${event.label}`} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{event.label}</span>
              {event.customScopeLabel && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">{event.customScopeLabel}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${selected ? 'bg-blue-700 text-white' : cannotAdd ? 'bg-slate-200 text-slate-500' : 'bg-slate-100 text-slate-700'}`}>{selected ? 'Selected ✓' : cannotAdd ? 'Limit reached' : 'Not selected'}</span>
            </span>
            <span className={`mt-1 block text-sm ${selected ? 'text-blue-900' : 'text-slate-600'}`}>{event.countingDefinition ?? event.description ?? 'Record when this action occurs.'}</span>
          </span>
        </label>
        <details className="rounded-lg border border-slate-200 bg-white/80 p-2 text-sm">
          <summary className={`cursor-pointer rounded px-1 text-xs font-bold text-blue-800 ${controlInteractionClassName}`}>Details</summary>
          <div className="mt-2 space-y-2 text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{event.matchPhaseLabel} · {event.categoryLabel}{event.subcategory ? ` · ${event.subcategory}` : ''} · {formatEventMeta(event.fourCorner)}</p>
            {event.guidance && <p className="text-xs text-slate-600">{event.guidance}</p>}
            {event.polarity && <p className="text-xs font-bold text-slate-600">Polarity: {formatEventMeta(event.polarity)}</p>}
            <p className="text-xs text-slate-500">Relevant: {event.positionRelevance.map(formatEventMeta).join(', ')}</p>
            {event.requiresLocation && <p className="text-xs font-bold text-emerald-700">Requires pitch location</p>}
            {event.videoUrl && <a href={event.videoUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-bold text-blue-700 hover:underline">Watch guidance</a>}
          </div>
        </details>
      </div>
    </article>
  )
}

function CustomObservationModal({ teamId, currentEventDefinitionIds, currentClubTrackingDefinitionIds, createAction, checkConflictsAction, onCreated, onSelectExisting, onClose }: { teamId: string; currentEventDefinitionIds: string[]; currentClubTrackingDefinitionIds: string[]; createAction: (formData: FormData) => Promise<QuickCustomActionResult>; checkConflictsAction: (formData: FormData) => Promise<CustomConflictActionResult>; onCreated: (observation: CustomObservation) => void; onSelectExisting: (item: CustomConflictItem) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [countingDefinition, setCountingDefinition] = useState('')
  const [eventCategory, setEventCategory] = useState('OTHER')
  const [polarity, setPolarity] = useState<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'>('NEUTRAL')
  const [guidance, setGuidance] = useState('')
  const [requiresLocation, setRequiresLocation] = useState(false)
  const [createAnyway, setCreateAnyway] = useState(false)
  const [conflicts, setConflicts] = useState<CustomConflictItem[]>([])
  const [existing, setExisting] = useState<CustomConflictItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const buildFormData = () => {
    const formData = new FormData()
    formData.set('teamId', teamId)
    formData.set('name', name)
    formData.set('countingDefinition', countingDefinition)
    formData.set('eventCategory', eventCategory)
    formData.set('polarity', polarity)
    formData.set('guidance', guidance)
    if (requiresLocation) formData.set('requiresLocation', 'on')
    if (createAnyway) formData.set('createAnyway', 'true')
    currentEventDefinitionIds.forEach((id) => formData.append('currentEventDefinitionId', id))
    currentClubTrackingDefinitionIds.forEach((id) => formData.append('currentClubTrackingDefinitionId', id))
    return formData
  }

  const checkConflicts = async () => {
    if (!name.trim()) return
    const result = await checkConflictsAction(buildFormData())
    if (result.ok) {
      setExisting(result.value.exact)
      setConflicts(result.value.similar)
    }
  }

  const save = async () => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const result = await createAction(buildFormData())
      if (result.ok) onCreated(result.value)
      else {
        setError(result.reason)
        setExisting(result.existing ?? null)
        setConflicts(result.similar ?? [])
      }
    } catch {
      setError('Could not create the custom observation. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <ModalShell title="Create a team observation" description="Custom observations are available to your team but are not included in wider comparisons." onClose={onClose} isSubmitting={pending} maxWidthClassName="max-w-2xl">
      <div className="grid gap-4">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <label className="text-sm font-semibold text-slate-700">Name<input value={name} onBlur={checkConflicts} onChange={(event) => { setName(event.target.value); setCreateAnyway(false) }} className={fieldClassName} maxLength={80} required /></label>
        <label className="text-sm font-semibold text-slate-700">What should be counted?<textarea value={countingDefinition} onChange={(event) => setCountingDefinition(event.target.value)} className={fieldClassName} rows={3} maxLength={240} required /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Closest category<select value={eventCategory} onChange={(event) => setEventCategory(event.target.value)} className={fieldClassName}><option value="PASSING">Passing</option><option value="RECEIVING">Receiving</option><option value="DRIBBLING_1V1">Dribbling / 1v1</option><option value="SHOOTING">Shooting</option><option value="DEFENDING">Defending</option><option value="GOALKEEPING">Goalkeeping</option><option value="DISCIPLINE">Discipline</option><option value="INJURIES">Injuries</option><option value="OTHER">Other</option></select></label>
          <label className="text-sm font-semibold text-slate-700">Positive, negative or neutral<select value={polarity} onChange={(event) => setPolarity(event.target.value as typeof polarity)} className={fieldClassName}><option value="POSITIVE">Positive</option><option value="NEGATIVE">Negative</option><option value="NEUTRAL">Neutral</option></select></label>
        </div>
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-800">Advanced options</summary>
          <label className="mt-3 block text-sm font-semibold text-slate-700">Recording guidance<textarea value={guidance} onChange={(event) => setGuidance(event.target.value)} className={fieldClassName} rows={3} maxLength={500} /></label>
          <label className="mt-3 flex items-start gap-2 text-sm font-bold text-slate-800"><input type="checkbox" checked={requiresLocation} onChange={(event) => setRequiresLocation(event.target.checked)} className="mt-1" /> Record pitch location</label>
        </details>
        {(existing || conflicts.length > 0) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">Similar or matching observations</p>{existing && <ConflictRow item={existing} action="Use existing" onSelect={onSelectExisting} />}{conflicts.map((item) => <ConflictRow key={getConflictKey(item)} item={item} action="Select this" onSelect={onSelectExisting} />)}{!existing && conflicts.length > 0 && <label className="mt-3 flex items-start gap-2 font-bold"><input type="checkbox" checked={createAnyway} onChange={(event) => setCreateAnyway(event.target.checked)} /> Create anyway because the intended meaning is different.</label>}</div>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button><Button type="button" onClick={save} disabled={pending || Boolean(existing) || (conflicts.length > 0 && !createAnyway)} isPending={pending} pendingText="Saving observation…">Save and add to this match</Button></div>
      </div>
    </ModalShell>
  )
}

function ConflictRow({ item, action, onSelect }: { item: CustomConflictItem; action: string; onSelect: (item: CustomConflictItem) => void }) {
  const isCore = 'source' in item && item.source === 'CORE'
  const sourceLabel = isCore ? 'Core' : (item as CustomObservation).sourceLabel
  return <div className="mt-2 rounded-lg bg-white p-3"><p className="font-bold">{item.label} <span className="text-xs text-slate-500">{sourceLabel}</span></p><p className="mt-1 text-xs text-slate-600">{item.countingDefinition ?? 'No definition provided.'}</p><button type="button" onClick={() => onSelect(item)} className={`${subtleBlueButtonClassName} mt-2`}>{action}</button></div>
}

function getConflictKey(item: CustomConflictItem) {
  return 'source' in item && item.source === 'CORE' ? `event:${item.id}` : `custom:${item.id}`
}

function mapCustomObservationToTaxonomyEvent(observation: CustomObservation): TaxonomyEvent {
  return {
    id: `custom-${observation.id}`,
    scope: 'CLUB',
    clubId: observation.clubId,
    label: observation.label,
    slug: observation.id,
    normalizedName: observation.normalizedName,
    category: observation.category ?? 'OTHER',
    categoryLabel: observation.categoryLabel,
    subcategory: observation.sourceLabel,
    description: observation.countingDefinition,
    videoUrl: null,
    matchPhase: observation.category === 'DEFENDING' ? 'OUT_OF_POSSESSION' : 'IN_POSSESSION',
    matchPhaseLabel: observation.category === 'DEFENDING' ? 'Out of possession' : 'In possession',
    agePhases: [],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL'],
    requiresLocation: observation.requiresLocation,
    enabledByDefault: false,
    source: 'CUSTOM',
    clubTrackingDefinitionId: observation.id,
    customScopeLabel: observation.sourceLabel,
    countingDefinition: observation.countingDefinition,
    guidance: observation.guidance,
    polarity: observation.polarity,
  }
}

function getObservationKey(event: TaxonomyEvent) {
  return event.source === 'CUSTOM' && event.clubTrackingDefinitionId ? `custom:${event.clubTrackingDefinitionId}` : `event:${event.id}`
}

function getLimitStateClassName(tone: ReturnType<typeof getClassicObservationLimitState>['tone']) {
  if (tone === 'over-limit') return 'border-red-200'
  if (tone === 'empty') return 'border-amber-200'
  return 'border-emerald-100'
}

function CurriculumRecommendationPanel({
  teamAgeGroup,
  recommendation,
  curriculumFocus,
  setCurriculumFocus,
  curriculumWeekNumber,
  setCurriculumWeekNumber,
  onUseCurriculumRecommendation,
}: {
  teamAgeGroup: string
  recommendation: CurriculumRecommendation
  curriculumFocus: CurriculumFocus
  setCurriculumFocus: (value: CurriculumFocus) => void
  curriculumWeekNumber: number
  setCurriculumWeekNumber: (value: number) => void
  onUseCurriculumRecommendation: () => void
}) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Curriculum recommendation</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
            Recommended for {teamAgeGroup} / {recommendation.inferredMatchFormat}: {recommendation.curriculumTitle}
          </h2>
          <p className="mt-2 text-sm font-semibold text-emerald-900">{recommendation.weekFocus}</p>
          <p className="mt-2 text-sm leading-6 text-emerald-950">{recommendation.explanation}</p>
        </div>
        <button
          type="button"
          onClick={onUseCurriculumRecommendation}
          className={`${controlInteractionClassName} rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900`}
          disabled={recommendation.matchedEventDefinitionIds.length === 0}
        >
          Replace with recommended events
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-emerald-950">
          Theme
          <select
            value={curriculumFocus}
            onChange={(event) => setCurriculumFocus(event.target.value as CurriculumFocus)}
            className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
          >
            {curriculumFocusOptions.map((focus) => (
              <option key={focus} value={focus}>{focus}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-emerald-950">
          Week
          <select
            value={curriculumWeekNumber}
            onChange={(event) => setCurriculumWeekNumber(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950"
          >
            <option value={1}>Week 1 - introduce theme</option>
            <option value={2}>Week 2 - repeat and reinforce</option>
            <option value={3}>Week 3 - add challenge</option>
            <option value={4}>Week 4 - review and compare</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-white/80 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Matched in event library</p>
          {recommendation.matchedEvents.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-amber-800">No matching events found yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendation.matchedEvents.map((event) => (
                <span key={event.id} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                  {event.name}{event.scope === 'CLUB' ? ' · Club' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {recommendation.missingEventNames.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Not in your event library yet</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendation.missingEventNames.map((eventName) => (
                <span key={eventName} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-900">
                  {eventName}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-amber-900">
              Club admins can add missing ideas as custom events in Club Setup. This does not block match creation.
            </p>
          </div>
        )}
      </div>
    </section>
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

function getTaxonomyEventGroups(events: TaxonomyEvent[]) {
  const groups = new Map<string, TaxonomyEvent[]>()
  for (const event of events) {
    const label = event.categoryLabel || 'Other events'
    groups.set(label, [...(groups.get(label) ?? []), event])
  }
  return Array.from(groups.entries())
    .map(([label, groupEvents]) => ({ label, events: groupEvents }))
    .sort((firstGroup, secondGroup) => firstGroup.label.localeCompare(secondGroup.label))
}

function formatEventMeta(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function formatEventCount(count: number) {
  return `${count} ${count === 1 ? 'event' : 'events'}`
}

function getStepDescription(step: number) {
  if (step === 3) return 'Choose what you want to track. Add squad details only if you need them.'
  if (step === 4) return 'Choose only what helps your coaching observation.'
  if (step === 5) return 'Check the setup before opening the match workspace.'
  return undefined
}

function TemplatePickerModal({
  templates,
  selectedTemplate,
  onSelectTemplate,
  onApplyTemplate,
  onClose,
  isPending,
}: {
  templates: PreviousSetup[]
  selectedTemplate: PreviousSetup | undefined
  onSelectTemplate: (templateId: string) => void
  onApplyTemplate: (template: PreviousSetup) => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <ModalShell title="Copy Previous Setup" description="Preview reusable setup, then apply it inside this wizard. Fixture details stay unchanged." onClose={onClose} isSubmitting={isPending} maxWidthClassName="max-w-4xl">
      {templates.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No previous setups are available for the selected team.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2" role="radiogroup" aria-label="Previous setups">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                role="radio"
                aria-checked={selectedTemplate?.id === template.id}
                onClick={() => onSelectTemplate(template.id)}
                className={`w-full rounded-xl border p-3 text-left text-sm ${selectedTemplate?.id === template.id ? selectedCardButtonClassName : unselectedCardButtonClassName}`}
              >
                <span className="block font-bold">{template.teamName} vs {template.opposition}</span>
                <span className={`mt-1 block text-xs ${selectedTemplate?.id === template.id ? 'text-blue-50' : 'text-slate-500'}`}>{template.clubName} · {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(template.kickoffAt))}</span>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedTemplate?.id === template.id ? 'bg-white text-blue-800' : 'bg-slate-100 text-slate-600'}`}>{selectedTemplate?.id === template.id ? 'Selected ✓' : 'Not selected'}</span>
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <h3 className="text-lg font-extrabold text-slate-950">Setup preview</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <PreviewItem label="Event tracking" value={selectedTemplate.eventTrackingScope === 'PLAYER' ? 'Selected players' : 'Whole team'} />
                <PreviewItem label="Player minutes" value={selectedTemplate.trackPlayerMinutes ? 'On' : 'Off'} />
                <PreviewItem label="Location tracking" value={selectedTemplate.locationTrackingEnabled ? 'On' : 'Off'} />
                <PreviewItem label="Events" value={`${formatEventCount(selectedTemplate.selectedEventDefinitionIds.length)} selected`} />
                <PreviewItem label="Tracked targets" value={`${selectedTemplate.players.filter((player) => player.isTracked).length} players`} />
                <PreviewItem label="Squad setup" value={`${selectedTemplate.players.filter((player) => player.squadStatus === 'STARTER').length} starters, ${selectedTemplate.players.filter((player) => player.squadStatus === 'SUBSTITUTE').length} subs`} />
              </dl>
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Events copied</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTemplate.eventLabels.slice(0, 12).map((label, index) => <span key={`${label}:${index}`} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{label}</span>)}
                  {selectedTemplate.eventLabels.length > 12 && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">+{selectedTemplate.eventLabels.length - 12} more</span>}
                </div>
              </div>
              <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-950">This applies reusable setup only. It will not copy score, match clock, stints, recorded events, reports, fixture date, kick-off, opposition, match type or venue.</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
                <Button type="button" onClick={() => onApplyTemplate(selectedTemplate)} disabled={isPending} isPending={isPending} pendingText="Applying setup…">Use this setup</Button>
              </div>
            </section>
          )}
        </div>
      )}
    </ModalShell>
  )
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-950">{value}</dd></div>
}

function getTemplateWarning(omittedPlayers: string[], omittedEventDefinitionCount: number) {
  const warnings = []
  if (omittedPlayers.length === 1) warnings.push(`${omittedPlayers[0]} was omitted because they are inactive or no longer belong to this team.`)
  if (omittedPlayers.length > 1) warnings.push(`${omittedPlayers.length} players were omitted because they are inactive or no longer belong to this team: ${omittedPlayers.slice(0, 5).join(', ')}${omittedPlayers.length > 5 ? ', and others' : ''}.`)
  if (omittedEventDefinitionCount > 0) warnings.push(`${omittedEventDefinitionCount} unavailable event${omittedEventDefinitionCount === 1 ? '' : 's'} were omitted.`)
  return warnings.length ? warnings.join(' ') : null
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
