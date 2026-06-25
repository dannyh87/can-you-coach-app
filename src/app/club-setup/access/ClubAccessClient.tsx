'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ActionResult = { ok: true } | { ok: false; reason: string }
type StaffRole = 'OWNER' | 'COACH' | 'ASSISTANT_COACH'

type ClubAccessRow = {
  id: string
  name: string
  teams: Array<{
    id: string
    name: string
    players: Array<{ id: string; name: string; squadNumber: number | null }>
  }>
  staff: Array<{
    id: string
    userId: string
    email: string
    role: StaffRole
    isCurrentUser: boolean
    teamIds: string[]
  }>
  parentLinks: Array<{
    id: string
    email: string
    playerName: string
    teamName: string
  }>
}

type ClubAccessClientProps = {
  clubs: ClubAccessRow[]
  addStaffAccessAction: (formData: FormData) => Promise<ActionResult>
  updateStaffAccessAction: (formData: FormData) => Promise<ActionResult>
  removeStaffAccessAction: (formData: FormData) => Promise<ActionResult>
  addParentAccessAction: (formData: FormData) => Promise<ActionResult>
  removeParentAccessAction: (formData: FormData) => Promise<ActionResult>
}

const formatRole = (role: StaffRole) => {
  if (role === 'OWNER') return 'Club Admin'
  if (role === 'COACH') return 'Coach'
  return 'Assistant Coach'
}

