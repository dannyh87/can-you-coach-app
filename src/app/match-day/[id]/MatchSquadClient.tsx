'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type SquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'

type SquadActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type SquadPlayer = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  preferredPosition: string | null
  squadStatus: SquadStatus
  startingPosition: string
  hasSquadRecord: boolean
}

type MatchSquadClientProps = {
  matchDayId: string
  isReadOnly: boolean
  hasSquadRecords: boolean
  players: SquadPlayer[]
  setupMatchSquadAction: (formData: FormData) => Promise<SquadActionResult>
  updateMatchSquadPlayerAction: (formData: FormData) => Promise<SquadActionResult>
}

const squadStatusOptions: Array<{ value: SquadStatus; label: string }> = [
  { value: 'STARTER', label: 'Starter' },
  { value: 'SUBSTITUTE', label: 'Substitute' },
  { value: 'NOT_INVOLVED', label: 'Not involved' },
]

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const getPlayerName = (player: SquadPlayer) =>
  `${player.firstName} ${player.surname}`

const formatSquadStatus = (status: SquadStatus) => {
  if (status === 'STARTER') return 'Starter'
  if (status === 'SUBSTITUTE') return 'Substitute'
  return 'Not involved'
}

const getSquadStatusClasses = (status: SquadStatus) => {
  if (status === 'STARTER') return 'bg-green-100 text-green-800'
  if (status === 'SUBSTITUTE') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-700'
}

export default function MatchSquadClient({
  matchDayId,
  isReadOnly,
  hasSquadRecords,
  players,
  setupMatchSquadAction,
  updateMatchSquadPlayerAction,
}: MatchSquadClientProps) {
  const router = useRouter()
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const starterCount = players.filter((player) => player.squadStatus === 'STARTER').length
  const substituteCount = players.filter(
    (player) => player.squadStatus === 'SUBSTITUTE'
  ).length
  const notInvolvedCount = players.filter(
    (player) => player.squadStatus === 'NOT_INVOLVED'
  ).length

  const setupSquad = async () => {
    if (isReadOnly || isSettingUp) return

    setIsSettingUp(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)

    const result = await setupMatchSquadAction(formData)

    if (result.ok) {
      setMessage('Squad set up from active team players.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSettingUp(false)
  }

  const updatePlayer = async ({
    player,
    squadStatus,
    startingPosition,
  }: {
    player: SquadPlayer
    squadStatus: SquadStatus
    startingPosition: string
  }) => {
    if (isReadOnly || pendingPlayerId) return

    setPendingPlayerId(player.id)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    formData.set('playerId', player.id)
    formData.set('squadStatus', squadStatus)
    formData.set('startingPosition', startingPosition)

    const result = await updateMatchSquadPlayerAction(formData)

    if (result.ok) {
      setMessage(`${getPlayerName(player)} updated.`)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingPlayerId(null)
  }

  return (
    <section className="rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Squad</h2>
          <p className="mt-1 text-sm text-gray-500">
            Mark players as starters, substitutes or not involved for this match.
          </p>
        </div>

        {!isReadOnly && !hasSquadRecords && players.length > 0 && (
          <button
            type="button"
            onClick={setupSquad}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isSettingUp}
          >
            {isSettingUp ? 'Setting up...' : 'Set up squad'}
          </button>
        )}
      </div>

      {isReadOnly && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          This match is completed. Squad involvement is read-only.
        </p>
      )}

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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryPill label="Starters" value={starterCount} />
        <SummaryPill label="Substitutes" value={substituteCount} />
        <SummaryPill label="Not involved" value={notInvolvedCount} />
      </div>

      {players.length === 0 ? (
        <p className="mt-4 rounded-lg border p-4 text-sm text-gray-500">
          No active players are available for this team.
        </p>
      ) : !hasSquadRecords && !isReadOnly ? (
        <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Use Set up squad to pull in active team players, then choose each player&apos;s involvement.
        </p>
      ) : (
        <div className="mt-4 grid gap-4">
          {players.map((player) => (
            <SquadPlayerCard
              key={player.id}
              player={player}
              isReadOnly={isReadOnly}
              isPending={pendingPlayerId === player.id}
              onUpdate={updatePlayer}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function SquadPlayerCard({
  player,
  isReadOnly,
  isPending,
  onUpdate,
}: {
  player: SquadPlayer
  isReadOnly: boolean
  isPending: boolean
  onUpdate: (input: {
    player: SquadPlayer
    squadStatus: SquadStatus
    startingPosition: string
  }) => Promise<void>
}) {
  const [startingPosition, setStartingPosition] = useState(player.startingPosition)

  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{getPlayerName(player)}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {formatSquadNumber(player.squadNumber)} ·{' '}
            {player.preferredPosition ?? 'No preferred position'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getSquadStatusClasses(player.squadStatus)}`}>
          {formatSquadStatus(player.squadStatus)}
        </span>
      </div>

      {player.squadStatus === 'STARTER' && (
        <label className="mt-4 block text-sm font-medium">
          Starting position optional
          <input
            value={startingPosition}
            onChange={(event) => setStartingPosition(event.target.value)}
            onBlur={() =>
              onUpdate({
                player,
                squadStatus: player.squadStatus,
                startingPosition,
              })
            }
            className="mt-1 w-full rounded border p-3 text-base"
            placeholder="e.g. CM, LW, CB"
            disabled={isReadOnly || isPending}
          />
        </label>
      )}

      {!isReadOnly && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {squadStatusOptions.map((option) => {
            const isSelected = player.squadStatus === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onUpdate({
                    player,
                    squadStatus: option.value,
                    startingPosition,
                  })
                }
                className={`rounded-lg border px-4 py-3 text-sm font-semibold disabled:opacity-50 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'bg-white text-gray-800'
                }`}
                disabled={isPending}
              >
                {isPending ? 'Saving...' : option.label}
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}
