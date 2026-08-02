'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { fieldClassName } from '@/components/ui/formStyles'
import type {
  ResolvedClubTrackingDefinition,
  ResolvedTrackingTopic,
  TrackingResolverContext,
  TrackingResolverStep,
} from '@/lib/matchTrackingResolver'

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

type TeamOption = {
  id: string
  clubId: string
  name: string
  clubName: string
  ageGroup: string
  agePhase: TrackingResolverContext['agePhase']
  players: Array<{ id: string; name: string; squadNumber: number | null; preferredPosition: string | null }>
}

type PreviousTask = { id: string; title: string; matchLabel: string; scopeType: string; eventCount: number; patternCount: number; clubDefinitionCount: number; patternNames: string[]; clubDefinitionNames: string[]; requiresPlayer: boolean }
type TemplateSummary = { id: string; name: string; description: string | null; visibility: string; taskCount: number; eventCount: number; patternCount: number; scopeSummary: string; teamName: string | null; lastUsedAt: Date | null }
type TemplatePreview = TemplateSummary & { tasks: Array<{ id: string; scopeType: 'PLAYER' | 'UNIT' | 'TEAM'; targetContext: string | null; unitKey: string | null; unitLabel: string | null; title: string; instructions: string | null; topicName: string | null; events: Array<{ eventDefinitionId: string; name: string; active: boolean }>; patterns: Array<{ patternId: string; name: string; active: boolean; aliases: string[] }> }> }
type SetupState = {
  id: string
  status: string
  squadCount: number
  tasks: Array<{
    id: string
    title: string
    scopeType: 'PLAYER' | 'UNIT' | 'TEAM'
    targetLabel: string
    topicName: string | null
    status: string
    eventCount: number
    patternCount: number
    clubDefinitionCount: number
    patternNames: string[]
    clubDefinitionNames: string[]
    assignments: Array<{ id: string; assignmentMode: string; status: string; assignedUserId: string | null; recipientCount: number; submittedObservationCount: number; pendingObservationCount: number; createdAt: Date; acceptedAt: Date | null; startedAt: Date | null; submittedAt: Date | null; cancelledAt: Date | null }>
    activeAssignment: { id: string; assignmentMode: string; status: string; assignedUserId: string | null; recipientCount: number } | null
  }>
  coverage: { totalTasks: number; assigned: number; openGroupOffers: number; awaitingResponse: number; accepted: number; unassigned: number; draftTasks: number }
}
type ContributorOption = { userId: string; label: string; detail: string; alreadyAssignedOnMatch: boolean }
type ClubSelection = { clubTrackingDefinitionId: string; expectedKind: string; expectedMappingRevision: number; expectedMappingStatus: string }

type Props = {
  teams: TeamOption[]
  createDraftAction: (formData: FormData) => Promise<ActionResult<{ id: string }>>
  updateDraftAction: (formData: FormData) => Promise<ActionResult>
  saveSquadAction: (formData: FormData) => Promise<ActionResult>
  resolveTrackingAction: (context: TrackingResolverContext) => Promise<ActionResult<{ nextStep: TrackingResolverStep | null; topic: ResolvedTrackingTopic | null }>>
  nextTrackingQuestionAction: (context: TrackingResolverContext) => Promise<ActionResult<TrackingResolverStep | null>>
  searchTopicsAction: (query: string, context: TrackingResolverContext) => Promise<ActionResult<Array<{ topicId: string; name: string; description?: string; matchedAliases: string[]; recommended: boolean }>>>
  getTopicEventsAction: (topicId: string, context: TrackingResolverContext) => Promise<ActionResult<ResolvedTrackingTopic | null>>
  getAdvancedItemsAction: (context: TrackingResolverContext) => Promise<ActionResult<{ events: Array<{ eventDefinitionId: string; name: string; description?: string; requiresLocation: boolean; recommendedByTopic: boolean; outsideChosenTopic: boolean; observerLoadWeight: number; searchText: string }>; patterns: Array<{ patternId: string; name: string; description?: string; requiresLocation: boolean; recommendedByTopic: boolean; outsideChosenTopic: boolean; observerLoadWeight: number; aliases: string[]; steps: Array<{ order: number; label: string }>; outcomes: Array<{ id: string; label: string }>; searchText: string }>; clubDefinitions: ResolvedClubTrackingDefinition[] }>>
  createTaskAction: (formData: FormData) => Promise<ActionResult<{ id: string }>>
  getPreviousTasksAction: (matchDayId: string) => Promise<ActionResult<PreviousTask[]>>
  getTemplatesAction: (teamId: string, query: string) => Promise<ActionResult<TemplateSummary[]>>
  getTemplatePreviewAction: (templateId: string) => Promise<ActionResult<TemplatePreview | null>>
  applyTemplateAction: (formData: FormData) => Promise<ActionResult<{ applicationId: string; taskIds: string[]; warnings: string[] }>>
  saveSetupAsTemplateAction: (formData: FormData) => Promise<ActionResult<{ id: string }>>
  copyTaskAction: (formData: FormData) => Promise<ActionResult<{ id: string; requiresPlayerSelection: boolean; missingEventIds: string[]; missingPatternIds: string[]; missingClubDefinitionIds?: string[] }>>
  getSetupStateAction: (matchDayId: string) => Promise<ActionResult<SetupState>>
  getEligibleContributorsAction: (trackingTaskId: string) => Promise<ActionResult<ContributorOption[]>>
  assignTaskAction: (formData: FormData) => Promise<ActionResult<{ id: string | null; alreadyExisted: boolean }>>
  cancelAssignmentAction: (formData: FormData) => Promise<ActionResult>
  applyToPlayersAction: (formData: FormData) => Promise<ActionResult<{ ids: string[] }>>
  publishSetupAction: (matchDayId: string) => Promise<ActionResult<{ warnings: string[]; coverage: SetupState['coverage'] }>>
}

type SquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'
type Stage = 'match' | 'squad' | 'tracking' | 'topic' | 'events' | 'assignments' | 'review'

const stages: Array<{ key: Stage; label: string }> = [
  { key: 'match', label: 'Match' },
  { key: 'squad', label: 'Squad' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'review', label: 'Review' },
]

const today = new Date().toISOString().slice(0, 10)
const createInitialSquadStatuses = (team?: TeamOption) => Object.fromEntries((team?.players ?? []).map((player) => [player.id, 'NOT_INVOLVED' as SquadStatus]))

const formatSquadNumber = (squadNumber: number | null) => squadNumber === null ? 'No #' : `#${squadNumber}`
const titleCase = (value: string) => value.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ')
const toggleId = (current: string[], id: string, checked: boolean) => checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)

