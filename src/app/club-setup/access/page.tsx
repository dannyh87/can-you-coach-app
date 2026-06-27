import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import ClubAccessClient from '@/app/club-setup/access/ClubAccessClient'
import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser, isClerkEnabled } from '@/lib/auth'
import { ensureDefaultClub } from '@/lib/localUser'
import { isOwnerForClub } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const staffRoles = ['OWNER', 'COACH', 'ASSISTANT_COACH'] as const

type AccessActionResult =
  | { ok: true }
  | { ok: false; reason: string }

const getTextValue = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const getSelectedIds = (formData: FormData, key: string) =>
  Array.from(new Set(
    formData
      .getAll(key)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  ))

const normalizeEmail = (email: string) => email.trim().toLowerCase()

async function requireClubOwner(userId: string, clubId: string): Promise<AccessActionResult> {
  if (!clubId) return { ok: false, reason: 'Missing club.' }
  if (!(await isOwnerForClub(userId, clubId))) {
    return { ok: false, reason: 'You cannot manage access for this club.' }
  }

  return { ok: true }
}

async function upsertUserByEmail(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })
}

async function addStaffAccess(formData: FormData): Promise<AccessActionResult> {
  'use server'

  const currentUser = await getCurrentUser()
  const clubId = getTextValue(formData, 'clubId')
  const email = normalizeEmail(getTextValue(formData, 'email'))
  const role = getTextValue(formData, 'role')
  const teamIds = getSelectedIds(formData, 'teamId')

  const permission = await requireClubOwner(currentUser.id, clubId)
  if (!permission.ok) return permission
  if (!email) return { ok: false, reason: 'Email is required.' }
  if (!staffRoles.includes(role as (typeof staffRoles)[number])) {
    return { ok: false, reason: 'Role is invalid.' }
  }

  const validTeams = await prisma.team.findMany({
    where: { clubId, id: { in: teamIds } },
    select: { id: true },
  })
  const validTeamIds = validTeams.map((team) => team.id)
  const user = await upsertUserByEmail(email)

  await prisma.$transaction(async (tx) => {
    const membership = await tx.clubMembership.upsert({
      where: { userId_clubId: { userId: user.id, clubId } },
      update: { role: role as (typeof staffRoles)[number] },
      create: { userId: user.id, clubId, role: role as (typeof staffRoles)[number] },
    })

    await tx.teamAssignment.deleteMany({ where: { membershipId: membership.id } })
    if (role !== 'OWNER') {
      await tx.teamAssignment.createMany({
        data: validTeamIds.map((teamId) => ({ membershipId: membership.id, teamId })),
        skipDuplicates: true,
      })
    }
  })

  revalidatePath('/club-setup/access')
  return { ok: true }
}

async function updateStaffAccess(formData: FormData): Promise<AccessActionResult> {
  'use server'

  const currentUser = await getCurrentUser()
  const membershipId = getTextValue(formData, 'membershipId')
  const role = getTextValue(formData, 'role')
  const teamIds = getSelectedIds(formData, 'teamId')

  if (!membershipId) return { ok: false, reason: 'Missing staff membership.' }
  if (!staffRoles.includes(role as (typeof staffRoles)[number])) {
    return { ok: false, reason: 'Role is invalid.' }
  }

  const membership = await prisma.clubMembership.findUnique({ where: { id: membershipId } })
  if (!membership) return { ok: false, reason: 'Staff access was not found.' }
  const permission = await requireClubOwner(currentUser.id, membership.clubId)
  if (!permission.ok) return permission

  const validTeams = await prisma.team.findMany({
    where: { clubId: membership.clubId, id: { in: teamIds } },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.clubMembership.update({
      where: { id: membership.id },
      data: { role: role as (typeof staffRoles)[number] },
    }),
    prisma.teamAssignment.deleteMany({ where: { membershipId: membership.id } }),
    ...(role === 'OWNER'
      ? []
      : validTeams.map((team) =>
          prisma.teamAssignment.create({ data: { membershipId: membership.id, teamId: team.id } })
        )),
  ])

  revalidatePath('/club-setup/access')
  return { ok: true }
}

async function removeStaffAccess(formData: FormData): Promise<AccessActionResult> {
  'use server'

  const currentUser = await getCurrentUser()
  const membershipId = getTextValue(formData, 'membershipId')

  if (!membershipId) return { ok: false, reason: 'Missing staff membership.' }
  const membership = await prisma.clubMembership.findUnique({ where: { id: membershipId } })
  if (!membership) return { ok: false, reason: 'Staff access was not found.' }
  if (membership.userId === currentUser.id) return { ok: false, reason: 'You cannot remove your own club admin access.' }

  const permission = await requireClubOwner(currentUser.id, membership.clubId)
  if (!permission.ok) return permission

  await prisma.clubMembership.delete({ where: { id: membership.id } })

  revalidatePath('/club-setup/access')
  return { ok: true }
}

