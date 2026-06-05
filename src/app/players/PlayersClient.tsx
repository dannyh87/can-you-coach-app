'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const positions = [
  'Goalkeeper',
  'Right Back',
  'Centre Back',
  'Left Back',
  'Defensive Midfielder',
  'Central Midfielder',
  'Attacking Midfielder',
  'Right Wing',
  'Left Wing',
  'Striker',
]

type PlayerActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type PlayerAction = (formData: FormData) => Promise<PlayerActionResult>

type TeamOption = {
  id: string
  name: string
  clubName: string
}

type PlayerRow = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  preferredPosition: string | null
  dateOfBirthInput: string
  dateOfBirthDisplay: string
  joinedClubDateInput: string
  joinedClubDateDisplay: string
  isActive: boolean
  teamId: string
  teamName: string
  clubName: string
}

type ModalMode = 'add' | 'detail' | 'edit' | null

type PlayersClientProps = {
  players: PlayerRow[]
  teams: TeamOption[]
  createPlayerAction: PlayerAction
  updatePlayerAction: PlayerAction
  archivePlayerAction: PlayerAction
  restorePlayerAction: PlayerAction
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'Not set' : `#${squadNumber}`

const getPlayerName = (player: PlayerRow) =>
  `${player.firstName} ${player.surname}`

export default function PlayersClient({
  players,
  teams,
  createPlayerAction,
  updatePlayerAction,
  archivePlayerAction,
  restorePlayerAction,
}: PlayersClientProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const activeCount = players.filter((player) => player.isActive).length
  const archivedCount = players.length - activeCount

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedPlayer(null)
    setError(null)
  }

  const openAddModal = () => {
    setSelectedPlayer(null)
    setError(null)
    setModalMode('add')
  }

  const openDetailModal = (player: PlayerRow) => {
    setSelectedPlayer(player)
    setError(null)
    setModalMode('detail')
  }

  const openEditModal = () => {
    setError(null)
    setModalMode('edit')
  }

  const submitAction = async (
    action: PlayerAction,
    formData: FormData,
    nextMode: ModalMode = null
  ) => {
    setIsSubmitting(true)
    setError(null)

    const result = await action(formData)

    if (result.ok) {
      setModalMode(nextMode)
      if (nextMode === null) setSelectedPlayer(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  const archiveOrRestore = async () => {
    if (!selectedPlayer) return

    const formData = new FormData()
    formData.set('id', selectedPlayer.id)

    await submitAction(
      selectedPlayer.isActive ? archivePlayerAction : restorePlayerAction,
      formData
    )
  }

  return (
    <>
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total players</p>
          <p className="mt-1 text-2xl font-bold">{players.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{activeCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Archived</p>
          <p className="mt-1 text-2xl font-bold text-gray-700">{archivedCount}</p>
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-xl font-bold">Player List</h2>
            <p className="mt-1 text-sm text-gray-500">
              Click a row to view details or edit a player.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add Player
          </button>
        </div>

        {players.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No players yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Player name</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Position</th>
                  <th className="px-4 py-3 font-medium">Squad number</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {players.map((player) => (
                  <tr
                    key={player.id}
                    onClick={() => openDetailModal(player)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className="px-4 py-3 font-medium">{getPlayerName(player)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {player.clubName} / {player.teamName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {player.preferredPosition ?? 'Not set'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatSquadNumber(player.squadNumber)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          player.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {player.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {modalMode === 'add'
                    ? 'Add Player'
                    : modalMode === 'edit'
                      ? 'Edit Player'
                      : selectedPlayer
                        ? getPlayerName(selectedPlayer)
                        : 'Player Details'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modalMode === 'detail'
                    ? 'View player details and manage status.'
                    : 'Squad number, date of birth and joined date are optional.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded border px-3 py-1 text-sm font-medium"
                disabled={isSubmitting}
              >
                Close
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            {modalMode === 'add' && (
              <PlayerForm
                teams={teams}
                action={createPlayerAction}
                submitLabel="Create Player"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'edit' && selectedPlayer && (
              <PlayerForm
                teams={teams}
                player={selectedPlayer}
                action={updatePlayerAction}
                submitLabel="Save Player"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'detail' && selectedPlayer && (
              <PlayerDetail
                player={selectedPlayer}
                isSubmitting={isSubmitting}
                onEdit={openEditModal}
                onArchiveOrRestore={archiveOrRestore}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function PlayerForm({
  teams,
  player,
  action,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  teams: TeamOption[]
  player?: PlayerRow
  action: PlayerAction
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (action: PlayerAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className="grid gap-3 md:grid-cols-2">
      {player && <input type="hidden" name="id" value={player.id} />}

      <label className="text-sm font-medium md:col-span-2">
        Team
        <select
          name="teamId"
          required
          defaultValue={player?.teamId ?? teams[0]?.id}
          className="mt-1 w-full rounded border p-2"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.clubName} - {team.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        First name
        <input
          name="firstName"
          required
          defaultValue={player?.firstName ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Surname
        <input
          name="surname"
          required
          defaultValue={player?.surname ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Squad number optional
        <input
          name="squadNumber"
          type="number"
          min="0"
          defaultValue={player?.squadNumber ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Preferred position
        <select
          name="preferredPosition"
          required
          defaultValue={player?.preferredPosition ?? ''}
          className="mt-1 w-full rounded border p-2"
        >
          <option value="" disabled>
            Select position
          </option>
          {positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Date of birth
        <input
          name="dateOfBirth"
          type="date"
          defaultValue={player?.dateOfBirthInput ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Joined club date
        <input
          name="joinedClubDate"
          type="date"
          defaultValue={player?.joinedClubDateInput ?? ''}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <div className="flex items-end md:col-span-2">
        <button
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function PlayerDetail({
  player,
  isSubmitting,
  onEdit,
  onArchiveOrRestore,
}: {
  player: PlayerRow
  isSubmitting: boolean
  onEdit: () => void
  onArchiveOrRestore: () => Promise<void>
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Team" value={`${player.clubName} / ${player.teamName}`} />
        <DetailItem label="Position" value={player.preferredPosition ?? 'Not set'} />
        <DetailItem label="Squad number" value={formatSquadNumber(player.squadNumber)} />
        <DetailItem label="Status" value={player.isActive ? 'Active' : 'Archived'} />
        <DetailItem label="Date of birth" value={player.dateOfBirthDisplay} />
        <DetailItem label="Joined club" value={player.joinedClubDateDisplay} />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          disabled={isSubmitting}
        >
          Edit Player
        </button>
        <button
          type="button"
          onClick={onArchiveOrRestore}
          className={`rounded border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            player.isActive ? 'text-red-700' : 'text-blue-700'
          }`}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Saving...'
            : player.isActive
              ? 'Archive Player'
              : 'Restore Player'}
        </button>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  )
}
