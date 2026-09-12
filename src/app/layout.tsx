import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { getOptionalCurrentUser, isClerkEnabled } from '@/lib/auth'
import { getCurrentAccessSummary } from '@/lib/accessSummary'
import { prisma } from '@/lib/prisma'
import { isRoleTesterEnabled } from '@/lib/roleTester'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import BrandLogo from '@/components/BrandLogo'
import MobileNav from '@/components/MobileNav'
import NotificationBell from '@/components/NotificationBell'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const metadataBase = new URL(process.env.APP_URL || 'http://localhost:3000')

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
  metadataBase,
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
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      {
        url: '/brand/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  openGraph: {
    title: 'Can You Coach',
    description: 'Track. Learn. Improve.',
    images: [{ url: '/brand/social-preview.png', width: 1200, height: 630, alt: 'Can You Coach' }],
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
    ? [
        { href: '/super-admin/events', label: 'Event Library' },
        ...(isMatchDayTrackingV2Enabled() ? [{ href: '/super-admin/tracking-mappings', label: 'Mapping Review' }] : []),
      ]
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
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(7,42,72,0.06)]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
            <Link href="/" className="inline-flex min-w-0 shrink-0 items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-teal)] focus-visible:ring-offset-2" aria-label="Can You Coach home">
              <BrandLogo variant="lockup" priority />
            </Link>

            <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
              <NotificationBell userId={user?.id ?? null} />
              <MobileNav
                groups={navigationGroups}
                showDevTools={isRoleTesterEnabled()}
                showAccount={isClerkEnabled()}
                accessSummary={accessSummary}
                className="shrink-0"
                ariaLabel="Open menu"
              />
            </div>
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
