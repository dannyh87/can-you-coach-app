'use client'

import { useEffect, useState } from 'react'

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
  players: TimerPlayer[]
  saveFinishAction: (formData: FormData) => Promise<void>
  undoFinishAction: (formData: FormData) => Promise<void>
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

export default function FitnessTimerClient({
  sessionId,
  players,
  saveFinishAction,
  undoFinishAction,
}: FitnessTimerClientProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [baseElapsed, setBaseElapsed] = useState(0)
  const [now, setNow] = useState(0)

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

  const startTimer = () => {
    if (isRunning) return

    const timestamp = Date.now()
    setStartedAt(timestamp)
    setNow(timestamp)
    setIsRunning(true)
  }

  const stopTimer = () => {
    if (!isRunning || startedAt === null) return

    const timestamp = Date.now()
    setBaseElapsed(baseElapsed + (timestamp - startedAt) / 1000)
    setStartedAt(null)
    setNow(timestamp)
    setIsRunning(false)
  }

  const resetTimer = () => {
    const timestamp = Date.now()
    setBaseElapsed(0)
    setStartedAt(isRunning ? timestamp : null)
    setNow(timestamp)
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
            disabled={isRunning}
          >
            Start
          </button>
          <button
            type="button"
            onClick={stopTimer}
            className="rounded bg-amber-500 px-4 py-3 font-medium text-gray-950 disabled:opacity-50"
            disabled={!isRunning}
          >
            Stop
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="rounded border border-white/30 px-4 py-3 font-medium text-white"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {players.map((player) => {
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
                    #{player.squadNumber} - {player.preferredPosition ?? 'No position'}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                  {formatSavedResult(player.result)}
                </span>
              </div>

              {hasResult ? (
                <form action={undoFinishAction}>
                  <input type="hidden" name="fitnessTestSessionId" value={sessionId} />
                  <input type="hidden" name="playerId" value={player.id} />
                  <button className="w-full rounded border border-red-300 bg-white px-4 py-3 font-medium text-red-700">
                    Undo / Reinstate
                  </button>
                </form>
              ) : (
                <form action={saveFinishAction}>
                  <input type="hidden" name="fitnessTestSessionId" value={sessionId} />
                  <input type="hidden" name="playerId" value={player.id} />
                  <input type="hidden" name="resultValue" value={roundedElapsed} />
                  <input type="hidden" name="resultText" value={formattedElapsed} />
                  <button className="w-full rounded bg-blue-700 px-4 py-3 font-medium text-white">
                    Record Finish at {formattedElapsed}
                  </button>
                </form>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
