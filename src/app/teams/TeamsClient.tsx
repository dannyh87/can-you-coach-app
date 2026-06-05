'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type TeamActionResult =
  | { ok: true }
  | { ok: false; reason: string }

type TeamAction = (formData: FormData) => Promise<TeamActionResult>

type ClubOption = {
  id: string
  name: string
}

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

type ModalMode = 'add' | 'detail' | 'edit' | 'delete' | null

type TeamsClientProps = {
  teams: TeamRow[]
  clubs: ClubOption[]
  createTeamAction: TeamAction
  updateTeamAction: TeamAction
  deleteTeamAction: TeamAction
}

export default function TeamsClient({
  teams,
  clubs,
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
}: TeamsClientProps) {
  const router = useRouter()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const openAddModal = () => {
    setSelectedTeam(null)
    setError(null)
    setModalMode('add')
  }

  const openDetailModal = (team: TeamRow) => {
    setSelectedTeam(team)
    setError(null)
    setModalMode('detail')
  }

  const openEditModal = () => {
    setError(null)
    setModalMode('edit')
  }

  const openDeleteModal = () => {
    setError(null)
    setModalMode('delete')
  }

  const returnToDetailModal = () => {
    if (isSubmitting) return
    setError(null)
    setModalMode('detail')
  }

  const submitAction = async (action: TeamAction, formData: FormData) => {
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

  return (
    <>
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total teams</p>
          <p className="mt-1 text-2xl font-bold">{teams.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Players in teams</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{totalPlayers}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-gray-500">Fitness sessions</p>
          <p className="mt-1 text-2xl font-bold text-gray-700">
            {totalFitnessSessions}
          </p>
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-xl font-bold">Team List</h2>
            <p className="mt-1 text-sm text-gray-500">
              Click a row to view details or edit a team.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add Team
          </button>
        </div>

        {teams.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No teams created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Team name</th>
                  <th className="px-4 py-3 font-medium">Club</th>
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
                    onClick={() => openDetailModal(team)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className="px-4 py-3 font-medium">{team.name}</td>
                    <td className="px-4 py-3 text-gray-600">{team.clubName}</td>
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
                  {modalMode === 'add'
                    ? 'Add Team'
                    : modalMode === 'edit'
                      ? 'Edit Team'
                      : modalMode === 'delete'
                        ? 'Confirm Delete Team'
                        : selectedTeam?.name ?? 'Team Details'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {modalMode === 'delete'
                    ? 'Deletion is permanent and only allowed for empty teams.'
                    : modalMode === 'detail'
                      ? 'View team details and manage this team.'
                      : 'Club, team name, age group and season are required.'}
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
              <TeamForm
                clubs={clubs}
                action={createTeamAction}
                submitLabel="Create Team"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'edit' && selectedTeam && (
              <TeamForm
                clubs={clubs}
                team={selectedTeam}
                action={updateTeamAction}
                submitLabel="Save Team"
                isSubmitting={isSubmitting}
                onSubmit={submitAction}
              />
            )}

            {modalMode === 'detail' && selectedTeam && (
              <TeamDetail
                team={selectedTeam}
                isSubmitting={isSubmitting}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
              />
            )}

            {modalMode === 'delete' && selectedTeam && (
              <DeleteConfirmation
                team={selectedTeam}
                isSubmitting={isSubmitting}
                onCancel={returnToDetailModal}
                onConfirm={deleteSelectedTeam}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function TeamForm({
  clubs,
  team,
  action,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  clubs: ClubOption[]
  team?: TeamRow
  action: TeamAction
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (action: TeamAction, formData: FormData) => Promise<void>
}) {
  return (
    <form action={(formData) => onSubmit(action, formData)} className="grid gap-3 md:grid-cols-2">
      {team && <input type="hidden" name="id" value={team.id} />}

      <label className="text-sm font-medium md:col-span-2">
        Club
        <select
          name="clubId"
          required
          defaultValue={team?.clubId ?? clubs[0]?.id}
          className="mt-1 w-full rounded border p-2"
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </label>

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

function DeleteConfirmation({
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
