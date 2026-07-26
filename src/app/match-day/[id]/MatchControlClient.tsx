'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

type MatchStatus = 'DRAFT' | 'IN_PROGRESS' | 'HALF_TIME' | 'COMPLETED'
type MatchVenue = 'HOME' | 'AWAY' | 'NEUTRAL'

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type MatchControlClientProps = {
  matchDayId: string
  teamName: string
  opposition: string
  venue: MatchVenue
  status: MatchStatus
  ownScore: number
  oppositionScore: number
  firstHalfStartedAt: string | null
  firstHalfEndedAt: string | null
  secondHalfStartedAt: string | null
  secondHalfEndedAt: string | null
  completedAt: string | null
  startMatchAction: (formData: FormData) => Promise<MatchActionResult>
  endFirstHalfAction: (formData: FormData) => Promise<MatchActionResult>
  startSecondHalfAction: (formData: FormData) => Promise<MatchActionResult>
  completeMatchAction: (formData: FormData) => Promise<MatchActionResult>
  updateMatchScoreAction: (formData: FormData) => Promise<MatchActionResult>
  liveDetailsControl?: ReactNode
}

const formatDuration = (milliseconds: number | null) => {
  if (milliseconds === null || milliseconds < 0) return 'Not recorded'

  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getCurrentHalfLabel = ({
  status,
  firstHalfStartedAt,
  firstHalfEndedAt,
  secondHalfStartedAt,
}: {
  status: MatchStatus
  firstHalfStartedAt: string | null
  firstHalfEndedAt: string | null
  secondHalfStartedAt: string | null
}) => {
  if (status === 'DRAFT') return 'Not started'
  if (status === 'COMPLETED') return 'Full time'
  if (status === 'HALF_TIME') return 'Half time'
  if (secondHalfStartedAt) return 'Second half'
  if (firstHalfStartedAt && !firstHalfEndedAt) return 'First half'
  return 'In progress'
}

export default function MatchControlClient({
  matchDayId,
  venue,
  status,
  ownScore,
  oppositionScore,
  firstHalfStartedAt,
  firstHalfEndedAt,
  secondHalfStartedAt,
  secondHalfEndedAt,
  completedAt,
  startMatchAction,
  endFirstHalfAction,
  startSecondHalfAction,
  completeMatchAction,
  updateMatchScoreAction,
  liveDetailsControl,
}: MatchControlClientProps) {
  const router = useRouter()
  const [now, setNow] = useState(0)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isCompleted = status === 'COMPLETED'
  const canUpdateScore = status === 'IN_PROGRESS'
  const isFirstHalfActive =
    status === 'IN_PROGRESS' && Boolean(firstHalfStartedAt) && !firstHalfEndedAt
  const isSecondHalfActive =
    status === 'IN_PROGRESS' && Boolean(secondHalfStartedAt) && !secondHalfEndedAt
  const activeHalfStartedAt = isFirstHalfActive
    ? firstHalfStartedAt
    : isSecondHalfActive
      ? secondHalfStartedAt
      : null
  const currentElapsed = activeHalfStartedAt
    ? now === 0
      ? 0
      : now - new Date(activeHalfStartedAt).getTime()
    : null
  const currentHalfLabel = getCurrentHalfLabel({
    status,
    firstHalfStartedAt,
    firstHalfEndedAt,
    secondHalfStartedAt,
  })
  const homeScore = venue === 'AWAY' ? oppositionScore : ownScore
  const awayScore = venue === 'AWAY' ? ownScore : oppositionScore
  useEffect(() => {
    if (!activeHalfStartedAt) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [activeHalfStartedAt])

  const runLifecycleAction = async ({
    label,
    action,
  }: {
    label: string
    action: (formData: FormData) => Promise<MatchActionResult>
  }) => {
    if (pendingAction || isCompleted) return

    setPendingAction(label)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)

    const result = await action(formData)

    if (result.ok) {
      setMessage(label === 'Full time' ? 'Match completed.' : `${label} saved.`)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  const updateScore = async ({
    nextOwnScore,
    nextOppositionScore,
  }: {
    nextOwnScore: number
    nextOppositionScore: number
  }) => {
    if (pendingAction || isCompleted || !canUpdateScore) return
    if (nextOwnScore < 0 || nextOppositionScore < 0) return

    setPendingAction('score')
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('ownScore', String(nextOwnScore))
    formData.set('oppositionScore', String(nextOppositionScore))

    const result = await updateMatchScoreAction(formData)

    if (result.ok) {
      setMessage('Score updated.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  const lifecycleButton = (() => {
    if (status === 'DRAFT') {
      return { label: 'Start match', action: startMatchAction }
    }
    if (isFirstHalfActive) {
      return { label: 'Half time', action: endFirstHalfAction }
    }
    if (status === 'HALF_TIME') {
      return { label: 'Start second half', action: startSecondHalfAction }
    }
    if (isSecondHalfActive) {
      return { label: 'Full time', action: completeMatchAction }
    }
    return null
  })()

  if (status === 'DRAFT') {
    return (
      <section className="mt-6 rounded-2xl bg-gray-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Ready to start?</h2>
            <p className="mt-1 text-sm text-gray-500">
              Check the squad and event setup, then start the match when kick-off begins.
            </p>
          </div>
          {lifecycleButton && (
            <button
              type="button"
              onClick={() => runLifecycleAction(lifecycleButton)}
              className="w-full rounded-lg bg-green-700 px-5 py-4 text-lg font-bold text-white disabled:opacity-50 sm:w-auto"
              disabled={Boolean(pendingAction)}
            >
              {pendingAction === lifecycleButton.label ? 'Starting...' : lifecycleButton.label}
            </button>
          )}
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
      </section>
    )
  }

  return (
    <section className="mt-2 space-y-2 rounded-xl bg-gray-50 p-2 shadow-sm sm:mt-4 sm:p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CompactStat label="Score" value={`${homeScore}-${awayScore}`} strong />
        <CompactStat label="Timer" value={formatDuration(currentElapsed)} strong />
        <CompactStat label="Period" value={currentHalfLabel} />
        <div className="grid gap-2">
          {lifecycleButton && !isCompleted && (
            <button
              type="button"
              onClick={() => runLifecycleAction(lifecycleButton)}
              className="min-h-11 rounded-lg bg-green-700 px-2 py-2 text-sm font-black leading-tight text-white disabled:opacity-50"
              disabled={Boolean(pendingAction)}
            >
              {pendingAction === lifecycleButton.label ? 'Saving...' : lifecycleButton.label}
            </button>
          )}
          {liveDetailsControl}
        </div>
      </div>

      {completedAt && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          Match completed.
        </p>
      )}

      {message && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {!isCompleted && status !== 'HALF_TIME' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GoalButton
            label="Our goal"
            disabled={Boolean(pendingAction) || !canUpdateScore}
            onClick={() =>
              updateScore({
                nextOwnScore: ownScore + 1,
                nextOppositionScore: oppositionScore,
              })
            }
          />
          <GoalButton
            label="Opp goal"
            disabled={Boolean(pendingAction) || !canUpdateScore}
            onClick={() =>
              updateScore({
                nextOwnScore: ownScore,
                nextOppositionScore: oppositionScore + 1,
              })
            }
          />
          <UndoGoalButton
            label="Undo ours"
            disabled={Boolean(pendingAction) || !canUpdateScore || ownScore <= 0}
            onClick={() =>
              updateScore({
                nextOwnScore: ownScore - 1,
                nextOppositionScore: oppositionScore,
              })
            }
          />
          <UndoGoalButton
            label="Undo opp"
            disabled={Boolean(pendingAction) || !canUpdateScore || oppositionScore <= 0}
            onClick={() =>
              updateScore({
                nextOwnScore: ownScore,
                nextOppositionScore: oppositionScore - 1,
              })
            }
          />
        </div>
      )}

      {isCompleted && (
        <p className="rounded-lg border p-4 text-sm text-gray-500">
          Match completed. Score, timers and lifecycle controls are read-only.
        </p>
      )}
    </section>
  )
}

function CompactStat({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg bg-white p-2 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 break-words font-black tabular-nums leading-tight ${strong ? 'text-2xl' : 'text-sm'}`}>
        {value}
      </p>
    </div>
  )
}

function GoalButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-green-700 px-3 py-3 text-sm font-extrabold text-white disabled:opacity-50 sm:px-4 sm:py-4 sm:text-base"
      disabled={disabled}
    >
      {label}
    </button>
  )
}

function UndoGoalButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-white px-3 py-2.5 text-xs font-semibold text-red-700 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
      disabled={disabled}
    >
      {label}
    </button>
  )
}
