import { prisma } from '@/lib/prisma'
import { getRoleTesterSelectedEmail, LOCAL_COACH_EMAIL } from '@/lib/roleTester'

export async function getLocalUser() {
  const selectedEmail = await getRoleTesterSelectedEmail()
  const email = selectedEmail ?? LOCAL_COACH_EMAIL

  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: 'local-mvp-user',
    },
  })
}

export async function ensureDefaultClub(userId: string) {
  const existingClub = await prisma.club.findFirst({
    where: { userId },
  })

  if (existingClub) {
    await prisma.clubMembership.upsert({
      where: {
        userId_clubId: {
          userId,
          clubId: existingClub.id,
        },
      },
      update: { role: 'OWNER' },
      create: {
        userId,
        clubId: existingClub.id,
        role: 'OWNER',
      },
    })
    return
  }

  const club = await prisma.club.create({
    data: {
      userId,
      name: 'Demo Club',
    },
  })

  await prisma.clubMembership.create({
    data: {
      userId,
      clubId: club.id,
      role: 'OWNER',
    },
  })
}
