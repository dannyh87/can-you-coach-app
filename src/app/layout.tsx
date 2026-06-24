import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { isClerkEnabled } from '@/lib/auth'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const navigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/club-setup', label: 'Club Setup' },
  { href: '/players', label: 'Players' },
  { href: '/fitness', label: 'Fitness' },
  { href: '/match-day', label: 'Match Day' },
  // TODO: Only show this link for users who pass canManageGlobalEventLibrary once nav is user-aware.
  { href: '/super-admin/events', label: 'Super Admin' },
]

export const metadata: Metadata = {
  title: 'Can You Coach',
  description: 'Track. Learn. Improve.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const body = (
    <html lang="en">
      <body className={`${inter.className} min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 antialiased`}>
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">
              Can You Coach
            </Link>

            <div className="flex items-center gap-3">
              <nav
                className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0"
                aria-label="Main navigation"
              >
                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="shrink-0 rounded-full px-3 py-2 font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {isClerkEnabled() && (
                <Link
                  href="/sign-in"
                  className="shrink-0 rounded-full bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Account
                </Link>
              )}
            </div>
          </div>
        </header>

        {children}
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
