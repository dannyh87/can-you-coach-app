import { prisma } from '@/lib/prisma'

const LOCAL_USER_EMAIL = 'local-coach@can-you-coach.local'

export async function getLocalUser() {
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: {
      email: LOCAL_USER_EMAIL,
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
