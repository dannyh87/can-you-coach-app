'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ActionResult = { ok: true; inviteLink?: string } | { ok: false; reason: string }
type StaffRole = 'OWNER' | 'COACH' | 'ASSISTANT_COACH'
type InviteType = 'TEAM_COACH' | 'TEAM_ASSISTANT' | 'PLAYER_PARENT' | 'PLAYER_SPECTATOR'

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
  pendingInvites: Array<{
    id: string
    email: string
    type: InviteType
    targetName: string
    expiresAt: string
    inviteLink: string
  }>
}

const roleDescriptions = [
  { role: 'Club Admin', description: 'Full club setup, users, teams and players.' },
  { role: 'Coach', description: 'Manage assigned teams and create/manage sessions.' },
  { role: 'Assistant Coach', description: 'Record and help with assigned teams.' },
  { role: 'Parent Contributor', description: 'Linked-player-only access. No club membership.' },
]

type ClubAccessClientProps = {
  clubs: ClubAccessRow[]
  addStaffAccessAction: (formData: FormData) => Promise<ActionResult>
  updateStaffAccessAction: (formData: FormData) => Promise<ActionResult>
  removeStaffAccessAction: (formData: FormData) => Promise<ActionResult>
  addParentAccessAction: (formData: FormData) => Promise<ActionResult>
  removeParentAccessAction: (formData: FormData) => Promise<ActionResult>
  revokePendingInviteAction: (formData: FormData) => Promise<ActionResult>
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
  revokePendingInviteAction,
}: ClubAccessClientProps) {
  const router = useRouter()
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id ?? '')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null)
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
    setGeneratedInviteLink(null)

    const result = await action(new FormData(form))

    if (result.ok) {
      setMessage(successMessage)
      if (result.inviteLink) setGeneratedInviteLink(result.inviteLink)
      if (resetOnSuccess) form.reset()
      router.refresh()
    } else {
      setError(result.reason)
    }

    setPendingAction(null)
  }

  if (clubs.length === 0) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
        <h2 className="text-xl font-bold">No club admin access</h2>
        <p className="mt-2 text-sm">
          Only Club Admins can manage staff and parent links. Ask a Club Admin to update your access.
        </p>
        <Link href="/" className="mt-4 inline-flex rounded-lg bg-amber-800 px-4 py-2 text-sm font-bold text-white hover:bg-amber-900">
          Back to home
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{message}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {generatedInviteLink && <CopyInviteLink inviteLink={generatedInviteLink} />}

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
            <h2 className="text-xl font-bold text-slate-950">Invite staff access</h2>
            <p className="mt-1 text-sm text-slate-600">Generate a copyable invite link. Access is added only after the invited email signs in and accepts.</p>
            <RoleHelp />
            <form
              className="mt-4 grid gap-3 md:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault()
                runAction({
                  form: event.currentTarget,
                  action: addStaffAccessAction,
                  pendingLabel: 'add-staff',
                  successMessage: 'Staff invite link generated.',
                  resetOnSuccess: true,
                })
              }}
            >
              <input type="hidden" name="clubId" value={selectedClub.id} />
              <label className="text-sm font-semibold text-slate-700">
                Email
                <input name="email" type="email" className="mt-1 w-full rounded-lg border px-3 py-2" required />
              </label>
              <StaffInviteRoleSelect />
              <TeamSelect teams={selectedClub.teams} />
              <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-3" disabled={Boolean(pendingAction)}>
                {pendingAction === 'add-staff' ? 'Generating...' : 'Generate staff invite'}
              </button>
            </form>
          </section>

          <PendingInvitesSection
            invites={selectedClub.pendingInvites}
            pendingAction={pendingAction}
            revokePendingInviteAction={revokePendingInviteAction}
            runAction={runAction}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-bold text-slate-950">Staff access</h2>
            <p className="mt-1 text-sm text-slate-600">
              The current Club Admin/Owner already has access. Add coaches and assistants when they need their own login.
            </p>
            <div className="mt-4 space-y-3">
              {selectedClub.staff.length <= 1 && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  No other staff added yet.
                </p>
              )}
              {selectedClub.staff.map((staff) => (
                <article key={staff.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{staff.email}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatRole(staff.role)}</p>
                      <TeamAssignmentSummary staff={staff} teams={selectedClub.teams} />
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
                        if (!window.confirm(`Remove staff access for ${staff.email}?`)) return
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
            <h2 className="text-xl font-bold text-slate-950">Invite parent or spectator</h2>
            <p className="mt-1 text-sm text-slate-600">Generate a copyable invite link. Parent and spectator invites link to one player only and do not create club membership.</p>
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
              <p className="font-bold">Parent contributors are read-only for now.</p>
              <p className="mt-1 text-blue-900">
                They can view linked player information in My Player. They cannot see full squad data, edit setup, score, substitutions, fitness data or admin settings. Parent event recording will be added later.
              </p>
            </div>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                runAction({
                  form: event.currentTarget,
                  action: addParentAccessAction,
                  pendingLabel: 'add-parent',
                  successMessage: 'Player invite link generated.',
                  resetOnSuccess: true,
                })
              }}
            >
              <input type="hidden" name="clubId" value={selectedClub.id} />
              <label className="text-sm font-semibold text-slate-700">
                Parent email
                <input name="email" type="email" className="mt-1 w-full rounded-lg border px-3 py-2" required />
              </label>
              <PlayerInviteTypeSelect />
              <PlayerSelect teams={selectedClub.teams} />
              <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2" disabled={Boolean(pendingAction)}>
                {pendingAction === 'add-parent' ? 'Generating...' : 'Generate player invite'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-xl font-bold text-slate-950">Parent contributor links</h2>
            {selectedClub.parentLinks.length === 0 ? (
              <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                No parent contributors linked yet. Add a parent by email and choose one or more players.
              </p>
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
                        if (!window.confirm(`Remove parent/player link for ${link.email} and ${link.playerName}?`)) return
                        runAction({
                          form: event.currentTarget,
                          action: removeParentAccessAction,
                          pendingLabel: `remove-parent:${link.id}`,
                          successMessage: 'Parent/player link removed.',
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

function StaffInviteRoleSelect() {
  return (
    <label className="text-sm font-semibold text-slate-700">
      Role
      <select name="role" defaultValue="COACH" className="mt-1 w-full rounded-lg border px-3 py-2">
        <option value="COACH">Coach</option>
        <option value="ASSISTANT_COACH">Assistant Coach</option>
      </select>
    </label>
  )
}

function PlayerInviteTypeSelect() {
  return (
    <label className="text-sm font-semibold text-slate-700">
      Invite type
      <select name="type" defaultValue="PLAYER_PARENT" className="mt-1 w-full rounded-lg border px-3 py-2">
        <option value="PLAYER_PARENT">Parent</option>
        <option value="PLAYER_SPECTATOR">Spectator</option>
      </select>
    </label>
  )
}

function RoleHelp() {
  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
      {roleDescriptions.map((roleDescription) => (
        <div key={roleDescription.role}>
          <p className="font-bold text-slate-950">{roleDescription.role}</p>
          <p className="text-slate-600">{roleDescription.description}</p>
        </div>
      ))}
    </div>
  )
}

function TeamAssignmentSummary({
  staff,
  teams,
}: {
  staff: ClubAccessRow['staff'][number]
  teams: ClubAccessRow['teams']
}) {
  if (staff.role === 'OWNER') {
    return <p className="mt-2 text-xs font-bold text-green-700">All teams</p>
  }

  if (staff.teamIds.length === 0) {
    return <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">No teams assigned</p>
  }

  const teamNames = teams
    .filter((team) => staff.teamIds.includes(team.id))
    .map((team) => team.name)

  return (
    <p className="mt-2 text-xs text-slate-500">
      {teamNames.length <= 2 ? teamNames.join(', ') : `${teamNames.length} assigned teams`}
    </p>
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
      <p className="mt-1 text-xs text-slate-500">Team selection applies to Coach and Assistant Coach. Club Admins automatically get all teams.</p>
      {teams.length === 0 && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Create teams before assigning staff to specific teams.
        </p>
      )}
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

function TeamSelect({ teams }: { teams: ClubAccessRow['teams'] }) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      Assigned team
      {teams.length === 0 ? (
        <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Create teams before inviting staff.
        </p>
      ) : (
        <select name="teamId" required className="mt-1 w-full rounded-lg border px-3 py-2">
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      )}
    </label>
  )
}

function PlayerSelect({ teams }: { teams: ClubAccessRow['teams'] }) {
  const players = teams.flatMap((team) =>
    team.players.map((player) => ({
      ...player,
      teamName: team.name,
    }))
  )

  return (
    <label className="text-sm font-semibold text-slate-700 md:col-span-2">
      Linked player
      {players.length === 0 ? (
        <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Add active players before inviting parents or spectators.
        </p>
      ) : (
        <select name="playerId" required className="mt-1 w-full rounded-lg border px-3 py-2">
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.teamName} - {player.squadNumber === null ? '' : `#${player.squadNumber} `}{player.name}
            </option>
          ))}
        </select>
      )}
    </label>
  )
}

