import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { getOptionalCurrentUser, isClerkEnabled } from '@/lib/auth'
import { getCurrentAccessSummary } from '@/lib/accessSummary'
import { prisma } from '@/lib/prisma'
import { isRoleTesterEnabled } from '@/lib/roleTester'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import MobileNav from '@/components/MobileNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

type NavigationLink = {
  href: string
  label: string
}

const mainNavigationLinks: NavigationLink[] = [
  { href: '/', label: 'Home' },
  { href: '/how-to-use', label: 'How to use' },
]

const reportsNavigationLink = { href: '/reports', label: 'Reports' }

const coachingNavigationLinks: NavigationLink[] = [
  { href: '/players', label: 'Players' },
  { href: '/fitness', label: 'Fitness' },
  { href: '/match-day', label: 'Match Day' },
]

const clubNavigationLinks: NavigationLink[] = [
  { href: '/club-setup', label: 'Club Setup' },
]

const parentNavigationLinks: NavigationLink[] = [
  { href: '/my-player', label: 'My Player' },
  { href: '/my-player/matches', label: 'Match Observations' },
]

async function getNavigationProfile(user: Awaited<ReturnType<typeof getOptionalCurrentUser>>) {
  if (!user) {
    return {
      mainLinks: mainNavigationLinks,
      coachingLinks: [] as NavigationLink[],
      clubLinks: [] as NavigationLink[],
    }
  }

  const [memberships, parentLinkCount] = await Promise.all([
    prisma.clubMembership.findMany({
      where: { userId: user.id },
      select: { role: true, teamAssignments: { select: { teamId: true } } },
    }),
    prisma.spectatorAccess.count({ where: { userId: user.id } }),
  ])
  const hasOwnerAccess = memberships.some((membership) => membership.role === 'OWNER')
  const hasCoachAccess = memberships.some((membership) => membership.role === 'COACH')
  const hasAssistantAccess = memberships.some((membership) => membership.role === 'ASSISTANT_COACH')
  const hasClubAccess = memberships.length > 0
  const hasParentAccess = parentLinkCount > 0
  const hasTeamAccess = memberships.some((membership) =>
    membership.role === 'OWNER' || membership.teamAssignments.length > 0
  )
  const isParentOnly = hasParentAccess && !hasClubAccess
  const isNoAccess = !hasParentAccess && !hasClubAccess
  const canUseCoachingRoutes = hasOwnerAccess || hasCoachAccess || hasAssistantAccess || hasTeamAccess

  if (isParentOnly) {
    return {
      mainLinks: mainNavigationLinks,
      coachingLinks: parentNavigationLinks,
      clubLinks: [] as NavigationLink[],
    }
  }

  if (isNoAccess) {
    return {
      mainLinks: [
        ...mainNavigationLinks,
        { href: '/onboarding', label: 'Onboarding' },
      ],
      coachingLinks: [] as NavigationLink[],
      clubLinks: user.onboardingRole === 'CLUB_OFFICIAL' || user.onboardingRole === null
        ? clubNavigationLinks
        : [],
    }
  }

  return {
    mainLinks: canUseCoachingRoutes ? [...mainNavigationLinks, reportsNavigationLink] : mainNavigationLinks,
    coachingLinks: canUseCoachingRoutes ? coachingNavigationLinks : [] as NavigationLink[],
    clubLinks: hasOwnerAccess ? clubNavigationLinks : [] as NavigationLink[],
  }
}

export const metadata: Metadata = {
  title: 'Can You Coach',
  description: 'Track. Learn. Improve.',
  applicationName: 'Can You Coach',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Can You Coach',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      {
        url: '/icons/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: [
      {
        url: '/icons/icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#172554',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getOptionalCurrentUser()
  const [accessSummary, navigationProfile] = await Promise.all([
    user ? getCurrentAccessSummary(user) : null,
    getNavigationProfile(user),
  ])
  const adminNavigationLinks = user && canManageGlobalEventLibrary(user)
    ? [{ href: '/super-admin/events', label: 'Super Admin' }]
    : []
  const navigationGroups = [
    { title: 'Main', links: navigationProfile.mainLinks },
    { title: 'Coaching', links: navigationProfile.coachingLinks },
    { title: 'Club', links: navigationProfile.clubLinks },
    { title: 'Admin', links: adminNavigationLinks },
    { title: 'Account', links: [] },
  ]
  const body = (
    <html lang="en">
      <body className={`${inter.className} min-h-screen overflow-x-hidden text-slate-950 antialiased`}>
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="inline-flex shrink-0 items-center gap-2 text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-700 text-sm font-black text-white shadow-sm">
                CYC
              </span>
              <span className="whitespace-nowrap">Can You Coach</span>
            </Link>

            <MobileNav
              groups={navigationGroups}
              showDevTools={isRoleTesterEnabled()}
              showAccount={isClerkEnabled()}
              accessSummary={accessSummary}
              className="shrink-0"
              buttonLabel="Menu"
              ariaLabel="Open menu"
            />
          </div>
        </header>

        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )

  if (!isClerkEnabled()) return body

  return (
    <ClerkProvider signUpUrl="/sign-up">
      {body}
    </ClerkProvider>
  )
}
