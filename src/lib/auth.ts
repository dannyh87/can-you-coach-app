import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { getLocalUser } from '@/lib/localUser'
import { prisma } from '@/lib/prisma'

export const isClerkEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)

export async function getCurrentUser() {
  const user = await getOptionalCurrentUser()
  if (!user) redirect('/sign-in')

  return user
}

export async function getOptionalCurrentUser() {
  if (!isClerkEnabled()) {
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
