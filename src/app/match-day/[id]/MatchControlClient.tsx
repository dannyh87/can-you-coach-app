'use client'

import { useRouter } from 'next/navigation'
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
}

const formatDuration = (milliseconds: number | null) => {
  if (milliseconds === null || milliseconds < 0) return 'Not recorded'

  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const getTimeDifference = (start: string | null, end: string | null) => {
  if (!start || !end) return null
  return new Date(end).getTime() - new Date(start).getTime()
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
  teamName,
  opposition,
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
}: MatchControlClientProps) {
  const router = useRouter()
  const [now, setNow] = useState(0)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isCompleted = status === 'COMPLETED'
  const canUpdateScore = status === 'IN_PROGRESS' || status === 'HALF_TIME'
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
  const firstHalfDuration = firstHalfEndedAt
    ? getTimeDifference(firstHalfStartedAt, firstHalfEndedAt)
    : null
  const secondHalfDuration = secondHalfEndedAt
    ? getTimeDifference(secondHalfStartedAt, secondHalfEndedAt)
    : null
  const currentHalfLabel = getCurrentHalfLabel({
    status,
    firstHalfStartedAt,
    firstHalfEndedAt,
    secondHalfStartedAt,
  })
  const homeLabel = venue === 'AWAY' ? opposition : teamName
  const awayLabel = venue === 'AWAY' ? teamName : opposition
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
    if (pendingAction || isCompleted || !canUpdateScore) return

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
    if (pendingAction || isCompleted) return
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

  return (
    <section className="mt-6 space-y-5 rounded-xl border bg-gray-50 p-5">
      <div className="rounded-lg border bg-white p-5 text-center">
        <p className="text-sm font-medium text-gray-500">Score</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="text-lg font-bold">{homeLabel}</p>
          <p className="text-5xl font-bold tabular-nums">
            {homeScore}-{awayScore}
          </p>
          <p className="text-lg font-bold">{awayLabel}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <TimerCard label="Current half" value={currentHalfLabel} />
        <TimerCard label="Elapsed time" value={formatDuration(currentElapsed)} />
        <TimerCard label="First half duration" value={formatDuration(firstHalfDuration)} />
        <TimerCard label="Second half duration" value={formatDuration(secondHalfDuration)} />
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

      {!isCompleted && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h2 className="text-lg font-bold">Match lifecycle</h2>
            <p className="mt-1 text-sm text-gray-500">
              Move through first half, half-time, second half and full-time.
            </p>
            {lifecycleButton ? (
              <button
                type="button"
                onClick={() => runLifecycleAction(lifecycleButton)}
                className="mt-4 w-full rounded bg-green-700 px-4 py-3 font-medium text-white disabled:opacity-50"
                disabled={Boolean(pendingAction)}
              >
                {pendingAction === lifecycleButton.label
                  ? 'Saving...'
                  : lifecycleButton.label}
              </button>
            ) : (
              <p className="mt-4 rounded-lg border p-3 text-sm text-gray-500">
                No lifecycle action is available for this state.
              </p>
            )}
          </div>

          {canUpdateScore && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="text-lg font-bold">Score controls</h2>
              <p className="mt-1 text-sm text-gray-500">
                Correct the score during live play or half-time.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <ScoreButton
                  label={`${teamName} +1`}
                  disabled={Boolean(pendingAction)}
                  onClick={() =>
                    updateScore({
                      nextOwnScore: ownScore + 1,
                      nextOppositionScore: oppositionScore,
                    })
                  }
                />
                <ScoreButton
                  label={`${opposition} +1`}
                  disabled={Boolean(pendingAction)}
                  onClick={() =>
                    updateScore({
                      nextOwnScore: ownScore,
                      nextOppositionScore: oppositionScore + 1,
                    })
                  }
                />
                <ScoreButton
                  label={`${teamName} -1`}
                  disabled={Boolean(pendingAction) || ownScore <= 0}
                  onClick={() =>
                    updateScore({
                      nextOwnScore: ownScore - 1,
                      nextOppositionScore: oppositionScore,
                    })
                  }
                />
                <ScoreButton
                  label={`${opposition} -1`}
                  disabled={Boolean(pendingAction) || oppositionScore <= 0}
                  onClick={() =>
                    updateScore({
                      nextOwnScore: ownScore,
                      nextOppositionScore: oppositionScore - 1,
                    })
                  }
                />
              </div>
            </div>
          )}
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

function TimerCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function ScoreButton({
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
      className="rounded-lg border px-4 py-3 text-sm font-semibold disabled:opacity-50"
      disabled={disabled}
    >
      {label}
    </button>
  )
}
