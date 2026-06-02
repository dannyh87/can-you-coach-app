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
  const existingClubCount = await prisma.club.count({
    where: { userId },
  })

  if (existingClubCount > 0) return

  await prisma.club.create({
    data: {
      userId,
      name: 'Demo Club',
    },
  })
}
