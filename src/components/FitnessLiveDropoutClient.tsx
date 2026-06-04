'use client'

import { useState } from 'react'

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
  players: DropoutPlayer[]
  saveDropoutAction: (formData: FormData) => Promise<void>
  undoDropoutAction: (formData: FormData) => Promise<void>
}

const formatResult = (result: DropoutPlayer['result']) => {
  if (!result) return 'Still in'
  if (result.resultText) return result.resultText
  if (result.resultValue !== null) return String(result.resultValue)
  return 'Recorded'
}

export default function FitnessLiveDropoutClient({
  sessionId,
  resultUnit,
  players,
  saveDropoutAction,
  undoDropoutAction,
}: FitnessLiveDropoutClientProps) {
  const [currentValue, setCurrentValue] = useState('')
  const [currentText, setCurrentText] = useState('')

  const changeCurrentValue = (amount: number) => {
    const numberValue = Number(currentValue || 0)
    const nextValue = Number.isFinite(numberValue) ? numberValue + amount : amount
    const formattedValue = Number.isInteger(nextValue)
      ? String(nextValue)
      : nextValue.toFixed(1)

    setCurrentValue(formattedValue)
    if (!currentText) setCurrentText(formattedValue)
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border p-4">
        <h2 className="text-xl font-bold">Current Result</h2>
        <p className="mt-1 text-sm text-gray-500">
          Set this once, then tap each player as they drop out. You can adjust it as
          the test moves through levels, stages, or distances.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Current numeric result
            <input
              type="number"
              step="any"
              value={currentValue}
              onChange={(event) => setCurrentValue(event.target.value)}
              className="mt-1 w-full rounded border p-3 text-base"
              placeholder={resultUnit}
            />
          </label>

          <label className="text-sm font-medium">
            Current display result
            <input
              value={currentText}
              onChange={(event) => setCurrentText(event.target.value)}
              className="mt-1 w-full rounded border p-3 text-base"
              placeholder="e.g. Level 12.4"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => changeCurrentValue(-1)}
            className="rounded border px-4 py-3 font-medium"
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => changeCurrentValue(1)}
            className="rounded border px-4 py-3 font-medium"
          >
            +1
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
                hasResult ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50'
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
                  {formatResult(player.result)}
                </span>
              </div>

              {hasResult ? (
                <form action={undoDropoutAction}>
                  <input type="hidden" name="fitnessTestSessionId" value={sessionId} />
                  <input type="hidden" name="playerId" value={player.id} />
                  <button className="w-full rounded border border-red-300 bg-white px-4 py-3 font-medium text-red-700">
                    Undo / Reinstate
                  </button>
                </form>
              ) : (
                <form action={saveDropoutAction}>
                  <input type="hidden" name="fitnessTestSessionId" value={sessionId} />
                  <input type="hidden" name="playerId" value={player.id} />
                  <input type="hidden" name="resultValue" value={currentValue} />
                  <input type="hidden" name="resultText" value={currentText} />
                  <button className="w-full rounded bg-green-700 px-4 py-3 font-medium text-white">
                    Record Dropout
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
