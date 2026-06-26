import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

export const isClerkEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)

const isProductionBuild = () => process.env.NEXT_PHASE === 'phase-production-build'

export const isLocalAuthFallbackEnabled = () =>
  !isClerkEnabled() && process.env.NODE_ENV !== 'production'

export async function getCurrentUser() {
  const user = await getOptionalCurrentUser()
  if (!user) redirect('/sign-in')

  return user
}

export async function getOptionalCurrentUser() {
  if (!isClerkEnabled()) {
    if (isProductionBuild()) return null

    if (!isLocalAuthFallbackEnabled()) {
      throw new Error(
        'Clerk authentication is not configured. Production requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.'
      )
    }

    return getLocalUser()
  }

  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email = clerkUser.primaryEmailAddress?.emailAddress
  if (!email) {
    throw new Error('Authenticated Clerk user must have a primary email address.')
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ clerkUserId: clerkUser.id }, { email }],
    },
  })

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        clerkUserId: existingUser.clerkUserId ?? clerkUser.id,
        email,
      },
    })
  }

  return prisma.user.create({
    data: {
      clerkUserId: clerkUser.id,
      email,
    },
  })
}
