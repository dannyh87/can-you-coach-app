'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import { fieldClassName } from '@/components/ui/formStyles'
import type {
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

type PreviousTask = { id: string; title: string; matchLabel: string; scopeType: string; eventCount: number; requiresPlayer: boolean }
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
    assignments: Array<{ id: string; assignmentMode: string; status: string; assignedUserId: string | null; recipientCount: number; submittedObservationCount: number; pendingObservationCount: number; createdAt: Date; acceptedAt: Date | null; startedAt: Date | null; submittedAt: Date | null; cancelledAt: Date | null }>
    activeAssignment: { id: string; assignmentMode: string; status: string; assignedUserId: string | null; recipientCount: number } | null
  }>
  coverage: { totalTasks: number; assigned: number; openGroupOffers: number; awaitingResponse: number; accepted: number; unassigned: number; draftTasks: number }
}
type ContributorOption = { userId: string; label: string; detail: string; alreadyAssignedOnMatch: boolean }

type Props = {
  teams: TeamOption[]
  createDraftAction: (formData: FormData) => Promise<ActionResult<{ id: string }>>
  updateDraftAction: (formData: FormData) => Promise<ActionResult>
  saveSquadAction: (formData: FormData) => Promise<ActionResult>
  resolveTrackingAction: (context: TrackingResolverContext) => Promise<ActionResult<{ nextStep: TrackingResolverStep | null; topic: ResolvedTrackingTopic | null }>>
  nextTrackingQuestionAction: (context: TrackingResolverContext) => Promise<ActionResult<TrackingResolverStep | null>>
  searchTopicsAction: (query: string, context: TrackingResolverContext) => Promise<ActionResult<Array<{ topicId: string; name: string; description?: string; matchedAliases: string[]; recommended: boolean }>>>
  getTopicEventsAction: (topicId: string, context: TrackingResolverContext) => Promise<ActionResult<ResolvedTrackingTopic | null>>
  createTaskAction: (formData: FormData) => Promise<ActionResult<{ id: string }>>
  getPreviousTasksAction: (matchDayId: string) => Promise<ActionResult<PreviousTask[]>>
  copyTaskAction: (formData: FormData) => Promise<ActionResult<{ id: string; requiresPlayerSelection: boolean; missingEventIds: string[] }>>
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

export default function MatchDayV2SetupWizard({
  teams,
  createDraftAction,
  updateDraftAction,
  saveSquadAction,
  resolveTrackingAction,
  nextTrackingQuestionAction,
  searchTopicsAction,
  getTopicEventsAction,
  createTaskAction,
  getPreviousTasksAction,
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
  const [taskDetails, setTaskDetails] = useState({ playerId: '', unitLabel: '', title: '', instructions: '' })
  const involvedPlayers = selectedTeam?.players.filter((player) => squadStatuses[player.id] !== 'NOT_INVOLVED') ?? []

  const resetMessages = () => {
    setMessage(null)
    setError(null)
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
          <p className="mt-1 text-sm text-slate-600">Use standard coaching topics or copy a previous task into this draft match.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={chooseSetupMethod} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left hover:border-emerald-500">
              <span className="text-lg font-bold text-emerald-950">Create from coaching topic</span>
              <span className="mt-2 block text-sm text-emerald-900">Pick player, unit or team context and review recommended events.</span>
            </button>
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
          <h2 className="text-2xl font-bold">Recommended events</h2>
          <p className="mt-1 text-sm text-slate-600">{topic.workloadMessage}</p>
          <div className="mt-5 grid gap-3">
            {topic.events.map((event) => (
              <label key={event.eventDefinitionId} className="flex gap-3 rounded-xl border p-4">
                <input type="checkbox" checked={selectedEventDefinitionIds.includes(event.eventDefinitionId)} onChange={(change) => setSelectedEventDefinitionIds((current) => change.target.checked ? [...current, event.eventDefinitionId] : current.filter((id) => id !== event.eventDefinitionId))} />
                <span><span className="font-bold">{event.name}</span>{event.recommended && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">Recommended</span>}<span className="block text-sm text-slate-600">{event.description ?? event.guidance ?? 'Record when this moment occurs.'}</span></span>
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {trackingContext.scope === 'PLAYER' && <FormField label="Player target"><select className={fieldClassName} value={taskDetails.playerId} onChange={(event) => setTaskDetails({ ...taskDetails, playerId: event.target.value })}><option value="">Choose player</option>{involvedPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></FormField>}
            {trackingContext.scope === 'UNIT' && <FormField label="Unit label"><input className={fieldClassName} value={taskDetails.unitLabel} onChange={(event) => setTaskDetails({ ...taskDetails, unitLabel: event.target.value })} placeholder={titleCase(trackingContext.targetContext ?? 'Unit')} /></FormField>}
            <FormField label="Task title"><input className={fieldClassName} value={taskDetails.title} onChange={(event) => setTaskDetails({ ...taskDetails, title: event.target.value })} /></FormField>
            <FormField label="Instructions"><textarea className={fieldClassName} value={taskDetails.instructions} onChange={(event) => setTaskDetails({ ...taskDetails, instructions: event.target.value })} rows={3} /></FormField>
          </div>
          <div className="mt-5 flex justify-between"><Button variant="secondary" onClick={() => setStage('topic')}>Back</Button><Button onClick={createTask} disabled={isPending || selectedEventDefinitionIds.length === 0}>Save tracking task</Button></div>
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
          {setupState && <div className="mt-5 grid gap-3">{setupState.tasks.map((task) => <article key={task.id} className="rounded-xl border p-4"><p className="font-bold">{task.title}</p><p className="mt-1 text-sm text-slate-600">{task.scopeType} · {task.targetLabel} · {task.eventCount} events · {task.status}</p><p className="mt-1 text-sm font-semibold text-slate-700">{task.activeAssignment ? `${task.activeAssignment.assignmentMode.replace('_', ' ')} · ${task.activeAssignment.status}${task.activeAssignment.recipientCount ? ` · ${task.activeAssignment.recipientCount} recipients` : ''}` : 'No assignment yet'}</p>{!task.activeAssignment && <p className="mt-1 text-sm text-amber-800">Warning: unassigned task.</p>}</article>)}</div>}
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
          <p className="mt-1 text-sm text-slate-600">{task.scopeType} · {task.targetLabel} · {task.eventCount} events · {task.status}</p>
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

function PreviousTaskCopy({ tasks, players, onCopy, disabled }: { tasks: PreviousTask[]; players: TeamOption['players']; onCopy: (sourceTaskId: string, destinationPlayerId: string) => void; disabled: boolean }) {
  const [sourceTaskId, setSourceTaskId] = useState(tasks[0]?.id ?? '')
  const [destinationPlayerId, setDestinationPlayerId] = useState('')
  const selectedTask = tasks.find((task) => task.id === sourceTaskId)
  return (
    <div className="mt-3 grid gap-3">
      <select className={fieldClassName} value={sourceTaskId} onChange={(event) => setSourceTaskId(event.target.value)}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title} ({task.matchLabel})</option>)}</select>
      {selectedTask?.requiresPlayer && <select className={fieldClassName} value={destinationPlayerId} onChange={(event) => setDestinationPlayerId(event.target.value)}><option value="">Choose destination player</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>}
      <p className="text-xs text-slate-500">{selectedTask?.scopeType ?? 'Task'} · {selectedTask?.eventCount ?? 0} events</p>
      <Button variant="secondary" onClick={() => onCopy(sourceTaskId, destinationPlayerId)} disabled={disabled || !sourceTaskId || Boolean(selectedTask?.requiresPlayer && !destinationPlayerId)}>Copy task</Button>
    </div>
  )
}
