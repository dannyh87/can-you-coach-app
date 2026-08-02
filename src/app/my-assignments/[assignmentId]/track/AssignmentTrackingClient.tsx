'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import PitchLocationPicker, { type PitchLocation } from '@/components/PitchLocationPicker'
import ModalShell from '@/components/ui/ModalShell'

type ActionResult = { ok: true } | { ok: false; reason: string }
type UndoActionResult = { ok: true; type: 'event' | 'pattern'; label: string; timestamp: string } | { ok: false; reason: string }

type TrackingEvent = {
  source: 'STANDARD_EVENT' | 'CLUB_EVENT'
  id: string
  matchDayEventTypeId?: string
  taskClubDefinitionId?: string
  label: string
  description: string | null
  standardDisplayName: string | null
  identityLabel: string | null
  requiresLocation: boolean
}

type RecentObservation = {
  id: string
  type: 'event' | 'pattern'
  label: string
  detail: string | null
  targetLabel: string
  matchTime: string
  createdAt: string
  statusLabel: string
  status: 'PENDING' | 'ACCEPTED' | 'IGNORED'
  note: string | null
  hasLocation?: boolean
}

type TrackingPattern = {
  source: 'STANDARD_PATTERN' | 'CLUB_PATTERN'
  id: string
  patternId?: string
  taskClubDefinitionId?: string
  name: string
  description: string | null
  standardDisplayName: string | null
  identityLabel: string | null
  requiresLocation: boolean
  pendingCount: number
  steps: Array<{ order: number; label: string }>
  outcomes: Array<{ id: string; label: string; positive: boolean | null }>
}

type AssignmentTrackingClientProps = {
  assignmentId: string
  matchDayId: string
  playerId: string | null
  canRecord: boolean
  canFinish: boolean
  blockedMessage: string | null
  events: TrackingEvent[]
  patterns: TrackingPattern[]
  observations: RecentObservation[]
  eventObservationCount: number
  patternObservationCount: number
  recordAssignmentObservationAction: (formData: FormData) => Promise<ActionResult>
  recordAssignmentPatternObservationAction: (formData: FormData) => Promise<ActionResult>
  recordAssignedClubEventAction: (formData: FormData) => Promise<ActionResult>
  recordAssignedClubPatternAction: (formData: FormData) => Promise<ActionResult>
  undoAssignmentObservationAction: (formData: FormData) => Promise<UndoActionResult>
  finishAssignmentTrackingAction: (formData: FormData) => Promise<ActionResult>
}

const statusClasses = {
  PENDING: 'bg-amber-100 text-amber-900',
  ACCEPTED: 'bg-green-100 text-green-800',
  IGNORED: 'bg-slate-100 text-slate-700',
}

