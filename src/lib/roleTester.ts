import { cookies } from 'next/headers'

import { isClerkEnabled } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const ROLE_TESTER_COOKIE = 'cyc_role_tester_user_email'
export const LOCAL_COACH_EMAIL = 'local-coach@can-you-coach.local'

export const roleTesterScenarios = [
  {
    key: 'local-coach',
    label: 'Reset to Local Coach',
    email: LOCAL_COACH_EMAIL,
    description: 'Returns to the default local demo user.',
  },
  {
    key: 'club-admin',
    label: 'Act as Club Admin',
    email: 'club-admin@test.can-you-coach.local',
    description: 'OWNER membership for Demo Club. Can manage club setup and access.',
  },
  {
    key: 'coach',
    label: 'Act as Coach',
    email: 'coach@test.can-you-coach.local',
    description: 'COACH membership assigned to one Demo Club team.',
  },
  {
    key: 'assistant',
    label: 'Act as Assistant Coach',
    email: 'assistant@test.can-you-coach.local',
    description: 'ASSISTANT_COACH membership assigned to one Demo Club team.',
  },
  {
    key: 'parent',
    label: 'Act as Parent Contributor',
    email: 'parent@test.can-you-coach.local',
    description: 'Linked to demo players through SpectatorAccess only. No club membership.',
  },
  {
    key: 'no-access',
    label: 'Act as No Access',
    email: 'no-access@test.can-you-coach.local',
    description: 'User row only. No club membership and no linked players.',
  },
] as const

export function isRoleTesterEnabled() {
  return process.env.ENABLE_ROLE_TESTER === 'true'
}

export function canSwitchRoleTesterUser() {
  return isRoleTesterEnabled() && !isClerkEnabled()
}

export async function getRoleTesterSelectedEmail() {
  if (!canSwitchRoleTesterUser()) return null

  const cookieStore = await cookies()
  const selectedEmail = cookieStore.get(ROLE_TESTER_COOKIE)?.value?.trim().toLowerCase()
  const validEmails = new Set<string>(roleTesterScenarios.map((scenario) => scenario.email))

  return selectedEmail && validEmails.has(selectedEmail) ? selectedEmail : null
}

export async function ensureRoleTesterData() {
  const localCoach = await prisma.user.upsert({
    where: { email: LOCAL_COACH_EMAIL },
    update: {},
    create: { email: LOCAL_COACH_EMAIL, passwordHash: 'local-mvp-user' },
  })

  let club = await prisma.club.findFirst({ where: { name: 'Demo Club' } })
  if (!club) {
    club = await prisma.club.create({
      data: {
        userId: localCoach.id,
        name: 'Demo Club',
        location: 'Local development',
        notes: 'Seeded demo club for role testing.',
      },
    })
  }

  await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId: localCoach.id, clubId: club.id } },
    update: { role: 'OWNER' },
    create: { userId: localCoach.id, clubId: club.id, role: 'OWNER' },
  })

  let team = await prisma.team.findFirst({ where: { clubId: club.id } })
  if (!team) {
    team = await prisma.team.create({
      data: {
        clubId: club.id,
        name: 'Role Tester Team',
        ageGroup: 'Open Age',
        season: '2026',
      },
    })
  }

  const demoPlayers = [
    { firstName: 'Role', surname: 'Tester One', squadNumber: 21, preferredPosition: 'Midfielder' },
    { firstName: 'Role', surname: 'Tester Two', squadNumber: 22, preferredPosition: 'Forward' },
  ]

  const players = []
  for (const demoPlayer of demoPlayers) {
    const existingPlayer = await prisma.player.findFirst({
      where: { teamId: team.id, firstName: demoPlayer.firstName, surname: demoPlayer.surname },
    })

    players.push(
      existingPlayer
        ? await prisma.player.update({ where: { id: existingPlayer.id }, data: { ...demoPlayer, isActive: true } })
        : await prisma.player.create({ data: { ...demoPlayer, teamId: team.id } })
    )
  }

  const clubAdmin = await upsertTestUser('club-admin@test.can-you-coach.local')
  const coach = await upsertTestUser('coach@test.can-you-coach.local')
  const assistant = await upsertTestUser('assistant@test.can-you-coach.local')
  const parent = await upsertTestUser('parent@test.can-you-coach.local')
  await upsertTestUser('no-access@test.can-you-coach.local')

  await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId: clubAdmin.id, clubId: club.id } },
    update: { role: 'OWNER' },
    create: { userId: clubAdmin.id, clubId: club.id, role: 'OWNER' },
  })

  await upsertAssignedMembership({ userId: coach.id, clubId: club.id, teamId: team.id, role: 'COACH' })
  await upsertAssignedMembership({ userId: assistant.id, clubId: club.id, teamId: team.id, role: 'ASSISTANT_COACH' })

  await prisma.clubMembership.deleteMany({ where: { userId: parent.id, clubId: club.id } })
  await prisma.spectatorAccess.createMany({
    data: players.map((player) => ({ userId: parent.id, clubId: club.id, playerId: player.id })),
    skipDuplicates: true,
  })
}

async function upsertTestUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })
}

async function upsertAssignedMembership({
  userId,
  clubId,
  teamId,
  role,
}: {
  userId: string
  clubId: string
  teamId: string
  role: 'COACH' | 'ASSISTANT_COACH'
}) {
  const membership = await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId, clubId } },
    update: { role },
    create: { userId, clubId, role },
  })

  await prisma.teamAssignment.upsert({
    where: { membershipId_teamId: { membershipId: membership.id, teamId } },
    update: {},
    create: { membershipId: membership.id, teamId },
  })
}