async function addParentAccess(formData: FormData): Promise<AccessActionResult> {
  'use server'

  const currentUser = await getCurrentUser()
  const clubId = getTextValue(formData, 'clubId')
  const email = normalizeEmail(getTextValue(formData, 'email'))
  const playerIds = getSelectedIds(formData, 'playerId')

  const permission = await requireClubOwner(currentUser.id, clubId)
  if (!permission.ok) return permission
  if (!email) return { ok: false, reason: 'Email is required.' }
  if (playerIds.length === 0) return { ok: false, reason: 'Select at least one player.' }

  const validPlayers = await prisma.player.findMany({
    where: { id: { in: playerIds }, team: { clubId } },
    select: { id: true },
  })
  if (validPlayers.length === 0) return { ok: false, reason: 'No valid players were selected.' }

  const user = await upsertUserByEmail(email)
  await prisma.spectatorAccess.createMany({
    data: validPlayers.map((player) => ({ userId: user.id, clubId, playerId: player.id })),
    skipDuplicates: true,
  })

  revalidatePath('/club-setup/access')
  return { ok: true }
}

async function removeParentAccess(formData: FormData): Promise<AccessActionResult> {
  'use server'

  const currentUser = await getCurrentUser()
  const spectatorAccessId = getTextValue(formData, 'spectatorAccessId')

  if (!spectatorAccessId) return { ok: false, reason: 'Missing parent link.' }
  const spectatorAccess = await prisma.spectatorAccess.findUnique({ where: { id: spectatorAccessId } })
  if (!spectatorAccess) return { ok: false, reason: 'Parent link was not found.' }

  const permission = await requireClubOwner(currentUser.id, spectatorAccess.clubId)
  if (!permission.ok) return permission

  await prisma.spectatorAccess.delete({ where: { id: spectatorAccess.id } })

  revalidatePath('/club-setup/access')
  return { ok: true }
}

export default async function ClubAccessPage() {
  const user = await getCurrentUser()
  if (!isClerkEnabled()) await ensureDefaultClub(user.id)

  const clubs = await prisma.club.findMany({
    where: {
      memberships: {
        some: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
    include: {
      teams: {
        include: {
          players: {
            where: { isActive: true },
            orderBy: [{ surname: 'asc' }, { firstName: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      },
      memberships: {
        where: { role: { in: ['OWNER', 'COACH', 'ASSISTANT_COACH'] } },
        include: {
          user: true,
          teamAssignments: { include: { team: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      spectators: {
        include: {
          user: true,
          player: { include: { team: true } },
        },
        orderBy: [{ user: { email: 'asc' } }, { player: { surname: 'asc' } }],
      },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/club-setup" className="text-sm font-semibold text-blue-800 hover:underline">
        Back to Club Setup
      </Link>
      <PageHeader
        title="Access Management"
        description="Manage club staff access and read-only parent links. Parent contributors do not get full club access."
      />
      {clubs.length === 0 ? (
        <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">No club admin access</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Create a club before managing access.</h2>
          <p className="mt-2 text-sm text-slate-600">
            Access management is available once you have a club where you are the Club Admin.
          </p>
          <Link
            href="/club-setup"
            className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
          >
            Back to Club Setup
          </Link>
        </section>
      ) : (
      <ClubAccessClient
        clubs={clubs.map((club) => ({
          id: club.id,
          name: club.name,
          teams: club.teams.map((team) => ({
            id: team.id,
            name: team.name,
            players: team.players.map((player) => ({
              id: player.id,
              name: `${player.firstName} ${player.surname}`,
              squadNumber: player.squadNumber,
            })),
          })),
          staff: club.memberships.map((membership) => ({
            id: membership.id,
            userId: membership.userId,
            email: membership.user.email,
            role: membership.role as 'OWNER' | 'COACH' | 'ASSISTANT_COACH',
            isCurrentUser: membership.userId === user.id,
            teamIds: membership.teamAssignments.map((assignment) => assignment.teamId),
          })),
          parentLinks: club.spectators.map((access) => ({
            id: access.id,
            email: access.user.email,
            playerName: `${access.player.firstName} ${access.player.surname}`,
            teamName: access.player.team.name,
          })),
        }))}
        addStaffAccessAction={addStaffAccess}
        updateStaffAccessAction={updateStaffAccess}
        removeStaffAccessAction={removeStaffAccess}
        addParentAccessAction={addParentAccess}
        removeParentAccessAction={removeParentAccess}
      />
      )}
    </main>
  )
}