function CopyInviteLink({ inviteLink }: { inviteLink: string }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
      <p className="font-bold">Copy this invite link</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input readOnly value={inviteLink} className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-slate-900" />
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(inviteLink)}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          Copy
        </button>
      </div>
    </div>
  )
}

function PendingInvitesSection({
  invites,
  pendingAction,
  revokePendingInviteAction,
  runAction,
}: {
  invites: ClubAccessRow['pendingInvites']
  pendingAction: string | null
  revokePendingInviteAction: (formData: FormData) => Promise<ActionResult>
  runAction: ({
    form,
    action,
    pendingLabel,
    successMessage,
    resetOnSuccess,
  }: {
    form: HTMLFormElement
    action: (formData: FormData) => Promise<ActionResult>
    pendingLabel: string
    successMessage: string
    resetOnSuccess?: boolean
  }) => Promise<void>
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-xl font-bold text-slate-950">Pending invites</h2>
      <p className="mt-1 text-sm text-slate-600">Copy links or revoke pending invites. Accepted and revoked invites are not shown here.</p>
      {invites.length === 0 ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No pending invites.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {invites.map((invite) => (
            <article key={invite.id} className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{invite.email}</p>
                  <p className="mt-1 text-slate-500">{formatInviteType(invite.type)} · {invite.targetName}</p>
                  <p className="mt-1 text-xs text-slate-500">Expires {formatDate(invite.expiresAt)}</p>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!window.confirm(`Revoke invite for ${invite.email}?`)) return
                    runAction({
                      form: event.currentTarget,
                      action: revokePendingInviteAction,
                      pendingLabel: `revoke-invite:${invite.id}`,
                      successMessage: 'Invite revoked.',
                    })
                  }}
                >
                  <input type="hidden" name="invitationId" value={invite.id} />
                  <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50" disabled={Boolean(pendingAction)}>
                    {pendingAction === `revoke-invite:${invite.id}` ? 'Revoking...' : 'Revoke'}
                  </button>
                </form>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={invite.inviteLink} className="min-w-0 flex-1 rounded-lg border bg-slate-50 px-3 py-2 font-mono text-xs" />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(invite.inviteLink)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  Copy
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function formatInviteType(type: InviteType) {
  if (type === 'TEAM_COACH') return 'Coach'
  if (type === 'TEAM_ASSISTANT') return 'Assistant Coach'
  if (type === 'PLAYER_PARENT') return 'Parent'
  return 'Spectator'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}
