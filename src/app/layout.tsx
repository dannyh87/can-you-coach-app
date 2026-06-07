import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const navigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/club-setup', label: 'Club Setup' },
  { href: '/players', label: 'Players' },
  { href: '/fitness', label: 'Fitness' },
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
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <header className="border-b bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-bold">
              Can You Coach
            </Link>

            <nav className="flex flex-wrap gap-2 text-sm">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded border px-3 py-2 font-medium text-gray-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  )
}
