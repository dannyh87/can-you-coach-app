'use client'

import { useEffect, useState } from 'react'

import FitnessTestCompleteSummary from '@/components/FitnessTestCompleteSummary'

type TimerPlayer = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  preferredPosition: string | null
  result: {
    resultValue: number | null
    resultText: string | null
  } | null
}

type FitnessTimerClientProps = {
  sessionId: string
  resultUnit: string
  higherIsBetter: boolean
  rankingsHref: string
  isLive: boolean
  isCompleted: boolean
  startedAt: string | null
  completedAt: string | null
  players: TimerPlayer[]
  startSessionAction: (formData: FormData) =>
    Promise<
      | { ok: true; startedAt: string }
      | { ok: false; reason: string }
      | undefined
    >
  endSessionAction: (formData: FormData) =>
    Promise<
      | { ok: true; completedAt: string }
      | { ok: false; reason: string }
      | undefined
    >
  saveFinishAction: (formData: FormData) => Promise<
    | {
        ok: true
        playerId: string
        resultValue: number
        resultText: string | null
      }
    | { ok: false }
    | undefined
  >
  undoFinishAction: (formData: FormData) =>
    Promise<{ ok: true; playerId: string } | { ok: false } | undefined>
}

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds - minutes * 60
  const paddedSeconds = remainingSeconds.toFixed(1).padStart(4, '0')

  return `${minutes}:${paddedSeconds}`
}

