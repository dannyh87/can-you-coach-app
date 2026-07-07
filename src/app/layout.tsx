import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { getOptionalCurrentUser, isClerkEnabled } from '@/lib/auth'
import { getCurrentAccessSummary, type AccessSummary } from '@/lib/accessSummary'
import { isRoleTesterEnabled } from '@/lib/roleTester'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import MobileNav from '@/components/MobileNav'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const navigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/club-setup', label: 'Club Setup' },
  { href: '/players', label: 'Players' },
  { href: '/fitness', label: 'Fitness' },
  { href: '/match-day', label: 'Match Day' },
  { href: '/how-to-use', label: 'How to use' },
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

const accessBadgeClasses: Record<AccessSummary['tone'], string> = {
  slate: 'border-slate-200 bg-white text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  purple: 'border-purple-200 bg-purple-50 text-purple-800',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getOptionalCurrentUser()
  const accessSummary = user ? await getCurrentAccessSummary(user) : null
  const userNavigationLinks = user && canManageGlobalEventLibrary(user)
    ? [...navigationLinks, { href: '/super-admin/events', label: 'Super Admin' }]
    : navigationLinks
  const body = (
    <html lang="en">
      <body className={`${inter.className} min-h-screen overflow-x-hidden text-slate-950 antialiased`}>
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-700 text-sm font-black text-white shadow-sm">
                CYC
              </span>
              <span>Can You Coach</span>
            </Link>

            <MobileNav
              links={userNavigationLinks}
              showDevTools={isRoleTesterEnabled()}
              showAccount={isClerkEnabled()}
              accessSummary={accessSummary}
            />

            <div className="hidden items-center gap-3 md:flex">
              <nav
                className="flex flex-wrap gap-1 text-sm"
                aria-label="Main navigation"
              >
                {userNavigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="shrink-0 rounded-full px-3 py-2 font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {isRoleTesterEnabled() && (
                <Link
                  href="/super-admin/dev-tools"
                  className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 sm:text-sm"
                >
                  Dev Tools
                </Link>
              )}

              {accessSummary && (
                <span
                  title={accessSummary.title}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${accessBadgeClasses[accessSummary.tone]}`}
                >
                  {accessSummary.label}
                </span>
              )}

              {isClerkEnabled() && (
                <Link
                  href="/sign-in"
                  className="shrink-0 rounded-full bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Account
                </Link>
              )}
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
