'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type SetupActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type SetupAction = (formData: FormData) => Promise<SetupActionResult>

type TeamRow = {
  id: string
  clubId: string
  clubName: string
  name: string
  ageGroup: string
  season: string
  playerCount: number
  fitnessSessionCount: number
}

type ClubRow = {
  id: string
  name: string
  location: string | null
  notes: string | null
  teams: TeamRow[]
}

type ModalMode = 'editClub' | 'addTeam' | 'teamDetail' | 'editTeam' | 'deleteTeam' | null

type ClubSetupClientProps = {
  clubs: ClubRow[]
  updateClubAction: SetupAction
  createTeamAction: SetupAction
  updateTeamAction: SetupAction
  deleteTeamAction: SetupAction
}

export default function ClubSetupClient({
  clubs,
  updateClubAction,
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
}: ClubSetupClientProps) {
  const router = useRouter()
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id ?? '')
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectedClub =
    clubs.find((club) => club.id === selectedClubId) ?? clubs[0] ?? null
  const teams = selectedClub?.teams ?? []
  const totalPlayers = teams.reduce((total, team) => total + team.playerCount, 0)
  const totalFitnessSessions = teams.reduce(
    (total, team) => total + team.fitnessSessionCount,
    0
  )

  const closeModal = () => {
    if (isSubmitting) return
    setModalMode(null)
    setSelectedTeam(null)
    setError(null)
  }

  const openModal = (mode: ModalMode, team: TeamRow | null = null) => {
    setSelectedTeam(team)
    setError(null)
    setModalMode(mode)
  }

  const returnToTeamDetail = () => {
    if (isSubmitting) return
    setError(null)
    setModalMode('teamDetail')
  }

  const submitAction = async (action: SetupAction, formData: FormData) => {
    setIsSubmitting(true)
    setError(null)

    const result = await action(formData)

    if (result.ok) {
      setModalMode(null)
      setSelectedTeam(null)
      router.refresh()
    } else {
      setError(result.reason)
    }

    setIsSubmitting(false)
  }

  const deleteSelectedTeam = async () => {
    if (!selectedTeam) return

    const formData = new FormData()
    formData.set('id', selectedTeam.id)

    await submitAction(deleteTeamAction, formData)
  }

  if (!selectedClub) {
    return (
      <section className="rounded-lg border p-4">
        <h2 className="text-xl font-bold">No club found</h2>
        <p className="mt-2 text-sm text-gray-500">
          A default club could not be loaded. Try refreshing the page.
        </p>
      </section>
    )
  }

  return (
    <>
      {clubs.length > 1 && (
        <section className="mb-6 rounded-lg border p-4">
          <label className="text-sm font-medium">
            Current club
            <select
              value={selectedClub.id}
              onChange={(event) => {
                setSelectedClubId(event.target.value)
                setSelectedTeam(null)
                setError(null)
                setModalMode(null)
              }}
              className="mt-1 w-full rounded border p-2"
            >
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <section className="mb-6 rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{selectedClub.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {selectedClub.location || 'No location set'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal('editClub')}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Edit Club
          </button>
        </div>

        {selectedClub.notes && (
          <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            {selectedClub.notes}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Teams" value={teams.length} />
          <SummaryCard label="Players" value={totalPlayers} />
          <SummaryCard label="Fitness sessions" value={totalFitnessSessions} />
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-xl font-bold">Teams</h2>
            <p className="mt-1 text-sm text-gray-500">
              Teams belonging to {selectedClub.name}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal('addTeam')}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add Team
          </button>
        </div>

        {teams.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No teams created for this club yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Team name</th>
                  <th className="px-4 py-3 font-medium">Age group</th>
                  <th className="px-4 py-3 font-medium">Season</th>
                  <th className="px-4 py-3 font-medium">Players</th>
                  <th className="px-4 py-3 font-medium">Fitness sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    onClick={() => openModal('teamDetail', team)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className="px-4 py-3 font-medium">{team.name}</td>
                    <td className="px-4 py-3 text-gray-600">{team.ageGroup}</td>
                    <td className="px-4 py-3 text-gray-600">{team.season}</td>
                    <td className="px-4 py-3 text-gray-600">{team.playerCount}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {team.fitnessSessionCount}
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
                  {modalMode === 'editClub'
                    ? 'Edit Club'
                    : modalMode === 'addTeam'
                      ? 'Add Team'
                      : modalMode === 'editTeam'
                        ? 'Edit Team'
                        : modalMode === 'deleteTeam'
                          ? 'Confirm Delete Team'
                          : selectedTeam?.name ?? 'Team Details'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modalMode === 'deleteTeam'
                    ? 'Deletion is permanent and only allowed for empty teams.'
                    : modalMode === 'teamDetail'
                      ? 'View team details and manage this team.'
                      : 'Changes are saved only after a successful action.'}
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

            {modalMode === 'editClub' && (
              <ClubForm
                club={selectedClub}
                action={updateClubAction}
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'addTeam' && (
              <TeamForm
                club={selectedClub}
                action={createTeamAction}
                submitLabel="Create Team"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'editTeam' && selectedTeam && (
              <TeamForm
                club={selectedClub}
                team={selectedTeam}
                action={updateTeamAction}
                submitLabel="Save Team"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'teamDetail' && selectedTeam && (
              <TeamDetail
                team={selectedTeam}
                isSubmitting={isSubmitting}
                onEdit={() => openModal('editTeam', selectedTeam)}
                onDelete={() => openModal('deleteTeam', selectedTeam)}
              />
            )}

            {modalMode === 'deleteTeam' && selectedTeam && (
              <DeleteTeamConfirmation
                team={selectedTeam}
                isSubmitting={isSubmitting}
                onCancel={returnToTeamDetail}
                onConfirm={deleteSelectedTeam}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function ClubForm({
  club,
  action,
  isSubmitting,
  onSubmit,
}: {
  club: ClubRow
  action: SetupAction
  isSubmitting: boolean
  onSubmit: (action: SetupAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className="grid gap-3">
      <input type="hidden" name="id" value={club.id} />

      <label className="text-sm font-medium">
        Club name
        <input
          name="name"
          required
          defaultValue={club.name}
          className="mt-1 w-full rounded border p-2"
        />
      </label>

      <label className="text-sm font-medium">
        Location
        <input
          name="location"
          defaultValue={club.location ?? ''}
          className="mt-1 w-full rounded border p-2"
          placeholder="Optional"
        />
      </label>

      <label className="text-sm font-medium">
        Notes
        <textarea
          name="notes"
          defaultValue={club.notes ?? ''}
          className="mt-1 w-full rounded border p-2"
          rows={3}
          placeholder="Optional"
        />
      </label>

      <button
        className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Save Club'}
      </button>
    </form>
  )
}

function TeamForm({
  club,
  team,
  action,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  club: ClubRow
  team?: TeamRow
  action: SetupAction
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (action: SetupAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className="grid gap-3 md:grid-cols-2">
      {team && <input type="hidden" name="id" value={team.id} />}
      <input type="hidden" name="clubId" value={club.id} />

      <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 md:col-span-2">
        Club: <span className="font-medium text-gray-900">{club.name}</span>
      </div>

      <label className="text-sm font-medium">
        Team name
        <input
          name="name"
          required
          defaultValue={team?.name ?? ''}
          className="mt-1 w-full rounded border p-2"
          placeholder="e.g. First Team"
        />
      </label>

      <label className="text-sm font-medium">
        Age group
        <input
          name="ageGroup"
          required
          defaultValue={team?.ageGroup ?? ''}
          className="mt-1 w-full rounded border p-2"
          placeholder="e.g. Open Age"
        />
      </label>

      <label className="text-sm font-medium">
        Season
        <input
          name="season"
          required
          defaultValue={team?.season ?? ''}
          className="mt-1 w-full rounded border p-2"
          placeholder="e.g. 2026/27"
        />
      </label>

      <div className="flex items-end">
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

function TeamDetail({
  team,
  isSubmitting,
  onEdit,
  onDelete,
}: {
  team: TeamRow
  isSubmitting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Club" value={team.clubName} />
        <DetailItem label="Age group" value={team.ageGroup} />
        <DetailItem label="Season" value={team.season} />
        <DetailItem label="Players" value={String(team.playerCount)} />
        <DetailItem
          label="Fitness sessions"
          value={String(team.fitnessSessionCount)}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          disabled={isSubmitting}
        >
          Edit Team
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
          disabled={isSubmitting}
        >
          Delete Team
        </button>
      </div>
    </div>
  )
}

function DeleteTeamConfirmation({
  team,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  team: TeamRow
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
}) {
  const isBlocked = team.playerCount > 0 || team.fitnessSessionCount > 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-bold">{team.name}</h3>
        <p className="mt-1 text-sm text-gray-500">{team.clubName}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailItem label="Players" value={String(team.playerCount)} />
          <DetailItem
            label="Fitness sessions"
            value={String(team.fitnessSessionCount)}
          />
        </dl>
      </div>

      {isBlocked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This team cannot be deleted while it has players or fitness sessions.
          Move or remove them before deleting this team.
        </p>
      ) : (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          This will permanently delete the team. This action cannot be undone.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-4 py-2 text-sm font-medium"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        {!isBlocked && (
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting...' : 'Confirm Delete Team'}
          </button>
        )}
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
