import type { OnboardingRole, User } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export async function hasExistingAccess(userId: string) {
  const [membershipCount, spectatorAccessCount] = await Promise.all([
    prisma.clubMembership.count({ where: { userId } }),
    prisma.spectatorAccess.count({ where: { userId } }),
  ])

  return membershipCount > 0 || spectatorAccessCount > 0
}

export function isOnboardingComplete(user: User) {
  return user.onboardingCompletedAt !== null
}

export async function completeOnboarding(userId: string, role: OnboardingRole) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingRole: role,
      onboardingCompletedAt: new Date(),
    },
  })
}

export async function shouldRedirectToOnboarding(user: User) {
  if (isOnboardingComplete(user)) return false
  if (await hasExistingAccess(user.id)) return false

  return true
}
