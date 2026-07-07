import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { getOptionalCurrentUser, isClerkEnabled } from '@/lib/auth'
import { getCurrentAccessSummary } from '@/lib/accessSummary'
import { isRoleTesterEnabled } from '@/lib/roleTester'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import MobileNav from '@/components/MobileNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const primaryNavigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/how-to-use', label: 'How to use' },
  { href: '/players', label: 'Players' },
  { href: '/fitness', label: 'Fitness' },
  { href: '/match-day', label: 'Match Day' },
]

const secondaryNavigationLinks = [
  { href: '/reports', label: 'Reports' },
  { href: '/club-setup', label: 'Club Setup' },
]

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
  const accessSummary = user ? await getCurrentAccessSummary(user) : null
  const userSecondaryNavigationLinks = user && canManageGlobalEventLibrary(user)
    ? [...secondaryNavigationLinks, { href: '/super-admin/events', label: 'Super Admin' }]
    : secondaryNavigationLinks
  const mobileNavigationLinks = [...primaryNavigationLinks, ...userSecondaryNavigationLinks]
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
              links={mobileNavigationLinks}
              showDevTools={isRoleTesterEnabled()}
              showAccount={isClerkEnabled()}
              accessSummary={accessSummary}
              className="lg:hidden"
            />

            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <nav
                className="flex items-center gap-1 whitespace-nowrap text-sm"
                aria-label="Main navigation"
              >
                {primaryNavigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="shrink-0 rounded-full px-2.5 py-2 font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <MobileNav
                links={userSecondaryNavigationLinks}
                showDevTools={isRoleTesterEnabled()}
                showAccount={isClerkEnabled()}
                accessSummary={accessSummary}
                className="hidden lg:block"
                buttonLabel="Menu"
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
    <ClerkProvider signUpUrl="/sign-in">
      {body}
    </ClerkProvider>
  )
}
