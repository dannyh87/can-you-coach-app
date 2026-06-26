'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ReviewActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type ParentSubmissionReviewActionsProps = {
  matchDayId: string
  submittedMatchEventId: string
  matchStatus: 'DRAFT' | 'IN_PROGRESS' | 'HALF_TIME' | 'COMPLETED'
  acceptParentSubmissionAction: (formData: FormData) => Promise<ReviewActionResult>
  ignoreParentSubmissionAction: (formData: FormData) => Promise<ReviewActionResult>
}

type ConfirmingAction = 'accept' | 'ignore' | null

export default function ParentSubmissionReviewActions({
  matchDayId,
  submittedMatchEventId,
  matchStatus,
  acceptParentSubmissionAction,
  ignoreParentSubmissionAction,
}: ParentSubmissionReviewActionsProps) {
  const router = useRouter()
  const [confirmingAction, setConfirmingAction] = useState<ConfirmingAction>(null)
  const [pendingAction, setPendingAction] = useState<ConfirmingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const isCompletedMatch = matchStatus === 'COMPLETED'
  const isBusy = pendingAction !== null

  const runReviewAction = async (action: Exclude<ConfirmingAction, null>) => {
    setPendingAction(action)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('submittedMatchEventId', submittedMatchEventId)

    const result = action === 'accept'
      ? await acceptParentSubmissionAction(formData)
      : await ignoreParentSubmissionAction(formData)

    if (result.ok) {
      setConfirmingAction(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-sm font-semibold text-blue-950">
        Accepted submissions become official match events and will be included in reports.
      </p>

      {error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {confirmingAction === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirmingAction('accept')}
            disabled={isBusy}
            className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Accept as official event
          </button>
          <button
            type="button"
            onClick={() => setConfirmingAction('ignore')}
            disabled={isBusy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Ignore
          </button>
        </div>
      )}

      {confirmingAction === 'accept' && (
        <div className="mt-3 rounded-lg border border-green-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-950">
            Accept this parent submission as an official match event? It will be included in reports and CSV.
          </p>
          {isCompletedMatch && (
            <p className="mt-2 text-sm font-semibold text-amber-800">
              This match is completed, so accepting will update the completed match report totals.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmingAction(null)}
              disabled={isBusy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => runReviewAction('accept')}
              disabled={isBusy}
              className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pendingAction === 'accept' ? 'Accepting...' : 'Confirm accept'}
            </button>
          </div>
        </div>
      )}

      {confirmingAction === 'ignore' && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-950">
            Ignore this parent submission? It will not be included in official reports.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirmingAction(null)}
              disabled={isBusy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => runReviewAction('ignore')}
              disabled={isBusy}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {pendingAction === 'ignore' ? 'Ignoring...' : 'Confirm ignore'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
