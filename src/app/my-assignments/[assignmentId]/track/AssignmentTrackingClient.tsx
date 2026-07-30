'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import PitchLocationPicker, { type PitchLocation } from '@/components/PitchLocationPicker'
import ModalShell from '@/components/ui/ModalShell'

type ActionResult = { ok: true } | { ok: false; reason: string }

type TrackingEvent = {
  id: string
  label: string
  description: string | null
  requiresLocation: boolean
}

type RecentObservation = {
  id: string
  label: string
  targetLabel: string
  matchTime: string
  statusLabel: string
  status: 'PENDING' | 'ACCEPTED' | 'IGNORED'
  note: string | null
}

type AssignmentTrackingClientProps = {
  assignmentId: string
  matchDayId: string
  playerId: string | null
  canRecord: boolean
  canFinish: boolean
  blockedMessage: string | null
  events: TrackingEvent[]
  observations: RecentObservation[]
  recordAssignmentObservationAction: (formData: FormData) => Promise<ActionResult>
  undoAssignmentObservationAction: (formData: FormData) => Promise<ActionResult>
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
  observations,
  recordAssignmentObservationAction,
  undoAssignmentObservationAction,
  finishAssignmentTrackingAction,
}: AssignmentTrackingClientProps) {
  const router = useRouter()
  const [pendingEvent, setPendingEvent] = useState<TrackingEvent | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)

  const buildFormData = (event: TrackingEvent, location?: PitchLocation) => {
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    formData.set('matchDayId', matchDayId)
    formData.set('matchDayEventTypeId', event.id)
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
    const result = await recordAssignmentObservationAction(buildFormData(event, location))
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

  const undoObservation = async (observationId: string) => {
    if (pendingAction) return
    setPendingAction(observationId)
    setMessage(null)
    setError(null)
    const formData = new FormData()
    formData.set('assignmentId', assignmentId)
    formData.set('submittedEventId', observationId)
    const result = await undoAssignmentObservationAction(formData)
    if (result.ok) {
      setMessage('Pending observation removed.')
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => recordEvent(event)}
              disabled={!canRecord || Boolean(pendingAction)}
              className="min-h-28 rounded-2xl border border-emerald-200 bg-emerald-700 p-4 text-left text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300"
            >
              <span className="block text-lg font-extrabold">{event.label}</span>
              <span className="mt-2 block text-sm font-semibold text-emerald-50">{event.requiresLocation ? 'Tap to pick pitch location' : event.description ?? 'Tap to record'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-slate-950">Recent observations</h2>
          <button type="button" onClick={() => router.refresh()} className="text-sm font-bold text-emerald-700 hover:underline">Refresh</button>
        </div>
        {observations.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No observations recorded for this assignment yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {observations.map((observation) => (
              <article key={observation.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{observation.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{observation.targetLabel} · {observation.matchTime}</p>
                    {observation.note && <p className="mt-2 text-sm text-slate-700">{observation.note}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[observation.status]}`}>{observation.statusLabel}</span>
                </div>
                {observation.status === 'PENDING' && (
                  <button type="button" onClick={() => undoObservation(observation.id)} disabled={Boolean(pendingAction)} className="mt-3 text-sm font-bold text-red-700 hover:underline disabled:text-slate-400">
                    Undo pending observation
                  </button>
                )}
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
        <ModalShell title="Submit assignment?" description="You will not be able to add more observations after submitting." onClose={() => setConfirmFinish(false)} maxWidthClassName="max-w-md">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={finishAssignment} disabled={Boolean(pendingAction)} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:bg-slate-300">Submit assignment</button>
            <button type="button" onClick={() => setConfirmFinish(false)} disabled={Boolean(pendingAction)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Keep tracking</button>
          </div>
        </ModalShell>
      )}
    </>
  )
}