export default function ClubAccessClient({
  clubs,
  addStaffAccessAction,
  updateStaffAccessAction,
  removeStaffAccessAction,
  addParentAccessAction,
  removeParentAccessAction,
}: ClubAccessClientProps) {
  const router = useRouter()
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id ?? '')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? clubs[0]

  const runAction = async ({
    form,
    action,
    pendingLabel,
    successMessage,
    resetOnSuccess = false,
  }: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => {
    if (pendingAction) return

    setPendingAction(pendingLabel)
    setMessage(null)
    setError(null)

    const result = await action(new FormData(form))

    if (result.ok) {
      setMessage(successMessage)
      if (resetOnSuccess) form.reset()
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  if (clubs.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        You need Club Admin access to manage users.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{message}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <label className="block text-sm font-semibold text-slate-700">
        Club
        <select
          value={selectedClubId}
          onChange={(event) => setSelectedClubId(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2"
        >
          {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </label>

      {selectedClub && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-bold text-slate-950">Add staff access</h2>
            <p className="mt-1 text-sm text-slate-600">Staff users get club/team permissions through club membership.</p>
            <form
              className="mt-4 grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault()
                runAction({
                  form: event.currentTarget,
                  action: addStaffAccessAction,
                  pendingLabel: 'add-staff',
                  successMessage: 'Staff access saved.',
                  resetOnSuccess: true,
                })
              }}
            >
              <input type="hidden" name="clubId" value={selectedClub.id} />
              <label className="text-sm font-semibold text-slate-700">
                Email
                <input name="email" type="email" className="mt-1 w-full rounded-lg border px-3 py-2" required />
              </label>
              <RoleSelect defaultValue="COACH" />
              <TeamCheckboxes teams={selectedClub.teams} selectedTeamIds={[]} />
              <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-3" disabled={Boolean(pendingAction)}>
                {pendingAction === 'add-staff' ? 'Saving...' : 'Add staff user'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-bold text-slate-950">Staff access</h2>
            <div className="mt-4 space-y-3">
              {selectedClub.staff.map((staff) => (
                <article key={staff.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{staff.email}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatRole(staff.role)}</p>
                    </div>
                    {staff.isCurrentUser && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">You</span>}
                  </div>
                  <details className="mt-3 rounded-lg bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-bold">Edit access</summary>
                    <form
                      className="mt-3 grid gap-3 md:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        runAction({
                          form: event.currentTarget,
                          action: updateStaffAccessAction,
                          pendingLabel: `update-staff:${staff.id}`,
                          successMessage: 'Staff access updated.',
                        })
                      }}
                    >
                      <input type="hidden" name="membershipId" value={staff.id} />
                      <RoleSelect defaultValue={staff.role} />
                      <TeamCheckboxes teams={selectedClub.teams} selectedTeamIds={staff.teamIds} />
                      <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2" disabled={Boolean(pendingAction)}>
                        {pendingAction === `update-staff:${staff.id}` ? 'Saving...' : 'Save staff access'}
                      </button>
                    </form>
                    <form
                      className="mt-3"
                      onSubmit={(event) => {
                        event.preventDefault()
                        runAction({
                          form: event.currentTarget,
                          action: removeStaffAccessAction,
                          pendingLabel: `remove-staff:${staff.id}`,
                          successMessage: 'Staff access removed.',
                        })
                      }}
                    >
                      <input type="hidden" name="membershipId" value={staff.id} />
                      <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50" disabled={Boolean(pendingAction) || staff.isCurrentUser}>
                        {pendingAction === `remove-staff:${staff.id}` ? 'Removing...' : 'Remove staff access'}
                      </button>
                    </form>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-bold text-slate-950">Add parent contributor</h2>
            <p className="mt-1 text-sm text-slate-600">Parent contributors are linked to players only. They do not receive club membership.</p>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                runAction({
                  form: event.currentTarget,
                  action: addParentAccessAction,
                  pendingLabel: 'add-parent',
                  successMessage: 'Parent player links saved.',
                  resetOnSuccess: true,
                })
              }}
            >
              <input type="hidden" name="clubId" value={selectedClub.id} />
              <label className="text-sm font-semibold text-slate-700">
                Parent email
                <input name="email" type="email" className="mt-1 w-full rounded-lg border px-3 py-2" required />
              </label>
              <PlayerCheckboxes teams={selectedClub.teams} />
              <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2" disabled={Boolean(pendingAction)}>
                {pendingAction === 'add-parent' ? 'Saving...' : 'Link parent to players'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-bold text-slate-950">Parent contributor links</h2>
            {selectedClub.parentLinks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No parent contributors linked yet.</p>
            ) : (
              <div className="mt-4 divide-y rounded-xl border border-slate-200">
                {selectedClub.parentLinks.map((link) => (
                  <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-bold text-slate-950">{link.email}</p>
                      <p className="text-slate-500">{link.playerName} · {link.teamName}</p>
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        runAction({
                          form: event.currentTarget,
                          action: removeParentAccessAction,
                          pendingLabel: `remove-parent:${link.id}`,
                          successMessage: 'Parent player link removed.',
                        })
                      }}
                    >
                      <input type="hidden" name="spectatorAccessId" value={link.id} />
                      <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50" disabled={Boolean(pendingAction)}>
                        {pendingAction === `remove-parent:${link.id}` ? 'Removing...' : 'Remove link'}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function RoleSelect({ defaultValue }: { defaultValue: StaffRole }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      Role
      <select name="role" defaultValue={defaultValue} className="mt-1 w-full rounded-lg border px-3 py-2">
        <option value="OWNER">Club Admin</option>
        <option value="COACH">Coach</option>
        <option value="ASSISTANT_COACH">Assistant Coach</option>
      </select>
    </label>
  )
}

function TeamCheckboxes({
  teams,
  selectedTeamIds,
}: {
  teams: ClubAccessRow['teams']
  selectedTeamIds: string[]
}) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="text-sm font-bold text-slate-700">Assigned teams</legend>
      <p className="mt-1 text-xs text-slate-500">Club Admins get all teams. Coaches and assistants use selected teams.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {teams.map((team) => (
          <label key={team.id} className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm">
            <input type="checkbox" name="teamId" value={team.id} defaultChecked={selectedTeamIds.includes(team.id)} />
            {team.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function PlayerCheckboxes({ teams }: { teams: ClubAccessRow['teams'] }) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="text-sm font-bold text-slate-700">Linked players</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="rounded-xl border border-slate-200 p-3">
            <p className="font-bold text-slate-950">{team.name}</p>
            <div className="mt-2 grid gap-2">
              {team.players.map((player) => (
                <label key={player.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="playerId" value={player.id} />
                  <span>{player.squadNumber === null ? '' : `#${player.squadNumber} `}{player.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  )
}
