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
  testTypeName: string
  teamName: string
  dateLabel: string
  sessionStatusLabel: string
  resultUnit: string
  higherIsBetter: boolean
  targetScores?: string | null
  rankingsHref: string
  progressHref: string
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

const hasRecordedResult = (player: TimerPlayer) => player.result !== null
const formatPlayerName = (player: TimerPlayer) => `${player.firstName} ${player.surname}`

export default function FitnessTimerClient(props: FitnessTimerClientProps) {
  return <FitnessTimerInner key={props.sessionId} {...props} />
}

function FitnessTimerInner({
  sessionId,
  testTypeName,
  teamName,
  dateLabel,
  sessionStatusLabel,
  resultUnit,
  higherIsBetter,
  targetScores,
  rankingsHref,
  progressHref,
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
  const activePlayers = timerPlayers.filter((player) => !hasRecordedResult(player))
  const completedPlayers = timerPlayers.filter(hasRecordedResult)
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
    <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-6">
      {!isSessionCompleted && (
        <section className="sticky top-16 z-20 rounded-xl border bg-gray-950/95 p-3 text-white shadow-sm backdrop-blur sm:static sm:p-6 sm:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-300">Elapsed</p>
              <div className="text-4xl font-black tabular-nums sm:text-6xl">{formattedElapsed}</div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
              {isRunning ? 'Running' : isSessionLive ? 'Paused' : 'Ready'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
            <button
              type="button"
              onClick={startTimer}
              className="min-h-11 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              disabled={isRunning || isStarting}
            >
              {isStarting ? 'Starting...' : 'Start'}
            </button>
            <button
              type="button"
              onClick={stopTimer}
              className="min-h-11 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-gray-950 disabled:opacity-50"
              disabled={!isRunning}
            >
              Stop
            </button>
            <button
              type="button"
              onClick={resetTimer}
              className="min-h-11 rounded-lg border border-white/30 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Reset
            </button>
          </div>

          {isSessionLive && (
            <button
              type="button"
              onClick={endFitnessTest}
              className="mt-3 w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-50"
              disabled={isEnding}
            >
              {isEnding ? 'Ending...' : 'Finish test'}
            </button>
          )}
          {!isSessionLive && (
            <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-950">
              Start the fitness test before recording finish times.
            </p>
          )}
          {isSessionLive && (
            <p className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-950">
              LIVE{startedAtText ? `: started ${startedAtText}` : ''}
            </p>
          )}
        </section>
      )}

      {!isSessionCompleted && message && (
        <p className="min-h-10 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
          {message}
        </p>
      )}

      {!isSessionCompleted && isSessionLive && allPlayersFinished && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          All active players have finish times. Finish test to complete and lock this session.
        </p>
      )}

      {isSessionCompleted && (
        <FitnessTestCompleteSummary
          title="Test Complete"
          description="This session is closed. Results are read-only."
          testTypeName={testTypeName}
          teamName={teamName}
          dateLabel={dateLabel}
          sessionStatusLabel={isSessionCompleted ? 'Completed' : sessionStatusLabel}
          startedAtLabel={startedAtText ?? 'Not started'}
          completedAtLabel={completedAtText ?? 'Not completed'}
          resultCount={completedPlayers.length}
          players={timerPlayers}
          resultUnit={resultUnit}
          higherIsBetter={higherIsBetter}
          targetScores={targetScores}
          statusLabel="Completed"
          rankingsHref={rankingsHref}
          progressHref={progressHref}
        />
      )}

      {!isSessionCompleted && (
        <section className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-blue-200 bg-white">
            <div className="flex items-center justify-between bg-blue-50 px-3 py-2">
              <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">Active players</h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-900">{activePlayers.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {activePlayers.length === 0 ? (
                <p className="px-3 py-3 text-sm font-semibold text-slate-600">No active players remaining.</p>
              ) : activePlayers.map((player) => (
                <div key={player.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-base font-black text-slate-950">{formatPlayerName(player)}</p>
                  <button
                    type="button"
                    onClick={() => recordFinish(player.id)}
                    className="min-h-11 shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSessionCompleted ||
                      !isSessionLive ||
                      !canRecordFinish ||
                      pendingPlayerId === player.id
                    }
                    aria-label={`Record finish for ${formatPlayerName(player)} at ${formattedElapsed}`}
                  >
                    {pendingPlayerId === player.id ? 'Saving...' : canRecordFinish ? 'Finish' : 'Start'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm font-black text-slate-900">
              <span>Finished</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs">{completedPlayers.length}</span>
            </summary>
            <div className="divide-y divide-slate-200 border-t border-slate-200 bg-white">
              {completedPlayers.length === 0 ? (
                <p className="px-3 py-3 text-sm font-semibold text-slate-600">No finish times yet.</p>
              ) : completedPlayers.map((player) => (
                <div key={player.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{formatPlayerName(player)}</p>
                    <p className="text-xs font-semibold text-slate-500">{formatSavedResult(player.result)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => undoFinish(player.id)}
                    className="min-h-11 shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSessionCompleted || !isSessionLive || pendingPlayerId === player.id}
                    aria-label={`Undo finish for ${formatPlayerName(player)}`}
                  >
                    {pendingPlayerId === player.id ? 'Saving...' : 'Undo'}
                  </button>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
