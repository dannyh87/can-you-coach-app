'use client'

import { useRef, useState } from 'react'

import FitnessTestCompleteSummary from '@/components/FitnessTestCompleteSummary'

type DropoutPlayer = {
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

type FitnessLiveDropoutClientProps = {
  sessionId: string
  resultUnit: string
  higherIsBetter: boolean
  rankingsHref: string
  isLive: boolean
  isCompleted: boolean
  startedAt: string | null
  completedAt: string | null
  players: DropoutPlayer[]
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
  saveDropoutAction: (formData: FormData) => Promise<
    | {
        ok: true
        playerId: string
        resultValue: number | null
        resultText: string | null
      }
    | { ok: false }
    | undefined
  >
  undoDropoutAction: (formData: FormData) =>
    Promise<{ ok: true; playerId: string } | { ok: false } | undefined>
}

const formatResult = (result: DropoutPlayer['result']) => {
  if (!result) return 'Still in'
  if (result.resultText) return result.resultText
  if (result.resultValue !== null) return String(result.resultValue)
  return 'Recorded'
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

export default function FitnessLiveDropoutClient(
  props: FitnessLiveDropoutClientProps
) {
  return <FitnessLiveDropoutInner key={props.sessionId} {...props} />
}

function FitnessLiveDropoutInner({
  sessionId,
  resultUnit,
  higherIsBetter,
  rankingsHref,
  isLive,
  isCompleted,
  startedAt,
  completedAt,
  players,
  startSessionAction,
  endSessionAction,
  saveDropoutAction,
  undoDropoutAction,
}: FitnessLiveDropoutClientProps) {
  const [dropoutPlayers, setDropoutPlayers] = useState(players)
  const [localStartedAt, setLocalStartedAt] = useState<string | null>(null)
  const [localCompletedAt, setLocalCompletedAt] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [currentResult, setCurrentResult] = useState({
    value: '1',
    text: 'Level 1',
  })
  const currentResultRef = useRef(currentResult)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const completedPlayers = dropoutPlayers.filter((player) => player.result)
  const allPlayersFinished =
    dropoutPlayers.length > 0 && completedPlayers.length === dropoutPlayers.length
  const isSessionCompleted = isCompleted || Boolean(localCompletedAt)
  const isSessionLive = !isSessionCompleted && (isLive || Boolean(localStartedAt))
  const effectiveStartedAt = localStartedAt ?? startedAt
  const effectiveCompletedAt = localCompletedAt ?? completedAt

  const setSharedCurrentResult = (nextResult: { value: string; text: string }) => {
    currentResultRef.current = nextResult
    setCurrentResult(nextResult)
  }

  const changeCurrentValue = (amount: number) => {
    const numberValue = Number(currentResultRef.current.value || 0)
    const nextValue = Number.isFinite(numberValue) ? numberValue + amount : amount
    const formattedValue = Number.isInteger(nextValue)
      ? String(nextValue)
      : nextValue.toFixed(1)

    setSharedCurrentResult({ value: formattedValue, text: `Level ${formattedValue}` })
  }

  const updateCurrentValue = (value: string) => {
    setSharedCurrentResult({ value, text: value ? `Level ${value}` : '' })
  }

  const updateCurrentText = (text: string) => {
    setSharedCurrentResult({ value: currentResultRef.current.value, text })
  }

  const recordDropout = async (playerId: string) => {
    if (!isSessionLive || isSessionCompleted || pendingPlayerId) return

    setPendingPlayerId(playerId)
    setMessage(null)

    const formData = new FormData()
    const resultAtDropout = currentResultRef.current
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('playerId', playerId)
    formData.set('resultValue', resultAtDropout.value)
    formData.set('resultText', resultAtDropout.text || resultAtDropout.value)

    const result = await saveDropoutAction(formData)

    if (result?.ok) {
      setDropoutPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
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
      )
      setMessage('Dropout recorded.')
    } else {
      setMessage('Dropout could not be recorded. Try again.')
    }

    setPendingPlayerId(null)
  }

  const startFitnessTest = async () => {
    if (isSessionLive || isSessionCompleted || isStarting) return

    setIsStarting(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('mode', 'liveDropout')

    const result = await startSessionAction(formData)

    if (result?.ok) {
      setLocalStartedAt(result.startedAt)
      setMessage('Fitness test started.')
    } else {
      setMessage(result?.reason ?? 'Fitness test could not be started. Try again.')
    }

    setIsStarting(false)
  }

  const formattedStartedAt = effectiveStartedAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(effectiveStartedAt))
    : null

  const formattedCompletedAt = effectiveCompletedAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(effectiveCompletedAt))
    : null

  const endFitnessTest = async () => {
    if (!isSessionLive || isSessionCompleted || isEnding) return

    setIsEnding(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)

    const result = await endSessionAction(formData)

    if (result?.ok) {
      setLocalCompletedAt(result.completedAt)
      setMessage('Fitness test completed. Results are now read-only.')
    } else {
      setMessage(result?.reason ?? 'Fitness test could not be completed. Try again.')
    }

    setIsEnding(false)
  }

  const undoDropout = async (playerId: string) => {
    if (!isSessionLive || isSessionCompleted || pendingPlayerId) return

    setPendingPlayerId(playerId)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('playerId', playerId)

    const result = await undoDropoutAction(formData)

    if (result?.ok) {
      setDropoutPlayers((currentPlayers) =>
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

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border p-4">
        <h2 className="text-xl font-bold">Current Result</h2>
        <p className="mt-1 text-sm text-gray-500">
          Set this once, then tap each player as they drop out. You can adjust it as
          the test moves through levels, stages, or distances.
        </p>
        {isSessionCompleted ? (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
            Completed{formattedCompletedAt ? `: ${formattedCompletedAt}` : ''}. Results are read-only.
          </p>
        ) : isSessionLive ? (
          <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">
            LIVE{formattedStartedAt ? `: started ${formattedStartedAt}` : ''}
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Start the fitness test before changing levels or recording dropouts.
          </p>
        )}

        {!isSessionLive && !isSessionCompleted && (
          <button
            type="button"
            onClick={startFitnessTest}
            className="mt-4 w-full rounded bg-green-700 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start Fitness Test'}
          </button>
        )}

        {isSessionLive && (
          <button
            type="button"
            onClick={endFitnessTest}
            className="mt-4 w-full rounded bg-red-700 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isEnding}
          >
            {isEnding ? 'Ending...' : 'End Fitness Test'}
          </button>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Current numeric result
            <input
              type="number"
              step="any"
              value={currentResult.value}
              onChange={(event) => updateCurrentValue(event.target.value)}
              className="mt-1 w-full rounded border p-3 text-base"
              placeholder={resultUnit}
              disabled={!isSessionLive}
            />
          </label>

          <label className="text-sm font-medium">
            Current display result
            <input
              value={currentResult.text}
              onChange={(event) => updateCurrentText(event.target.value)}
              className="mt-1 w-full rounded border p-3 text-base"
              placeholder="e.g. Level 12.4"
              disabled={!isSessionLive}
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => changeCurrentValue(-1)}
            className="rounded border px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isSessionLive}
          >
            -1 Level
          </button>
          <button
            type="button"
            onClick={() => changeCurrentValue(1)}
            className="rounded border px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isSessionLive}
          >
            +1 Level
          </button>
        </div>
      </section>

      {message && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          {message}
        </p>
      )}

      {!isSessionCompleted && isSessionLive && allPlayersFinished && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          All active players have dropout results. End Fitness Test to complete and lock this session.
        </p>
      )}

      {isSessionCompleted && (
        <FitnessTestCompleteSummary
          title="Completed Results Summary"
          description="This test is completed and locked. Saved dropout results remain available."
          players={dropoutPlayers}
          resultUnit={resultUnit}
          higherIsBetter={higherIsBetter}
          statusLabel="Dropped out"
          rankingsHref={rankingsHref}
        />
      )}

      {!isSessionCompleted && (
        <section className="grid gap-4 md:grid-cols-2">
          {dropoutPlayers.map((player) => {
            const hasResult = Boolean(player.result)

            return (
              <article
                key={player.id}
                className={`rounded-lg border p-4 ${
                  hasResult ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50'
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
                    {formatResult(player.result)}
                  </span>
                </div>

                {hasResult ? (
                  <button
                    type="button"
                    onClick={() => undoDropout(player.id)}
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
                    onClick={() => recordDropout(player.id)}
                    className="w-full rounded bg-green-700 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSessionCompleted || !isSessionLive || pendingPlayerId === player.id}
                  >
                    {isSessionCompleted
                      ? 'Results locked'
                      : !isSessionLive
                        ? 'Start test first'
                        : pendingPlayerId === player.id
                          ? 'Saving...'
                          : 'Record Dropout'}
                  </button>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
