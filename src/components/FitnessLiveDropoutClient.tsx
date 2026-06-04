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
  players: DropoutPlayer[]
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

export default function FitnessLiveDropoutClient({
  sessionId,
  resultUnit,
  higherIsBetter,
  rankingsHref,
  isLive,
  players,
  saveDropoutAction,
  undoDropoutAction,
}: FitnessLiveDropoutClientProps) {
  const [dropoutPlayers, setDropoutPlayers] = useState(players)
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
    if (!isLive || pendingPlayerId) return

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

  const undoDropout = async (playerId: string) => {
    if (pendingPlayerId) return

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
        {!isLive && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Start the fitness test before changing levels or recording dropouts.
          </p>
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
              disabled={!isLive}
            />
          </label>

          <label className="text-sm font-medium">
            Current display result
            <input
              value={currentResult.text}
              onChange={(event) => updateCurrentText(event.target.value)}
              className="mt-1 w-full rounded border p-3 text-base"
              placeholder="e.g. Level 12.4"
              disabled={!isLive}
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => changeCurrentValue(-1)}
            className="rounded border px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isLive}
          >
            -1 Level
          </button>
          <button
            type="button"
            onClick={() => changeCurrentValue(1)}
            className="rounded border px-4 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isLive}
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

      {allPlayersFinished && (
        <FitnessTestCompleteSummary
          title="Test Complete"
          description="All active players have recorded dropout results."
          players={dropoutPlayers}
          resultUnit={resultUnit}
          higherIsBetter={higherIsBetter}
          statusLabel="Dropped out"
          rankingsHref={rankingsHref}
        />
      )}

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
                  disabled={!isLive || pendingPlayerId === player.id}
                >
                  {pendingPlayerId === player.id ? 'Saving...' : 'Undo / Reinstate'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => recordDropout(player.id)}
                  className="w-full rounded bg-green-700 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!isLive || pendingPlayerId === player.id}
                >
                  {!isLive
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
    </div>
  )
}