export default function MatchDayV2SetupWizard({
  teams,
  createDraftAction,
  updateDraftAction,
  saveSquadAction,
  resolveTrackingAction,
  nextTrackingQuestionAction,
  searchTopicsAction,
  getTopicEventsAction,
  getAdvancedItemsAction,
  createTaskAction,
  getPreviousTasksAction,
  getTemplatesAction,
  getTemplatePreviewAction,
  applyTemplateAction,
  saveSetupAsTemplateAction,
  copyTaskAction,
  getSetupStateAction,
  getEligibleContributorsAction,
  assignTaskAction,
  cancelAssignmentAction,
  applyToPlayersAction,
  publishSetupAction,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [stage, setStage] = useState<Stage>('match')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matchDayId, setMatchDayId] = useState<string | null>(null)
  const [createdTaskIds, setCreatedTaskIds] = useState<string[]>([])
  const [previousTasks, setPreviousTasks] = useState<PreviousTask[]>([])
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreview | null>(null)
  const [templatePlayerMappings, setTemplatePlayerMappings] = useState<Record<string, string[]>>({})
  const [templateUnitLabels, setTemplateUnitLabels] = useState<Record<string, string>>({})
  const [allowTemplateDuplicates, setAllowTemplateDuplicates] = useState(false)
  const [saveTemplateDetails, setSaveTemplateDetails] = useState({ name: '', description: '', visibility: 'PERSONAL' })
  const [setupState, setSetupState] = useState<SetupState | null>(null)
  const [published, setPublished] = useState<{ warnings: string[]; coverage: SetupState['coverage'] } | null>(null)

  const [matchDetails, setMatchDetails] = useState({
    teamId: teams[0]?.id ?? '',
    date: today,
    kickoffTime: '10:00',
    opposition: '',
    matchType: 'LEAGUE',
    venue: 'HOME',
  })
  const selectedTeam = teams.find((team) => team.id === matchDetails.teamId) ?? teams[0]
  const [squadStatuses, setSquadStatuses] = useState<Record<string, SquadStatus>>(() => createInitialSquadStatuses(teams[0]))
  const [startingPositions, setStartingPositions] = useState<Record<string, string>>({})
  const [trackingContext, setTrackingContext] = useState<TrackingResolverContext>({})
  const [nextStep, setNextStep] = useState<TrackingResolverStep | null>(null)
  const [topic, setTopic] = useState<ResolvedTrackingTopic | null>(null)
  const [topicSearch, setTopicSearch] = useState('')
  const [topicResults, setTopicResults] = useState<Array<{ topicId: string; name: string; description?: string; matchedAliases: string[]; recommended: boolean }>>([])
  const [selectedEventDefinitionIds, setSelectedEventDefinitionIds] = useState<string[]>([])
  const [selectedPatternIds, setSelectedPatternIds] = useState<string[]>([])
  const [selectedClubDefinitions, setSelectedClubDefinitions] = useState<ClubSelection[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedSearch, setAdvancedSearch] = useState('')
  const [advancedType, setAdvancedType] = useState<'ALL' | 'EVENTS' | 'PATTERNS'>('ALL')
  const [advancedItems, setAdvancedItems] = useState<Awaited<ReturnType<Props['getAdvancedItemsAction']>> extends ActionResult<infer T> ? T | null : never>(null)
  const [taskDetails, setTaskDetails] = useState({ playerId: '', unitLabel: '', title: '', instructions: '' })
  const involvedPlayers = selectedTeam?.players.filter((player) => squadStatuses[player.id] !== 'NOT_INVOLVED') ?? []
  const selectedEventCount = selectedEventDefinitionIds.length
  const selectedPatternCount = selectedPatternIds.length
  const selectedClubDefinitionCount = selectedClubDefinitions.length
  const selectedLoad = selectedEventDefinitionIds.reduce((total, id) => total + (topic?.events.find((event) => event.eventDefinitionId === id)?.observerLoadWeight ?? advancedItems?.events.find((event) => event.eventDefinitionId === id)?.observerLoadWeight ?? 1), 0) + selectedPatternIds.reduce((total, id) => total + (topic?.patterns.find((pattern) => pattern.patternId === id)?.observerLoadWeight ?? advancedItems?.patterns.find((pattern) => pattern.patternId === id)?.observerLoadWeight ?? 2), 0) + selectedClubDefinitions.reduce((total, selection) => total + (topic?.clubDefinitions.find((definition) => definition.clubTrackingDefinitionId === selection.clubTrackingDefinitionId)?.observerLoadWeight ?? advancedItems?.clubDefinitions.find((definition) => definition.clubTrackingDefinitionId === selection.clubTrackingDefinitionId)?.observerLoadWeight ?? 1), 0)

  const resetMessages = () => {
    setMessage(null)
    setError(null)
  }

  const toggleClubDefinition = (definition: ResolvedClubTrackingDefinition, checked: boolean) => {
    setSelectedClubDefinitions((current) => checked
      ? [...current.filter((selection) => selection.clubTrackingDefinitionId !== definition.clubTrackingDefinitionId), { clubTrackingDefinitionId: definition.clubTrackingDefinitionId, expectedKind: definition.kind, expectedMappingRevision: definition.mappingRevision, expectedMappingStatus: definition.mappingStatus }]
      : current.filter((selection) => selection.clubTrackingDefinitionId !== definition.clubTrackingDefinitionId))
  }

  const refreshSetupState = async (id = matchDayId) => {
    if (!id) return null
    const state = await getSetupStateAction(id)
    if (!state.ok) {
      setError(state.message)
      return null
    }
    setSetupState(state.data)
    return state.data
  }

  const submitMatchDetails = () => {
    resetMessages()
    const formData = new FormData()
    Object.entries(matchDetails).forEach(([key, value]) => formData.set(key, value))
    if (matchDayId) formData.set('matchDayId', matchDayId)
    startTransition(async () => {
      if (matchDayId) {
        const result = await updateDraftAction(formData)
        if (!result.ok) {
          setError(result.message)
          return
        }
        setStage('squad')
        setMessage('Draft match saved.')
        return
      }

      const result = await createDraftAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      const id = result.data.id
      if (id) {
        setMatchDayId(id)
        const previous = await getPreviousTasksAction(id)
        if (previous.ok) setPreviousTasks(previous.data)
        const savedTemplates = await getTemplatesAction(matchDetails.teamId, '')
        if (savedTemplates.ok) setTemplates(savedTemplates.data)
        await refreshSetupState(id)
      }
      setStage('squad')
      setMessage('Draft match saved.')
    })
  }

  const saveSquad = () => {
    if (!matchDayId) return
    resetMessages()
    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    for (const player of selectedTeam.players) {
      formData.append('playerId', player.id)
      formData.set(`squadStatus:${player.id}`, squadStatuses[player.id] ?? 'NOT_INVOLVED')
      formData.set(`startingPosition:${player.id}`, startingPositions[player.id] ?? '')
    }
    startTransition(async () => {
      const result = await saveSquadAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      await refreshSetupState()
      setStage('tracking')
      setMessage('Squad saved.')
    })
  }

  const chooseSetupMethod = async () => {
    resetMessages()
    const context: TrackingResolverContext = { teamId: selectedTeam.id, clubId: selectedTeam.clubId, agePhase: selectedTeam.agePhase }
    setTrackingContext(context)
    startTransition(async () => {
      const result = await nextTrackingQuestionAction(context)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setNextStep(result.data)
      setStage('topic')
    })
  }

  const updateResolverSelection = (key: string, value: string) => {
    const next = { ...trackingContext, [key]: value } as TrackingResolverContext
    if (key === 'scope' && value === 'TEAM') next.targetContext = 'WHOLE_TEAM'
    if (key === 'topicId') {
      setTaskDetails((current) => ({ ...current, title: topicResults.find((candidate) => candidate.topicId === value)?.name ?? current.title }))
    }
    setTrackingContext(next)
    resetMessages()
    startTransition(async () => {
      const resolved = await resolveTrackingAction(next)
      if (!resolved.ok) {
        setError(resolved.message)
        return
      }
      setNextStep(resolved.data.nextStep)
      setTopic(resolved.data.topic)
      if (resolved.data.topic) {
        setSelectedEventDefinitionIds(resolved.data.topic.events.filter((event) => event.recommended).map((event) => event.eventDefinitionId))
        setSelectedPatternIds(resolved.data.topic.patterns.filter((pattern) => pattern.recommended).map((pattern) => pattern.patternId))
        setSelectedClubDefinitions([])
        setAdvancedOpen(false)
        setAdvancedItems(null)
        setTaskDetails((current) => ({ ...current, title: current.title || resolved.data.topic!.name }))
      }
    })
  }

  const searchTopics = () => {
    resetMessages()
    startTransition(async () => {
      const result = await searchTopicsAction(topicSearch, trackingContext)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setTopicResults(result.data)
    })
  }

  const loadTopic = (topicId: string) => {
    const next = { ...trackingContext, topicId }
    setTrackingContext(next)
    resetMessages()
    startTransition(async () => {
      const result = await getTopicEventsAction(topicId, next)
      if (!result.ok || !result.data) {
        setError(result.ok ? 'Topic is not compatible with this setup.' : result.message)
        return
      }
      setTopic(result.data)
      setSelectedEventDefinitionIds(result.data.events.filter((event) => event.recommended).map((event) => event.eventDefinitionId))
      setSelectedPatternIds(result.data.patterns.filter((pattern) => pattern.recommended).map((pattern) => pattern.patternId))
      setSelectedClubDefinitions([])
      setAdvancedOpen(false)
      setAdvancedItems(null)
      setTaskDetails((current) => ({ ...current, title: result.data!.name }))
      setStage('events')
    })
  }

  const createTask = () => {
    if (!matchDayId || !topic || !trackingContext.scope || !trackingContext.phase || !trackingContext.focusArea || !trackingContext.topicId) return
    resetMessages()
    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('scope', trackingContext.scope)
    formData.set('targetContext', trackingContext.targetContext ?? '')
    formData.set('phase', trackingContext.phase)
    formData.set('focusArea', trackingContext.focusArea)
    formData.set('topicId', trackingContext.topicId)
    formData.set('playerId', trackingContext.scope === 'PLAYER' ? taskDetails.playerId : '')
    formData.set('unitLabel', trackingContext.scope === 'UNIT' ? taskDetails.unitLabel || titleCase(trackingContext.targetContext ?? 'CUSTOM_UNIT') : '')
    formData.set('unitKey', trackingContext.scope === 'UNIT' ? (trackingContext.targetContext ?? taskDetails.unitLabel).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-') : '')
    formData.set('title', taskDetails.title)
    formData.set('instructions', taskDetails.instructions)
    selectedEventDefinitionIds.forEach((id) => formData.append('eventDefinitionId', id))
    selectedPatternIds.forEach((id) => formData.append('patternId', id))
    selectedClubDefinitions.forEach((selection, index) => {
      formData.append('clubTrackingDefinitionId', selection.clubTrackingDefinitionId)
      formData.set(`clubTrackingDefinitionKind:${index}`, selection.expectedKind)
      formData.set(`clubTrackingDefinitionRevision:${index}`, String(selection.expectedMappingRevision))
      formData.set(`clubTrackingDefinitionStatus:${index}`, selection.expectedMappingStatus)
    })
    startTransition(async () => {
      const result = await createTaskAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setCreatedTaskIds((current) => [...current, result.data.id])
      setMessage('Tracking task saved and marked ready.')
      await refreshSetupState()
      setStage('assignments')
    })
  }

  const openAdvancedBuilder = () => {
    resetMessages()
    setAdvancedOpen(true)
    startTransition(async () => {
      const result = await getAdvancedItemsAction({ ...trackingContext, selectedEventDefinitionIds, selectedPatternIds, selectedClubTrackingDefinitionIds: selectedClubDefinitions.map((selection) => selection.clubTrackingDefinitionId) })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setAdvancedItems(result.data)
    })
  }

  const copyPreviousTask = (sourceTaskId: string, destinationPlayerId: string) => {
    if (!matchDayId) return
    resetMessages()
    const formData = new FormData()
    formData.set('sourceTaskId', sourceTaskId)
    formData.set('destinationMatchDayId', matchDayId)
    formData.set('destinationPlayerId', destinationPlayerId)
    startTransition(async () => {
      const result = await copyTaskAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setCreatedTaskIds((current) => [...current, result.data.id])
      await refreshSetupState()
      setMessage('Previous task copied into this match.')
    })
  }

  const searchTemplates = () => {
    if (!selectedTeam) return
    resetMessages()
    startTransition(async () => {
      const result = await getTemplatesAction(selectedTeam.id, templateSearch)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setTemplates(result.data)
    })
  }

  const loadTemplate = (templateId: string) => {
    resetMessages()
    startTransition(async () => {
      const result = await getTemplatePreviewAction(templateId)
      if (!result.ok || !result.data) {
        setError(result.ok ? 'Template was not found.' : result.message)
        return
      }
      setSelectedTemplate(result.data)
      setTemplatePlayerMappings({})
      setTemplateUnitLabels(Object.fromEntries(result.data.tasks.filter((task) => task.scopeType === 'UNIT').map((task) => [task.id, task.unitLabel ?? ''])))
    })
  }

  const toggleTemplatePlayer = (taskId: string, playerId: string, checked: boolean) => {
    setTemplatePlayerMappings((current) => ({ ...current, [taskId]: toggleId(current[taskId] ?? [], playerId, checked) }))
  }

  const applyTemplate = () => {
    if (!matchDayId || !selectedTemplate) return
    resetMessages()
    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('templateId', selectedTemplate.id)
    formData.set('idempotencyKey', crypto.randomUUID())
    formData.set('allowDuplicate', allowTemplateDuplicates ? 'true' : 'false')
    selectedTemplate.tasks.forEach((task) => {
      if (task.scopeType === 'PLAYER') (templatePlayerMappings[task.id] ?? []).forEach((playerId) => formData.append(`playerId:${task.id}`, playerId))
      if (task.scopeType === 'UNIT') {
        const label = templateUnitLabels[task.id] || task.unitLabel || titleCase(task.targetContext ?? 'CUSTOM_UNIT')
        formData.set(`unitLabel:${task.id}`, label)
        formData.set(`unitKey:${task.id}`, (task.targetContext ?? label).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-'))
      }
    })
    startTransition(async () => {
      const result = await applyTemplateAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setCreatedTaskIds((current) => [...current, ...result.data.taskIds])
      await refreshSetupState()
      setMessage(`Template applied. Created ${result.data.taskIds.length} task${result.data.taskIds.length === 1 ? '' : 's'}.${result.data.warnings.length ? ` ${result.data.warnings.join(' ')}` : ''}`)
      setStage('assignments')
    })
  }

  const saveSetupAsTemplate = () => {
    if (!matchDayId || !setupState || setupState.tasks.length === 0) return
    resetMessages()
    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('name', saveTemplateDetails.name)
    formData.set('description', saveTemplateDetails.description)
    formData.set('visibility', saveTemplateDetails.visibility)
    setupState.tasks.forEach((task) => formData.append('taskId', task.id))
    startTransition(async () => {
      const result = await saveSetupAsTemplateAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setSaveTemplateDetails({ name: '', description: '', visibility: 'PERSONAL' })
      setMessage('Tracking setup saved as a reusable template.')
    })
  }

  const publishSetup = () => {
    if (!matchDayId) return
    resetMessages()
    startTransition(async () => {
      const result = await publishSetupAction(matchDayId)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setPublished(result.data)
      await refreshSetupState()
      setMessage('Match Day setup ready.')
    })
  }

  return (
    <div className="space-y-5">
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Setup progress">
        {stages.map((item) => (
          <button key={item.key} type="button" onClick={() => setStage(item.key)} disabled={item.key !== 'match' && !matchDayId} className={`rounded-xl border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${stage === item.key ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
            {item.label}
          </button>
        ))}
      </nav>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {stage === 'match' && selectedTeam && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Match details</h2>
              <p className="mt-1 text-sm text-slate-600">Saved as a draft before squad and tracking setup.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">Preview</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Team"><select className={fieldClassName} value={matchDetails.teamId} onChange={(event) => { const nextTeam = teams.find((team) => team.id === event.target.value); setMatchDetails({ ...matchDetails, teamId: event.target.value }); setSquadStatuses(createInitialSquadStatuses(nextTeam)); setStartingPositions({}) }}>{teams.map((team) => <option key={team.id} value={team.id}>{team.clubName} / {team.name}</option>)}</select></FormField>
            <FormField label="Opposition"><input className={fieldClassName} value={matchDetails.opposition} onChange={(event) => setMatchDetails({ ...matchDetails, opposition: event.target.value })} /></FormField>
            <FormField label="Date"><input type="date" className={fieldClassName} value={matchDetails.date} onChange={(event) => setMatchDetails({ ...matchDetails, date: event.target.value })} /></FormField>
            <FormField label="Kick-off"><input type="time" className={fieldClassName} value={matchDetails.kickoffTime} onChange={(event) => setMatchDetails({ ...matchDetails, kickoffTime: event.target.value })} /></FormField>
            <FormField label="Match type"><select className={fieldClassName} value={matchDetails.matchType} onChange={(event) => setMatchDetails({ ...matchDetails, matchType: event.target.value })}><option value="LEAGUE">League</option><option value="CUP">Cup</option><option value="FRIENDLY">Friendly</option></select></FormField>
            <FormField label="Venue"><select className={fieldClassName} value={matchDetails.venue} onChange={(event) => setMatchDetails({ ...matchDetails, venue: event.target.value })}><option value="HOME">Home</option><option value="AWAY">Away</option><option value="NEUTRAL">Neutral</option></select></FormField>
          </div>
          <div className="mt-5 flex justify-end"><Button onClick={submitMatchDetails} disabled={isPending}>{matchDayId ? 'Save and continue' : 'Create draft and continue'}</Button></div>
        </section>
      )}

      {stage === 'squad' && selectedTeam && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold">Squad setup</h2>
          <p className="mt-1 text-sm text-slate-600">Choose who is involved. Player-scoped tracking tasks can only target involved players.</p>
          <div className="mt-5 grid gap-3">
            {selectedTeam.players.map((player) => (
              <article key={player.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-bold">{player.name}</p><p className="text-sm text-slate-500">{formatSquadNumber(player.squadNumber)} · {player.preferredPosition ?? 'No preferred position'}</p></div>
                  <select className={`${fieldClassName} w-auto min-w-40`} value={squadStatuses[player.id] ?? 'NOT_INVOLVED'} onChange={(event) => setSquadStatuses({ ...squadStatuses, [player.id]: event.target.value as SquadStatus })}>
                    <option value="STARTER">Starter</option><option value="SUBSTITUTE">Substitute</option><option value="NOT_INVOLVED">Not involved</option>
                  </select>
                </div>
                {(squadStatuses[player.id] === 'STARTER' || squadStatuses[player.id] === 'SUBSTITUTE') && <input className={`${fieldClassName} mt-3`} placeholder="Starting position or role" value={startingPositions[player.id] ?? ''} onChange={(event) => setStartingPositions({ ...startingPositions, [player.id]: event.target.value })} />}
              </article>
            ))}
          </div>
          <div className="mt-5 flex justify-between"><Button variant="secondary" onClick={() => setStage('match')}>Back</Button><Button onClick={saveSquad} disabled={isPending}>Save squad</Button></div>
        </section>
      )}

      {stage === 'tracking' && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold">Tracking setup</h2>
          <p className="mt-1 text-sm text-slate-600">Use standard coaching topics, saved templates, or copy a previous task into this draft match.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={chooseSetupMethod} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left hover:border-emerald-500">
              <span className="text-lg font-bold text-emerald-950">Create from coaching topic</span>
              <span className="mt-2 block text-sm text-emerald-900">Pick player, unit or team context and review recommended events.</span>
            </button>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <h3 className="text-lg font-bold text-blue-950">Use a saved template</h3>
              <p className="mt-1 text-sm text-blue-900">Reusable task blueprints for standard events and tactical patterns.</p>
              <TemplatePicker templates={templates} search={templateSearch} onSearch={setTemplateSearch} onRunSearch={searchTemplates} selectedTemplate={selectedTemplate} onSelectTemplate={loadTemplate} players={involvedPlayers} playerMappings={templatePlayerMappings} onTogglePlayer={toggleTemplatePlayer} unitLabels={templateUnitLabels} onUnitLabelChange={(taskId, label) => setTemplateUnitLabels((current) => ({ ...current, [taskId]: label }))} allowDuplicate={allowTemplateDuplicates} onAllowDuplicateChange={setAllowTemplateDuplicates} onApply={applyTemplate} disabled={isPending} />
            </div>
            <div className="rounded-2xl border p-5">
              <h3 className="text-lg font-bold">Copy previous task</h3>
              {previousTasks.length === 0 ? <p className="mt-2 text-sm text-slate-600">No previous tasks are available for this team yet.</p> : <PreviousTaskCopy tasks={previousTasks} players={involvedPlayers} onCopy={copyPreviousTask} disabled={isPending} />}
            </div>
          </div>
          <div className="mt-5 flex justify-between"><Button variant="secondary" onClick={() => setStage('squad')}>Back</Button><Button variant="secondary" onClick={() => setStage('assignments')}>Assign contributors</Button></div>
        </section>
      )}

      {stage === 'topic' && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold">Choose tracking topic</h2>
          {nextStep ? (
            <div className="mt-4">
              <h3 className="font-bold">{nextStep.label}</h3>
              {nextStep.description && <p className="mt-1 text-sm text-slate-600">{nextStep.description}</p>}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {nextStep.options.map((option) => (
                  <button key={option.value} type="button" onClick={() => updateResolverSelection(nextStep.key, option.value)} className="rounded-xl border p-4 text-left hover:border-emerald-500">
                    <span className="font-bold">{option.label}</span>{option.recommended && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">Recommended</span>}
                    {option.description && <span className="mt-1 block text-sm text-slate-600">{option.description}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border bg-slate-50 p-4"><p className="font-bold">Topic context complete.</p><Button className="mt-3" onClick={() => trackingContext.topicId && loadTopic(trackingContext.topicId)}>Review recommended events</Button></div>
          )}
          <div className="mt-6 rounded-xl border p-4">
            <h3 className="font-bold">Search topics</h3>
            <div className="mt-2 flex gap-2"><input className={fieldClassName} value={topicSearch} onChange={(event) => setTopicSearch(event.target.value)} placeholder="Try link play, counter, third man..." /><Button variant="secondary" onClick={searchTopics}>Search</Button></div>
            <div className="mt-3 grid gap-2">{topicResults.map((result) => <button key={result.topicId} type="button" onClick={() => loadTopic(result.topicId)} className="rounded-xl border p-3 text-left hover:border-emerald-500"><span className="font-bold">{result.name}</span>{result.description && <span className="block text-sm text-slate-600">{result.description}</span>}</button>)}</div>
          </div>
          <div className="mt-5 flex justify-between"><Button variant="secondary" onClick={() => setStage('tracking')}>Back</Button>{topic && <Button onClick={() => setStage('events')}>Review events</Button>}</div>
        </section>
      )}

      {stage === 'events' && topic && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold">What should be tracked?</h2>
          <p className="mt-1 text-sm text-slate-600">{topic.workloadMessage}</p>
          <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{getWorkloadMessage(selectedEventCount, selectedPatternCount, selectedClubDefinitionCount, selectedLoad)}</p>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section>
              <h3 className="text-lg font-extrabold text-slate-950">Events</h3>
              <p className="text-sm text-slate-600">Single observable actions.</p>
              <div className="mt-3 grid gap-3">
                {topic.events.map((event) => (
                  <label key={event.eventDefinitionId} className="flex gap-3 rounded-xl border p-4">
                    <input type="checkbox" checked={selectedEventDefinitionIds.includes(event.eventDefinitionId)} onChange={(change) => setSelectedEventDefinitionIds((current) => toggleId(current, event.eventDefinitionId, change.target.checked))} />
                    <span><span className="font-bold">{event.name}</span>{event.recommended && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">Recommended</span>}<span className="block text-sm text-slate-600">{event.description ?? event.guidance ?? 'Record when this action occurs.'}</span>{event.requiresLocation && <span className="mt-1 block text-xs font-bold text-blue-700">Requires location</span>}</span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-extrabold text-slate-950">Tactical patterns</h3>
              <p className="text-sm text-slate-600">Routes, combinations or sequences recorded as one overall outcome.</p>
              <div className="mt-3 grid gap-3">
                {topic.patterns.length === 0 ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No standard tactical patterns are recommended for this topic yet.</p> : topic.patterns.map((pattern) => (
                  <PatternSelectionCard key={pattern.patternId} pattern={pattern} selected={selectedPatternIds.includes(pattern.patternId)} onToggle={(checked) => setSelectedPatternIds((current) => toggleId(current, pattern.patternId, checked))} />
                ))}
              </div>
            </section>
          </div>

          {topic.clubDefinitions.length > 0 && (
            <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-lg font-extrabold text-blue-950">Club additions</h3>
              <p className="text-sm text-blue-900">Approved club-specific tracking definitions linked to this topic. These are explicit additions.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {topic.clubDefinitions.map((definition) => <ClubDefinitionSelectionCard key={definition.clubTrackingDefinitionId} definition={definition} selected={selectedClubDefinitions.some((selection) => selection.clubTrackingDefinitionId === definition.clubTrackingDefinitionId)} onToggle={(checked) => toggleClubDefinition(definition, checked)} />)}
              </div>
            </section>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-4">
            <p className="font-bold text-blue-950">Need something more detailed?</p>
            <p className="mt-1 text-sm text-blue-900">Open the advanced builder to combine compatible standard events and tactical patterns without changing the selected topic.</p>
            <Button className="mt-3" variant="secondary" onClick={openAdvancedBuilder} disabled={isPending}>Open advanced builder</Button>
          </div>

          {advancedOpen && <AdvancedBuilder items={advancedItems} search={advancedSearch} onSearch={setAdvancedSearch} itemType={advancedType} onTypeChange={setAdvancedType} selectedEventIds={selectedEventDefinitionIds} selectedPatternIds={selectedPatternIds} selectedClubDefinitions={selectedClubDefinitions} onToggleEvent={(id, checked) => setSelectedEventDefinitionIds((current) => toggleId(current, id, checked))} onTogglePattern={(id, checked) => setSelectedPatternIds((current) => toggleId(current, id, checked))} onToggleClubDefinition={toggleClubDefinition} />}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {trackingContext.scope === 'PLAYER' && <FormField label="Player target"><select className={fieldClassName} value={taskDetails.playerId} onChange={(event) => setTaskDetails({ ...taskDetails, playerId: event.target.value })}><option value="">Choose player</option>{involvedPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></FormField>}
            {trackingContext.scope === 'UNIT' && <FormField label="Unit label"><input className={fieldClassName} value={taskDetails.unitLabel} onChange={(event) => setTaskDetails({ ...taskDetails, unitLabel: event.target.value })} placeholder={titleCase(trackingContext.targetContext ?? 'Unit')} /></FormField>}
            <FormField label="Task title"><input className={fieldClassName} value={taskDetails.title} onChange={(event) => setTaskDetails({ ...taskDetails, title: event.target.value })} /></FormField>
            <FormField label="Instructions"><textarea className={fieldClassName} value={taskDetails.instructions} onChange={(event) => setTaskDetails({ ...taskDetails, instructions: event.target.value })} rows={3} /></FormField>
          </div>
          <div className="mt-5 flex justify-between"><Button variant="secondary" onClick={() => setStage('topic')}>Back</Button><Button onClick={createTask} disabled={isPending || selectedEventDefinitionIds.length + selectedPatternIds.length + selectedClubDefinitions.length === 0}>Save tracking task</Button></div>
        </section>
      )}

      {stage === 'assignments' && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Assignments</h2>
              <p className="mt-1 text-sm text-slate-600">Choose who will track each ready task, or leave tasks unassigned for later.</p>
            </div>
            {setupState && <CoverageSummary coverage={setupState.coverage} />}
          </div>
          {!setupState || setupState.tasks.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Create at least one tracking task before assigning contributors.</p>
          ) : (
            <div className="mt-5 grid gap-4">
              {setupState.tasks.map((task) => <AssignmentTaskCard key={task.id} task={task} players={involvedPlayers} disabled={isPending} getEligibleContributorsAction={getEligibleContributorsAction} assignTaskAction={assignTaskAction} cancelAssignmentAction={cancelAssignmentAction} applyToPlayersAction={applyToPlayersAction} onChanged={refreshSetupState} />)}
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-between gap-3"><Button variant="secondary" onClick={() => setStage('tracking')}>Back</Button><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={chooseSetupMethod}>Add another task</Button><Button onClick={() => setStage('review')}>Review setup</Button></div></div>
        </section>
      )}

      {stage === 'review' && (
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-bold">Review setup</h2>
          {published && (
            <Alert variant="success" className="mt-4">
              <p>Match Day setup ready. {published.coverage.assigned} of {published.coverage.totalTasks} tasks have an active assignment.</p>
              {published.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{published.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            </Alert>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Summary label="Match" value={matchDetails.opposition || 'Draft'} />
            <Summary label="In squad" value={String(involvedPlayers.length)} />
            <Summary label="Tracking tasks" value={String(setupState?.coverage.totalTasks ?? createdTaskIds.length)} />
          </div>
          {setupState && <div className="mt-4"><CoverageSummary coverage={setupState.coverage} /></div>}
          {setupState && <div className="mt-5 grid gap-3">{setupState.tasks.map((task) => <article key={task.id} className="rounded-xl border p-4"><p className="font-bold">{task.title}</p><p className="mt-1 text-sm text-slate-600">{task.scopeType} · {task.targetLabel} · {task.eventCount} events · {task.patternCount} patterns · {task.clubDefinitionCount} club items · {task.status}</p>{task.patternNames.length > 0 && <p className="mt-1 text-xs font-semibold text-slate-500">Patterns: {task.patternNames.join(', ')}</p>}{task.clubDefinitionNames.length > 0 && <p className="mt-1 text-xs font-semibold text-blue-700">Club: {task.clubDefinitionNames.join(', ')}</p>}<p className="mt-1 text-sm font-semibold text-slate-700">{task.activeAssignment ? `${task.activeAssignment.assignmentMode.replace('_', ' ')} · ${task.activeAssignment.status}${task.activeAssignment.recipientCount ? ` · ${task.activeAssignment.recipientCount} recipients` : ''}` : 'No assignment yet'}</p>{!task.activeAssignment && <p className="mt-1 text-sm text-amber-800">Warning: unassigned task.</p>}</article>)}</div>}
          {setupState && setupState.tasks.length > 0 && <SaveTemplatePanel details={saveTemplateDetails} onChange={setSaveTemplateDetails} onSave={saveSetupAsTemplate} disabled={isPending} />}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setStage('tracking')}>Add another task</Button>
            <Button variant="secondary" onClick={() => setStage('assignments')}>Manage assignments</Button>
            <Button onClick={publishSetup} disabled={isPending || !matchDayId}>Publish setup</Button>
            {matchDayId && <Link href={`/match-day/${matchDayId}`} className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Open draft match</Link>}
            <Button variant="ghost" onClick={() => router.push('/match-day')}>Back to list</Button>
          </div>
        </section>
      )}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-950">{value}</p></div>
}

function getWorkloadMessage(eventCount: number, patternCount: number, clubDefinitionCount: number, load: number) {
  const total = eventCount + patternCount + clubDefinitionCount
  if (total === 0) return 'No tracking items selected yet.'
  const base = `${eventCount} event${eventCount === 1 ? '' : 's'}, ${patternCount} tactical pattern${patternCount === 1 ? '' : 's'} and ${clubDefinitionCount} club item${clubDefinitionCount === 1 ? '' : 's'} selected`
  if (load <= 7) return `${base} - suitable for one focused observer.`
  if (load <= 12) return `${base} - manageable, but the observer should stay focused.`
  return `${base} - this may be difficult to track accurately.`
}

function ClubDefinitionSelectionCard({ definition, selected, onToggle }: { definition: ResolvedClubTrackingDefinition; selected: boolean; onToggle: (checked: boolean) => void }) {
  return <label className={`flex gap-3 rounded-xl border p-4 ${selected ? 'border-blue-600 bg-white' : 'border-blue-100 bg-blue-50'}`}><input type="checkbox" checked={selected} onChange={(event) => onToggle(event.target.checked)} /><span><span className="font-bold text-slate-950">{definition.name}</span><span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-blue-800">{definition.identityType}</span><span className="block text-sm text-slate-700">{definition.mappedStandardName ? `${definition.identityType} for ${definition.mappedStandardName}` : definition.description ?? 'Club-specific tracking item'}</span><span className="mt-1 block text-xs font-bold text-slate-600">{definition.contributesToStandardReporting ? 'Counts in standard reporting' : 'Club reporting only'} · {definition.requiresLocation ? 'Requires location' : 'No required location'}</span></span></label>
}

function PatternSelectionCard({ pattern, selected, onToggle }: { pattern: ResolvedTrackingTopic['patterns'][number]; selected: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <article className={`rounded-xl border p-4 ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <label className="flex gap-3">
        <input type="checkbox" checked={selected} onChange={(event) => onToggle(event.target.checked)} aria-label={`Select tactical pattern ${pattern.name}`} />
        <span>
          <span className="font-bold text-slate-950">{pattern.name}</span>{pattern.recommended && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Recommended</span>}
          <span className="mt-1 block text-sm text-slate-600">{pattern.description ?? 'Record this tactical pattern as one observation with one outcome.'}</span>
          <span className="mt-2 block text-xs font-bold text-slate-600">{pattern.steps.length} steps · {pattern.outcomes.length} outcomes · Load {pattern.observerLoadWeight}{pattern.requiresLocation ? ' · Requires location' : ''}</span>
        </span>
      </label>
      <details className="mt-3 rounded-lg bg-white p-3 text-sm">
        <summary className="cursor-pointer font-bold text-blue-800">Inspect details</summary>
        <p className="mt-2 text-slate-700">Observer records the overall pattern and outcome, not each step independently.</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">{pattern.steps.map((step) => <li key={`${pattern.patternId}-${step.order}`}>{step.label}</li>)}</ol>
        <p className="mt-3 font-bold">Outcomes</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{pattern.outcomes.map((outcome) => <li key={outcome.id}>{outcome.label}</li>)}</ul>
      </details>
    </article>
  )
}

function AdvancedBuilder({ items, search, onSearch, itemType, onTypeChange, selectedEventIds, selectedPatternIds, selectedClubDefinitions, onToggleEvent, onTogglePattern, onToggleClubDefinition }: { items: Awaited<ReturnType<Props['getAdvancedItemsAction']>> extends ActionResult<infer T> ? T | null : never; search: string; onSearch: (value: string) => void; itemType: 'ALL' | 'EVENTS' | 'PATTERNS'; onTypeChange: (value: 'ALL' | 'EVENTS' | 'PATTERNS') => void; selectedEventIds: string[]; selectedPatternIds: string[]; selectedClubDefinitions: ClubSelection[]; onToggleEvent: (id: string, checked: boolean) => void; onTogglePattern: (id: string, checked: boolean) => void; onToggleClubDefinition: (definition: ResolvedClubTrackingDefinition, checked: boolean) => void }) {
  const query = search.toLowerCase().trim()
  const eventRows = (items?.events ?? []).filter((event) => (itemType === 'ALL' || itemType === 'EVENTS') && (!query || event.searchText.includes(query) || event.name.toLowerCase().includes(query)))
  const patternRows = (items?.patterns ?? []).filter((pattern) => (itemType === 'ALL' || itemType === 'PATTERNS') && (!query || pattern.searchText.includes(query) || pattern.name.toLowerCase().includes(query) || pattern.aliases.some((alias) => alias.toLowerCase().includes(query))))
  const clubRows = (items?.clubDefinitions ?? []).filter((definition) => (itemType === 'ALL' || (itemType === 'EVENTS' && definition.kind.startsWith('EVENT')) || (itemType === 'PATTERNS' && definition.kind.startsWith('PATTERN'))) && (!query || definition.searchText.includes(query) || definition.name.toLowerCase().includes(query)))
  const sortRecommended = <T extends { recommendedByTopic: boolean; name: string }>(rows: T[]) => [...rows].sort((a, b) => Number(b.recommendedByTopic) - Number(a.recommendedByTopic) || a.name.localeCompare(b.name))

  return (
    <section className="mt-5 rounded-2xl border bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold text-slate-950">Advanced builder</h3>
          <p className="mt-1 text-sm text-slate-600">Search compatible standard tracking items. The server revalidates the final selection.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{selectedEventIds.length} events · {selectedPatternIds.length} patterns · {selectedClubDefinitions.length} club items selected</span>
      </div>
      <label className="mt-4 block text-sm font-bold text-slate-700">Search standard tracking items<input className={`${fieldClassName} mt-1`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="third man, flick on, behind left back, into feet" /></label>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Tracking item type">
        {(['ALL', 'EVENTS', 'PATTERNS'] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={itemType === value} onClick={() => onTypeChange(value)} className={`rounded-full px-3 py-2 text-sm font-bold ${itemType === value ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700'}`}>{value === 'ALL' ? 'All' : value === 'EVENTS' ? 'Events' : 'Patterns'}</button>)}
      </div>
      {!items ? <p className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600">Loading compatible items...</p> : <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(itemType === 'ALL' || itemType === 'EVENTS') && <section><h4 className="font-bold">Events</h4><div className="mt-2 grid gap-2">{sortRecommended(eventRows).map((event) => <label key={event.eventDefinitionId} className="flex gap-3 rounded-xl bg-white p-3"><input type="checkbox" checked={selectedEventIds.includes(event.eventDefinitionId)} onChange={(change) => onToggleEvent(event.eventDefinitionId, change.target.checked)} /><span><span className="font-bold">Event · {event.name}</span><span className="block text-sm text-slate-600">{event.recommendedByTopic ? 'Recommended' : 'Compatible addition'} · Load {event.observerLoadWeight}{event.requiresLocation ? ' · Requires location' : ''}</span></span></label>)}</div></section>}
        {(itemType === 'ALL' || itemType === 'PATTERNS') && <section><h4 className="font-bold">Tactical patterns</h4><div className="mt-2 grid gap-2">{sortRecommended(patternRows).map((pattern) => <label key={pattern.patternId} className="flex gap-3 rounded-xl bg-white p-3"><input type="checkbox" checked={selectedPatternIds.includes(pattern.patternId)} onChange={(change) => onTogglePattern(pattern.patternId, change.target.checked)} /><span><span className="font-bold">Pattern · {pattern.name}</span><span className="block text-sm text-slate-600">{pattern.recommendedByTopic ? 'Recommended' : 'Compatible addition'} · {pattern.steps.length} steps · {pattern.outcomes.length} outcomes · Load {pattern.observerLoadWeight}{pattern.requiresLocation ? ' · Requires location' : ''}</span></span></label>)}</div></section>}
        {clubRows.length > 0 && <section className="lg:col-span-2"><h4 className="font-bold">Club tracking definitions</h4><div className="mt-2 grid gap-2 md:grid-cols-2">{clubRows.map((definition) => <label key={definition.clubTrackingDefinitionId} className="flex gap-3 rounded-xl bg-white p-3"><input type="checkbox" checked={selectedClubDefinitions.some((selection) => selection.clubTrackingDefinitionId === definition.clubTrackingDefinitionId)} onChange={(change) => onToggleClubDefinition(definition, change.target.checked)} /><span><span className="font-bold">{definition.kind.startsWith('PATTERN') ? 'Pattern' : 'Event'} · {definition.name}</span><span className="block text-sm text-slate-600">{definition.identityType}{definition.mappedStandardName ? ` for ${definition.mappedStandardName}` : ''} · {definition.contributesToStandardReporting ? 'Standard reporting' : 'Club reporting only'} · {definition.requiresLocation ? 'Requires location' : 'No location required'}</span></span></label>)}</div></section>}
      </div>}
    </section>
  )
}

function CoverageSummary({ coverage }: { coverage: SetupState['coverage'] }) {
  return <div className="grid gap-2 rounded-xl border bg-slate-50 p-3 text-sm sm:grid-cols-3"><span><b>{coverage.totalTasks}</b> tasks</span><span><b>{coverage.assigned}</b> assigned</span><span><b>{coverage.openGroupOffers}</b> open offers</span><span><b>{coverage.awaitingResponse}</b> awaiting response</span><span><b>{coverage.accepted}</b> accepted</span><span className={coverage.unassigned ? 'font-bold text-amber-800' : ''}><b>{coverage.unassigned}</b> unassigned</span></div>
}

function AssignmentTaskCard({ task, players, disabled, getEligibleContributorsAction, assignTaskAction, cancelAssignmentAction, applyToPlayersAction, onChanged }: { task: SetupState['tasks'][number]; players: TeamOption['players']; disabled: boolean; getEligibleContributorsAction: Props['getEligibleContributorsAction']; assignTaskAction: Props['assignTaskAction']; cancelAssignmentAction: Props['cancelAssignmentAction']; applyToPlayersAction: Props['applyToPlayersAction']; onChanged: () => Promise<SetupState | null> }) {
  const [isOpen, setIsOpen] = useState(false)
  const [method, setMethod] = useState<'SELF' | 'DIRECT' | 'GROUP_OFFER' | 'LATER'>('LATER')
  const [contributors, setContributors] = useState<ContributorOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [multiPlayerIds, setMultiPlayerIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const filteredContributors = contributors.filter((contributor) => `${contributor.label} ${contributor.detail}`.toLowerCase().includes(search.toLowerCase()))

  const openPicker = () => {
    setIsOpen(true)
    setError(null)
    startTransition(async () => {
      const result = await getEligibleContributorsAction(task.id)
      if (!result.ok) setError(result.message)
      else setContributors(result.data)
    })
  }

  const assign = () => {
    setError(null)
    setMessage(null)
    const formData = new FormData()
    formData.set('trackingTaskId', task.id)
    formData.set('method', method)
    if (method === 'DIRECT') formData.set('assignedUserId', selectedUserId)
    selectedRecipients.forEach((userId) => formData.append('recipientUserId', userId))
    startTransition(async () => {
      const result = await assignTaskAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      await onChanged()
      setMessage(result.data.alreadyExisted ? 'Existing matching assignment reused.' : method === 'LATER' ? 'Task left unassigned.' : 'Assignment saved.')
      setIsOpen(false)
    })
  }

  const cancel = (assignmentId: string) => {
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    setError(null)
    startTransition(async () => {
      const result = await cancelAssignmentAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      await onChanged()
      setMessage('Assignment cancelled. You can choose a replacement now.')
    })
  }

  const applyToPlayers = () => {
    const formData = new FormData()
    formData.set('sourceTaskId', task.id)
    multiPlayerIds.forEach((playerId) => formData.append('playerId', playerId))
    setError(null)
    startTransition(async () => {
      const result = await applyToPlayersAction(formData)
      if (!result.ok) {
        setError(result.message)
        return
      }
      await onChanged()
      setMultiPlayerIds([])
      setMessage(`Created ${result.data.ids.length} additional player task${result.data.ids.length === 1 ? '' : 's'}.`)
    })
  }

  return (
    <article className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{task.topicName ?? task.title}</p>
          <p className="mt-1 text-sm text-slate-600">{task.scopeType} · {task.targetLabel} · {task.eventCount} events · {task.patternCount} patterns · {task.status}</p>
          {task.patternNames.length > 0 && <p className="mt-1 text-xs font-semibold text-slate-500">Patterns: {task.patternNames.join(', ')}</p>}
          <p className="mt-1 text-sm font-semibold text-slate-700">{task.activeAssignment ? `${task.activeAssignment.assignmentMode.replace('_', ' ')} · ${task.activeAssignment.status}${task.activeAssignment.recipientCount ? ` · ${task.activeAssignment.recipientCount} recipients` : ''}` : 'Unassigned'}</p>
        </div>
        <Button variant="secondary" onClick={openPicker} disabled={disabled || isPending || task.status !== 'READY'}>Choose who will track this</Button>
      </div>
      {message && <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}
      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
      {task.activeAssignment && ['PENDING', 'OFFERED'].includes(task.activeAssignment.status) && <Button className="mt-3" variant="secondary" onClick={() => cancel(task.activeAssignment!.id)} disabled={disabled || isPending}>Cancel current assignment</Button>}
      {task.activeAssignment && ['IN_PROGRESS', 'SUBMITTED'].includes(task.activeAssignment.status) && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Tracking has already started. This assignment cannot be silently reassigned.</p>}

      {isOpen && (
        <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
          <fieldset>
            <legend className="font-bold">Assignment method</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MethodCard selected={method === 'SELF'} label="I'll track this" description="Create an accepted assignment for you." onSelect={() => setMethod('SELF')} />
              <MethodCard selected={method === 'DIRECT'} label="Assign to one person" description="They will be asked to accept or decline this task." onSelect={() => setMethod('DIRECT')} />
              <MethodCard selected={method === 'GROUP_OFFER'} label="Offer to a group" description="The first person to accept will take responsibility for it." onSelect={() => setMethod('GROUP_OFFER')} />
              <MethodCard selected={method === 'LATER'} label="Assign later" description="Keep this task ready but unassigned." onSelect={() => setMethod('LATER')} />
            </div>
          </fieldset>
          {(method === 'DIRECT' || method === 'GROUP_OFFER') && <ContributorPicker contributors={filteredContributors} search={search} onSearch={setSearch} method={method} selectedUserId={selectedUserId} selectedRecipients={selectedRecipients} onSelectUser={setSelectedUserId} onToggleRecipient={(userId) => setSelectedRecipients((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId])} />}
          <div className="mt-4 flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={() => setIsOpen(false)}>Close</Button><Button onClick={assign} disabled={disabled || isPending || (method === 'DIRECT' && !selectedUserId) || (method === 'GROUP_OFFER' && selectedRecipients.length === 0)}>{method === 'LATER' ? 'Assign later' : 'Confirm assignment'}</Button></div>
        </div>
      )}

      {task.scopeType === 'PLAYER' && (
        <details className="mt-4 rounded-xl border p-3">
          <summary className="cursor-pointer font-bold">Apply this setup to more players</summary>
          <p className="mt-2 text-sm text-slate-600">Creates one separate task per selected player. Assignments are not copied.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{players.filter((player) => player.name !== task.targetLabel).map((player) => <label key={player.id} className="flex gap-2 rounded-lg border bg-white p-3 text-sm"><input type="checkbox" checked={multiPlayerIds.includes(player.id)} onChange={(event) => setMultiPlayerIds((current) => event.target.checked ? [...current, player.id] : current.filter((id) => id !== player.id))} /> {player.name}</label>)}</div>
          <Button className="mt-3" variant="secondary" onClick={applyToPlayers} disabled={disabled || isPending || multiPlayerIds.length === 0}>Create {multiPlayerIds.length || ''} player tasks</Button>
        </details>
      )}
    </article>
  )
}

function MethodCard({ selected, label, description, onSelect }: { selected: boolean; label: string; description: string; onSelect: () => void }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`rounded-xl border p-4 text-left ${selected ? 'border-emerald-700 bg-emerald-50' : 'bg-white'}`}><span className="block font-bold">{label}</span><span className="mt-1 block text-sm text-slate-600">{description}</span></button>
}

function ContributorPicker({ contributors, search, onSearch, method, selectedUserId, selectedRecipients, onSelectUser, onToggleRecipient }: { contributors: ContributorOption[]; search: string; onSearch: (value: string) => void; method: 'DIRECT' | 'GROUP_OFFER'; selectedUserId: string; selectedRecipients: string[]; onSelectUser: (value: string) => void; onToggleRecipient: (value: string) => void }) {
  return (
    <div className="mt-4">
      <label className="text-sm font-bold text-slate-700">Search contributors<input className={`${fieldClassName} mt-1`} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search by role or relationship" /></label>
      {contributors.length === 0 ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">No eligible contributors are currently connected to this player.</p> : <div className="mt-3 grid gap-2">{contributors.map((contributor) => <label key={contributor.userId} className="flex gap-3 rounded-xl border bg-white p-3"><input type={method === 'DIRECT' ? 'radio' : 'checkbox'} name="contributor" checked={method === 'DIRECT' ? selectedUserId === contributor.userId : selectedRecipients.includes(contributor.userId)} onChange={() => method === 'DIRECT' ? onSelectUser(contributor.userId) : onToggleRecipient(contributor.userId)} /><span><span className="font-bold">{contributor.label}</span><span className="block text-sm text-slate-600">{contributor.detail}{contributor.alreadyAssignedOnMatch ? ' · already has a match assignment' : ''}</span></span></label>)}</div>}
      {method === 'GROUP_OFFER' && <p className="mt-2 text-sm font-semibold text-slate-700">{selectedRecipients.length} selected. The first person to accept will take the assignment.</p>}
    </div>
  )
}

function TemplatePicker({ templates, search, onSearch, onRunSearch, selectedTemplate, onSelectTemplate, players, playerMappings, onTogglePlayer, unitLabels, onUnitLabelChange, allowDuplicate, onAllowDuplicateChange, onApply, disabled }: { templates: TemplateSummary[]; search: string; onSearch: (value: string) => void; onRunSearch: () => void; selectedTemplate: TemplatePreview | null; onSelectTemplate: (templateId: string) => void; players: TeamOption['players']; playerMappings: Record<string, string[]>; onTogglePlayer: (taskId: string, playerId: string, checked: boolean) => void; unitLabels: Record<string, string>; onUnitLabelChange: (taskId: string, label: string) => void; allowDuplicate: boolean; onAllowDuplicateChange: (value: boolean) => void; onApply: () => void; disabled: boolean }) {
  const selectedTemplateId = selectedTemplate?.id ?? templates[0]?.id ?? ''
  const playerTasksReady = selectedTemplate?.tasks.filter((task) => task.scopeType === 'PLAYER').every((task) => (playerMappings[task.id] ?? []).length > 0) ?? false
  const canApply = Boolean(selectedTemplate && (selectedTemplate.tasks.every((task) => task.scopeType !== 'PLAYER') || playerTasksReady))

  return (
    <div className="mt-3 grid gap-3">
      <div className="flex gap-2"><input className={fieldClassName} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search templates" /><Button variant="secondary" onClick={onRunSearch} disabled={disabled}>Search</Button></div>
      {templates.length === 0 ? <p className="rounded-xl bg-white p-3 text-sm text-blue-900">No saved templates are available for this team yet.</p> : <select className={fieldClassName} value={selectedTemplateId} onChange={(event) => onSelectTemplate(event.target.value)}><option value="">Choose template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} ({template.taskCount} tasks)</option>)}</select>}
      {selectedTemplate && (
        <div className="rounded-xl bg-white p-4">
          <p className="font-bold text-slate-950">{selectedTemplate.name}</p>
          <p className="mt-1 text-sm text-slate-600">{selectedTemplate.visibility} · {selectedTemplate.taskCount} tasks · {selectedTemplate.eventCount} events · {selectedTemplate.patternCount} patterns</p>
          {selectedTemplate.description && <p className="mt-1 text-sm text-slate-600">{selectedTemplate.description}</p>}
          <div className="mt-3 grid gap-3">
            {selectedTemplate.tasks.map((task) => (
              <article key={task.id} className="rounded-lg border p-3">
                <p className="font-bold">{task.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{task.scopeType} · {task.topicName ?? 'No topic'} · {task.events.length} events · {task.patterns.length} patterns</p>
                <p className="mt-1 text-xs text-slate-500">{[...task.events.map((event) => event.name), ...task.patterns.map((pattern) => pattern.name)].join(', ')}</p>
                {task.scopeType === 'PLAYER' && <div className="mt-3 grid gap-2 sm:grid-cols-2">{players.map((player) => <label key={player.id} className="flex gap-2 rounded-lg border bg-slate-50 p-2 text-sm"><input type="checkbox" checked={(playerMappings[task.id] ?? []).includes(player.id)} onChange={(event) => onTogglePlayer(task.id, player.id, event.target.checked)} />{player.name}</label>)}</div>}
                {task.scopeType === 'UNIT' && <label className="mt-3 block text-sm font-bold text-slate-700">Unit label<input className={`${fieldClassName} mt-1`} value={unitLabels[task.id] ?? task.unitLabel ?? ''} onChange={(event) => onUnitLabelChange(task.id, event.target.value)} /></label>}
              </article>
            ))}
          </div>
          <label className="mt-3 flex gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={allowDuplicate} onChange={(event) => onAllowDuplicateChange(event.target.checked)} />Allow duplicate resulting tasks</label>
          <Button className="mt-3" onClick={onApply} disabled={disabled || !canApply}>Apply template</Button>
        </div>
      )}
    </div>
  )
}

function SaveTemplatePanel({ details, onChange, onSave, disabled }: { details: { name: string; description: string; visibility: string }; onChange: (details: { name: string; description: string; visibility: string }) => void; onSave: () => void; disabled: boolean }) {
  return (
    <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <h3 className="text-lg font-bold text-blue-950">Save this setup as a template</h3>
      <p className="mt-1 text-sm text-blue-900">Saves the current tracking tasks only. Player IDs, assignments and observations are not stored.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <input className={fieldClassName} value={details.name} onChange={(event) => onChange({ ...details, name: event.target.value })} placeholder="Template name" />
        <select className={fieldClassName} value={details.visibility} onChange={(event) => onChange({ ...details, visibility: event.target.value })}><option value="PERSONAL">Personal</option><option value="TEAM">Team</option><option value="CLUB">Club owner only</option></select>
        <Button variant="secondary" onClick={onSave} disabled={disabled || !details.name.trim()}>Save template</Button>
      </div>
      <textarea className={`${fieldClassName} mt-3`} value={details.description} onChange={(event) => onChange({ ...details, description: event.target.value })} placeholder="Optional description" rows={2} />
    </section>
  )
}

function PreviousTaskCopy({ tasks, players, onCopy, disabled }: { tasks: PreviousTask[]; players: TeamOption['players']; onCopy: (sourceTaskId: string, destinationPlayerId: string) => void; disabled: boolean }) {
  const [sourceTaskId, setSourceTaskId] = useState(tasks[0]?.id ?? '')
  const [destinationPlayerId, setDestinationPlayerId] = useState('')
  const selectedTask = tasks.find((task) => task.id === sourceTaskId)
  return (
    <div className="mt-3 grid gap-3">
      <select className={fieldClassName} value={sourceTaskId} onChange={(event) => setSourceTaskId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title} ({task.matchLabel})</option>)}</select>
      {selectedTask?.requiresPlayer && <select className={fieldClassName} value={destinationPlayerId} onChange={(event) => setDestinationPlayerId(event.target.value)}><option value="">Choose destination player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>}
      <p className="text-xs text-slate-500">{selectedTask?.scopeType ?? 'Task'} · {selectedTask?.eventCount ?? 0} events · {selectedTask?.patternCount ?? 0} patterns · {selectedTask?.clubDefinitionCount ?? 0} club items</p>
      {selectedTask?.patternNames.length ? <p className="text-xs font-semibold text-slate-600">Patterns: {selectedTask.patternNames.join(', ')}</p> : null}
      {selectedTask?.clubDefinitionNames.length ? <p className="text-xs font-semibold text-blue-700">Club: {selectedTask.clubDefinitionNames.join(', ')}</p> : null}
      <Button variant="secondary" onClick={() => onCopy(sourceTaskId, destinationPlayerId)} disabled={disabled || !sourceTaskId || Boolean(selectedTask?.requiresPlayer && !destinationPlayerId)}>Copy task</Button>
    </div>
  )
}
