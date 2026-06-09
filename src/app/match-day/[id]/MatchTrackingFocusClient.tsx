'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type SquadStatus = 'STARTER' | 'SUBSTITUTE'

type MatchActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type TrackingPlayer = {
  matchDayPlayerId: string
  firstName: string
  surname: string
  squadNumber: number | null
  squadStatus: SquadStatus
  isTracked: boolean
}

type TrackingMode = 'ALL' | 'SELECTED'

type MatchTrackingFocusClientProps = {
  matchDayId: string
  players: TrackingPlayer[]
  updateMatchTrackingFocusAction: (formData: FormData) => Promise<MatchActionResult>
}

const formatPlayerName = (player: TrackingPlayer) =>
  `${player.firstName} ${player.surname}`

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const formatSquadStatus = (squadStatus: SquadStatus) =>
  squadStatus === 'STARTER' ? 'Starter' : 'Substitute'

export default function MatchTrackingFocusClient({
  matchDayId,
  players,
  updateMatchTrackingFocusAction,
}: MatchTrackingFocusClientProps) {
  const router = useRouter()
  const allPlayerIds = players.map((player) => player.matchDayPlayerId)
  const initialTrackedIds = players
    .filter((player) => player.isTracked)
    .map((player) => player.matchDayPlayerId)
  const initialMode: TrackingMode =
    players.length > 0 && initialTrackedIds.length === players.length ? 'ALL' : 'SELECTED'
  const [trackingMode, setTrackingMode] = useState<TrackingMode>(initialMode)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(initialTrackedIds)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setAllMode = () => {
    setTrackingMode('ALL')
    setSelectedPlayerIds(allPlayerIds)
  }

  const setSelectedMode = () => {
    setTrackingMode('SELECTED')
    setSelectedPlayerIds(initialTrackedIds.length > 0 ? initialTrackedIds : allPlayerIds)
  }

  const togglePlayer = (matchDayPlayerId: string) => {
    setTrackingMode('SELECTED')
    setSelectedPlayerIds((currentIds) =>
      currentIds.includes(matchDayPlayerId)
        ? currentIds.filter((currentId) => currentId !== matchDayPlayerId)
        : [...currentIds, matchDayPlayerId]
    )
  }

  const saveTrackingFocus = async () => {
    if (isSaving) return

    setIsSaving(true)
    setMessage(null)
    setError(null)

    const formData = new FormData()
    formData.set('matchDayId', matchDayId)
    const trackedIds = trackingMode === 'ALL' ? allPlayerIds : selectedPlayerIds
    trackedIds.forEach((matchDayPlayerId) => {
      formData.append('trackedMatchDayPlayerId', matchDayPlayerId)
    })

    const result = await updateMatchTrackingFocusAction(formData)

    if (result.ok) {
      setMessage('Tracking focus saved.')
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSaving(false)
  }

  return (
    <section className="rounded-xl border p-5">
      <div>
        <h2 className="text-xl font-bold">Tracking focus</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose which players you want to track events for during this match. This does not affect squad involvement or substitutions.
        </p>
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

      {players.length === 0 ? (
        <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Add starters or substitutes in the squad before choosing a tracking focus.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={setAllMode}
              className={`rounded-lg border p-4 text-left font-semibold disabled:opacity-50 ${
                trackingMode === 'ALL'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'bg-white text-gray-900'
              }`}
              disabled={isSaving}
            >
              Track all on-pitch players
            </button>
            <button
              type="button"
              onClick={setSelectedMode}
              className={`rounded-lg border p-4 text-left font-semibold disabled:opacity-50 ${
                trackingMode === 'SELECTED'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'bg-white text-gray-900'
              }`}
              disabled={isSaving}
            >
              Track selected players only
            </button>
          </div>

          {trackingMode === 'SELECTED' && (
            <div className="mt-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                Players available for event tracking
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {players.map((player) => {
                  const isSelected = selectedPlayerIds.includes(player.matchDayPlayerId)

                  return (
                    <button
                      key={player.matchDayPlayerId}
                      type="button"
                      onClick={() => togglePlayer(player.matchDayPlayerId)}
                      className={`rounded-lg border p-4 text-left disabled:opacity-50 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'bg-white text-gray-900'
                      }`}
                      disabled={isSaving}
                    >
                      <span className="block text-base font-bold">{formatPlayerName(player)}</span>
                      <span className="mt-1 block text-sm text-gray-500">
                        {formatSquadNumber(player.squadNumber)} · {formatSquadStatus(player.squadStatus)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={saveTrackingFocus}
            className="mt-4 w-full rounded bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save tracking focus'}
          </button>
        </>
      )}
    </section>
  )
}