const formatSavedResult = (result: TimerPlayer['result']) => {
  if (!result) return 'Unfinished'
  if (result.resultText) return result.resultText
  if (result.resultValue !== null) return formatElapsed(result.resultValue)
  return 'Finished'
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

export default function FitnessTimerClient({
  sessionId,
  resultUnit,
  higherIsBetter,
  rankingsHref,
  isLive,
  isCompleted,
  startedAt: persistedStartedAt,
  completedAt,
  players,
  startSessionAction,
  endSessionAction,
  saveFinishAction,
  undoFinishAction,
}: FitnessTimerClientProps) {
  const [timerPlayers, setTimerPlayers] = useState(players)
  const [isRunning, setIsRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [baseElapsed, setBaseElapsed] = useState(0)
  const [now, setNow] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [localStartedAtText, setLocalStartedAtText] = useState<string | null>(null)
  const [localCompletedAt, setLocalCompletedAt] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const isSessionCompleted = isCompleted || Boolean(localCompletedAt)
  const isSessionLive = !isSessionCompleted && (isLive || Boolean(localStartedAtText))
  const startedAtText =
    localStartedAtText ??
    (persistedStartedAt
      ? new Intl.DateTimeFormat('en-GB', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(persistedStartedAt))
      : null)
  const effectiveCompletedAt = localCompletedAt ?? completedAt
  const completedAtText = effectiveCompletedAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(effectiveCompletedAt))
    : null

  useEffect(() => {
    if (!isRunning) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 100)

    return () => window.clearInterval(interval)
  }, [isRunning])

  const elapsedSeconds =
    isRunning && startedAt !== null
      ? baseElapsed + (now - startedAt) / 1000
      : baseElapsed
  const roundedElapsed = Math.round(elapsedSeconds * 10) / 10
  const formattedElapsed = formatElapsed(roundedElapsed)
  const canRecordFinish = roundedElapsed > 0
  const completedPlayers = timerPlayers.filter((player) => player.result)
  const allPlayersFinished =
    timerPlayers.length > 0 && completedPlayers.length === timerPlayers.length

  const startTimer = async () => {
    if (isSessionCompleted || isRunning || isStarting) return

    if (!isSessionLive) {
      setIsStarting(true)
      setMessage(null)

      const formData = new FormData()
      formData.set('fitnessTestSessionId', sessionId)
      formData.set('mode', 'liveTimedFinish')

      const result = await startSessionAction(formData)

      if (!result?.ok) {
        setMessage(result?.reason ?? 'Fitness test could not be started. Try again.')
        setIsStarting(false)
        return
      }

      setLocalStartedAtText(
        new Intl.DateTimeFormat('en-GB', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(result.startedAt))
      )
      setMessage('Fitness test started.')
      setIsStarting(false)
    }

    const timestamp = Date.now()
    setStartedAt(timestamp)
    setNow(timestamp)
    setIsRunning(true)
  }

  const stopTimer = () => {
    if (isSessionCompleted || !isRunning || startedAt === null) return

    const timestamp = Date.now()
    setBaseElapsed(baseElapsed + (timestamp - startedAt) / 1000)
    setStartedAt(null)
    setNow(timestamp)
    setIsRunning(false)
  }

  const stopTimerAtElapsed = (elapsed: number) => {
    if (!isRunning) return

    setBaseElapsed(elapsed)
    setStartedAt(null)
    setNow(0)
    setIsRunning(false)
  }

  const resetTimer = () => {
    if (isSessionCompleted) return

    const timestamp = Date.now()
    setBaseElapsed(0)
    setStartedAt(isRunning ? timestamp : null)
    setNow(timestamp)
  }

  const recordFinish = async (playerId: string) => {
    if (!isSessionLive || isSessionCompleted || !canRecordFinish || pendingPlayerId) return

    setPendingPlayerId(playerId)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('playerId', playerId)
    formData.set('resultValue', String(roundedElapsed))
    formData.set('resultText', formattedElapsed)

    const result = await saveFinishAction(formData)

    if (result?.ok) {
      const nextPlayers = timerPlayers.map((player) =>
        player.id === result.playerId
          ? {
              ...player,
              result: {
                resultValue: result.resultValue,
                resultText: result.resultText,
              },
            }
          : player
      )

      setTimerPlayers(nextPlayers)
      setMessage('Finish recorded.')

      if (nextPlayers.every((player) => player.result)) {
        stopTimerAtElapsed(roundedElapsed)
      }
    } else {
      setMessage('Finish could not be recorded. Try again.')
    }

    setPendingPlayerId(null)
  }

  const undoFinish = async (playerId: string) => {
    if (!isSessionLive || isSessionCompleted || pendingPlayerId) return

    setPendingPlayerId(playerId)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('playerId', playerId)

    const result = await undoFinishAction(formData)

    if (result?.ok) {
      setTimerPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === result.playerId ? { ...player, result: null } : player
        )
      )
      setMessage('Player reinstated.')
    } else {
      setMessage('Player could not be reinstated. Try again.')
    }

    setPendingPlayerId(null)
  }

  const endFitnessTest = async () => {
    if (!isSessionLive || isSessionCompleted || isEnding) return

    setIsEnding(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)

    const result = await endSessionAction(formData)

    if (result?.ok) {
      setLocalCompletedAt(result.completedAt)
      setStartedAt(null)
      setNow(0)
      setIsRunning(false)
      setMessage('Fitness test completed. Results are now read-only.')
    } else {
      setMessage(result?.reason ?? 'Fitness test could not be completed. Try again.')
    }

    setIsEnding(false)
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border bg-gray-950 p-6 text-white">
        <p className="text-sm uppercase tracking-wide text-gray-300">Elapsed time</p>
        <div className="mt-3 text-6xl font-bold tabular-nums">{formattedElapsed}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={startTimer}
            className="rounded bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-50"
            disabled={isSessionCompleted || isRunning || isStarting}
          >
            {isSessionCompleted
              ? 'Results locked'
              : isStarting
              ? 'Starting...'
              : isSessionLive
                ? 'Start Timer'
                : 'Start Fitness Test'}
          </button>
          <button
            type="button"
            onClick={stopTimer}
            className="rounded bg-amber-500 px-4 py-3 font-medium text-gray-950 disabled:opacity-50"
            disabled={isSessionCompleted || !isRunning}
          >
            Stop
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="rounded border border-white/30 px-4 py-3 font-medium text-white disabled:opacity-50"
            disabled={isSessionCompleted}
          >
            Reset
          </button>
        </div>

        {isSessionLive && (
          <button
            type="button"
            onClick={endFitnessTest}
            className="mt-3 w-full rounded bg-red-700 px-4 py-3 font-medium text-white disabled:opacity-50"
            disabled={isEnding}
          >
            {isEnding ? 'Ending...' : 'End Fitness Test'}
          </button>
        )}
        <p className="mt-4 text-sm text-gray-300">
          Resetting the timer does not delete already saved player finish results.
          Use Undo / Reinstate on a player card to remove a saved finish.
        </p>
        {isSessionCompleted ? (
          <p className="mt-3 rounded-lg bg-green-100 p-3 text-sm font-medium text-green-950">
            Completed{completedAtText ? `: ${completedAtText}` : ''}. Results are read-only.
          </p>
        ) : !isSessionLive && (
          <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-950">
            Start the fitness test before recording finish times.
          </p>
        )}
        {isSessionLive && (
          <p className="mt-3 rounded-lg bg-green-100 p-3 text-sm font-medium text-green-950">
            LIVE{startedAtText ? `: started ${startedAtText}` : ''}
          </p>
        )}
      </section>

      {message && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      {(allPlayersFinished || isSessionCompleted) && (
        <FitnessTestCompleteSummary
          title={isSessionCompleted ? 'Completed Results Summary' : 'Test Complete'}
          description={
            isSessionCompleted
              ? 'This test is completed and locked. Saved finish results remain available.'
              : 'All active players have recorded finish times.'
          }
          players={timerPlayers}
          resultUnit={resultUnit}
          higherIsBetter={higherIsBetter}
          statusLabel="Completed"
          rankingsHref={rankingsHref}
        />
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {timerPlayers.map((player) => {
          const hasResult = Boolean(player.result)

          return (
            <article
              key={player.id}
              className={`rounded-lg border p-4 ${
                hasResult ? 'border-gray-200 bg-gray-50' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">
                    {player.firstName} {player.surname}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {formatSquadNumber(player.squadNumber)} -{' '}
                    {player.preferredPosition ?? 'No position'}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                  {formatSavedResult(player.result)}
                </span>
              </div>

              {hasResult ? (
                <button
                  type="button"
                  onClick={() => undoFinish(player.id)}
                  className="w-full rounded border border-red-300 bg-white px-4 py-3 font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSessionCompleted || !isSessionLive || pendingPlayerId === player.id}
                >
                  {isSessionCompleted
                    ? 'Results locked'
                    : pendingPlayerId === player.id
                      ? 'Saving...'
                      : 'Undo / Reinstate'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => recordFinish(player.id)}
                  className="w-full rounded bg-blue-700 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSessionCompleted || !isSessionLive || !canRecordFinish || pendingPlayerId === player.id}
                >
                  {isSessionCompleted
                    ? 'Results locked'
                    : !isSessionLive
                    ? 'Start test first'
                    : pendingPlayerId === player.id
                    ? 'Saving...'
                    : canRecordFinish
                      ? `Record Finish at ${formattedElapsed}`
                      : 'Start timer first'}
                </button>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