export default function AssignmentTrackingClient({
  assignmentId,
  matchDayId,
  playerId,
  canRecord,
  canFinish,
  blockedMessage,
  events,
  patterns,
  observations,
  eventObservationCount,
  patternObservationCount,
  recordAssignmentObservationAction,
  recordAssignmentPatternObservationAction,
  recordAssignedClubEventAction,
  recordAssignedClubPatternAction,
  undoAssignmentObservationAction,
  finishAssignmentTrackingAction,
}: AssignmentTrackingClientProps) {
  const router = useRouter()
  const [pendingEvent, setPendingEvent] = useState<TrackingEvent | null>(null)
  const [pendingPattern, setPendingPattern] = useState<TrackingPattern | null>(null)
  const [selectedOutcomeId, setSelectedOutcomeId] = useState('')
  const [patternLocation, setPatternLocation] = useState<PitchLocation | null>(null)
  const [pickingPatternLocation, setPickingPatternLocation] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)

  const buildFormData = (event: TrackingEvent, location?: PitchLocation) => {
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    formData.set('matchDayId', matchDayId)
    if (event.source === 'CLUB_EVENT') formData.set('taskClubDefinitionId', event.taskClubDefinitionId ?? event.id)
    else formData.set('matchDayEventTypeId', event.matchDayEventTypeId ?? event.id)
    if (playerId) formData.set('playerId', playerId)
    if (note.trim()) formData.set('note', note.trim())
    if (location) {
      formData.set('x', String(location.x))
      formData.set('y', String(location.y))
    }
    return formData
  }

  const recordEvent = async (event: TrackingEvent, location?: PitchLocation) => {
    if (!canRecord || pendingAction) return
    if (event.requiresLocation && !location) {
      setPendingEvent(event)
      setMessage(null)
      setError(null)
      return
    }

    setPendingAction(event.id)
    setMessage(null)
    setError(null)
    const result = event.source === 'CLUB_EVENT' ? await recordAssignedClubEventAction(buildFormData(event, location)) : await recordAssignmentObservationAction(buildFormData(event, location))
    if (result.ok) {
      setMessage(`${event.label} recorded.`)
      setNote('')
      setPendingEvent(null)
      router.refresh()
    } else {
      setError(result.reason)
    }
    setPendingAction(null)
  }

  const recordPattern = async () => {
    if (!canRecord || pendingAction || !pendingPattern) return
    if (!selectedOutcomeId) {
      setError('Choose an outcome for this tactical pattern.')
      return
    }
    if (pendingPattern.requiresLocation && !patternLocation) {
      setPickingPatternLocation(true)
      return
    }
    setPendingAction(pendingPattern.id)
    setMessage(null)
    setError(null)
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    formData.set('matchDayId', matchDayId)
    if (pendingPattern.source === 'CLUB_PATTERN') formData.set('taskClubDefinitionId', pendingPattern.taskClubDefinitionId ?? pendingPattern.id)
    else formData.set('patternId', pendingPattern.patternId ?? pendingPattern.id)
    formData.set('outcomeId', selectedOutcomeId)
    if (playerId) formData.set('playerId', playerId)
    if (note.trim()) formData.set('note', note.trim())
    if (patternLocation) {
      formData.set('x', String(patternLocation.x))
      formData.set('y', String(patternLocation.y))
    }
    const result = pendingPattern.source === 'CLUB_PATTERN' ? await recordAssignedClubPatternAction(formData) : await recordAssignmentPatternObservationAction(formData)
    if (result.ok) {
      setMessage(`${pendingPattern.name} recorded.`)
      setNote('')
      setPendingPattern(null)
      setSelectedOutcomeId('')
      setPatternLocation(null)
      router.refresh()
    } else {
      setError(result.reason)
    }
    setPendingAction(null)
  }

  const undoObservation = async () => {
    if (pendingAction) return
    setPendingAction('undo')
    setMessage(null)
    setError(null)
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    const result = await undoAssignmentObservationAction(formData)
    if (result.ok) {
      setMessage(`Undid ${result.type === 'pattern' ? 'tactical pattern' : 'event'} "${result.label}".`)
      router.refresh()
    } else {
      setError(result.reason)
    }
    setPendingAction(null)
  }

  const finishAssignment = async () => {
    if (!canFinish || pendingAction) return
    setPendingAction('finish')
    setMessage(null)
    setError(null)
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    const result = await finishAssignmentTrackingAction(formData)
    if (result.ok) {
      setMessage('Assignment submitted to the coaching team.')
      setConfirmFinish(false)
      router.refresh()
    } else {
      setError(result.reason)
    }
    setPendingAction(null)
  }

  return (
    <>
      {(message || error || blockedMessage) && (
        <p className={`rounded-xl border p-3 text-sm font-bold ${error || blockedMessage ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {error ?? blockedMessage ?? message}
        </p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="block text-sm font-bold text-slate-700" htmlFor="tracking-note">Optional note</label>
        <textarea
          id="tracking-note"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 280))}
          rows={2}
          maxLength={280}
          disabled={!canRecord || Boolean(pendingAction)}
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
          placeholder="Add context for the coach"
        />
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-extrabold text-slate-950">Events</h2>
            <div className="mt-3 grid gap-3">
              {events.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No event buttons in this assignment.</p> : events.map((event) => (
                <button key={event.id} type="button" onClick={() => recordEvent(event)} disabled={!canRecord || Boolean(pendingAction)} className="min-h-28 rounded-2xl border border-emerald-200 bg-emerald-700 p-4 text-left text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300">
                  <span className="block text-lg font-extrabold">{event.label}</span>
                  {event.identityLabel && <span className="mt-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-emerald-50">{event.identityLabel}</span>}
                  {event.standardDisplayName && <span className="mt-2 block text-sm font-semibold text-emerald-50">Standard: {event.standardDisplayName}</span>}
                  <span className="mt-2 block text-sm font-semibold text-emerald-50">{event.requiresLocation ? 'Tap to pick pitch location' : event.description ?? 'Tap to record event'}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-extrabold text-slate-950">Tactical patterns</h2>
            <div className="mt-3 grid gap-3">
              {patterns.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No tactical patterns in this assignment.</p> : patterns.map((pattern) => (
                <button key={pattern.id} type="button" onClick={() => { setPendingPattern(pattern); setSelectedOutcomeId(pattern.outcomes[0]?.id ?? ''); setPatternLocation(null); setMessage(null); setError(null) }} disabled={!canRecord || Boolean(pendingAction)} className="min-h-28 rounded-2xl border border-blue-200 bg-blue-700 p-4 text-left text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300">
                  <span className="block text-lg font-extrabold">{pattern.name}</span>
                  {pattern.identityLabel && <span className="mt-1 inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-blue-50">{pattern.identityLabel}</span>}
                  {pattern.standardDisplayName && <span className="mt-2 block text-sm font-semibold text-blue-50">Standard: {pattern.standardDisplayName}</span>}
                  <span className="mt-2 block text-sm font-semibold text-blue-50">{pattern.pendingCount} recorded pending · {pattern.requiresLocation ? 'Location required' : pattern.description ?? 'Tap to choose outcome'}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-slate-950">Recent observations</h2>
          <button type="button" onClick={() => router.refresh()} className="text-sm font-bold text-emerald-700 hover:underline">Refresh</button>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">{eventObservationCount + patternObservationCount} observations recorded · {eventObservationCount} events · {patternObservationCount} tactical patterns</p>
        <button type="button" onClick={undoObservation} disabled={Boolean(pendingAction) || observations.every((observation) => observation.status !== 'PENDING')} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400">Undo latest pending observation</button>
        {observations.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No observations recorded for this assignment yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {observations.map((observation) => (
              <article key={observation.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{observation.type === 'pattern' ? 'Tactical pattern' : 'Event'}</p>
                    <p className="font-bold text-slate-950">{observation.label}</p>
                    {observation.detail && <p className="mt-1 text-sm font-semibold text-slate-700">{observation.detail}</p>}
                    <p className="mt-1 text-sm text-slate-600">{observation.targetLabel} · {observation.matchTime}{observation.hasLocation ? ' · Location saved' : ''}</p>
                    {observation.note && <p className="mt-2 text-sm text-slate-700">{observation.note}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[observation.status]}`}>{observation.statusLabel}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <button type="button" onClick={() => setConfirmFinish(true)} disabled={!canFinish || Boolean(pendingAction)} className="w-full rounded-2xl bg-blue-700 px-5 py-4 text-base font-extrabold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
          Finish and submit assignment
        </button>
        <p className="mt-2 text-xs font-semibold text-slate-500">Submitted observations remain pending until coaches review them.</p>
      </section>

      <PitchLocationPicker isOpen={Boolean(pendingEvent)} onClose={() => setPendingEvent(null)} onSelect={(location) => pendingEvent ? recordEvent(pendingEvent, location) : undefined} />

      {confirmFinish && (
        <ModalShell title="Submit assignment?" description={`${eventObservationCount} events and ${patternObservationCount} tactical patterns. You will not be able to add or undo observations after submitting.`} onClose={() => setConfirmFinish(false)} maxWidthClassName="max-w-md">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={finishAssignment} disabled={Boolean(pendingAction)} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-slate-300">Submit assignment</button>
            <button type="button" onClick={() => setConfirmFinish(false)} disabled={Boolean(pendingAction)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Keep tracking</button>
          </div>
        </ModalShell>
      )}

      {pendingPattern && (
        <ModalShell title={pendingPattern.name} description="Record one overall tactical-pattern outcome. Steps are guidance, not a checklist." onClose={() => { setPendingPattern(null); setPickingPatternLocation(false) }} maxWidthClassName="max-w-lg">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">{pendingPattern.steps.map((step) => <li key={`${pendingPattern.id}-${step.order}`}>{step.label}</li>)}</ol>
          <fieldset className="mt-4" role="radiogroup" aria-label="Pattern outcome">
            <legend className="font-bold text-slate-950">What was the outcome?</legend>
            <div className="mt-2 grid gap-2">{pendingPattern.outcomes.map((outcome) => <label key={outcome.id} className={`rounded-xl border p-3 ${selectedOutcomeId === outcome.id ? 'border-blue-700 bg-blue-50' : 'border-slate-200'}`}><input className="mr-2" type="radio" name="patternOutcome" checked={selectedOutcomeId === outcome.id} onChange={() => setSelectedOutcomeId(outcome.id)} />{outcome.label}{outcome.positive !== null && <span className="ml-2 text-xs font-bold text-slate-500">{outcome.positive ? 'Positive' : 'Needs review'}</span>}</label>)}</div>
          </fieldset>
          {pendingPattern.requiresLocation && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Required location {patternLocation ? `selected (${Math.round(patternLocation.x)}, ${Math.round(patternLocation.y)})` : 'not selected yet'}.</p>}
          {pickingPatternLocation ? <PitchLocationPicker isOpen onClose={() => setPickingPatternLocation(false)} onSelect={(location) => { setPatternLocation(location); setPickingPatternLocation(false) }} /> : null}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => pendingPattern.requiresLocation && !patternLocation ? setPickingPatternLocation(true) : recordPattern()} disabled={Boolean(pendingAction)} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-slate-300">{pendingPattern.requiresLocation && !patternLocation ? 'Choose location' : 'Confirm pattern observation'}</button><button type="button" onClick={() => setPendingPattern(null)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">Cancel</button></div>
        </ModalShell>
      )}
    </>
  )
}
