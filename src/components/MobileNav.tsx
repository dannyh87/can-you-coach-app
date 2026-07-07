'use client'

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'

import type { AccessSummary } from '@/lib/accessSummary'

type MobileNavLink = {
  href: string
  label: string
}

type MobileNavProps = {
  links: MobileNavLink[]
  showDevTools: boolean
  showAccount: boolean
  accessSummary?: AccessSummary | null
  className?: string
  buttonLabel?: string
  ariaLabel?: string
}

const accessBadgeClasses: Record<AccessSummary['tone'], string> = {
  slate: 'border-slate-200 bg-white text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  purple: 'border-purple-200 bg-purple-50 text-purple-800',
}

export default function MobileNav({
  links,
  showDevTools,
  showAccount,
  accessSummary,
  className,
  buttonLabel,
  ariaLabel,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const closeMenu = () => setIsOpen(false)
  const menuButtonLabel = isOpen ? 'Close menu' : (buttonLabel ?? 'Open menu')

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={isOpen ? 'Close navigation menu' : (ariaLabel ?? 'Open navigation menu')}
      >
        <span className={buttonLabel ? '' : 'sr-only'}>{menuButtonLabel}</span>
        <span className="flex flex-col gap-1.5" aria-hidden="true">
          <span className={`h-0.5 w-5 rounded-full bg-current transition ${isOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`h-0.5 w-5 rounded-full bg-current transition ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`h-0.5 w-5 rounded-full bg-current transition ${isOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={closeMenu}
          />

          <div
            id={menuId}
            className="absolute right-3 top-3 w-[min(22rem,calc(100vw-1.5rem))] rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-sm font-extrabold text-slate-950">Can You Coach</p>
                <p className="text-xs font-medium text-slate-500">Navigation</p>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                Close
              </button>
            </div>

            {accessSummary && (
              <div
                title={accessSummary.title}
                className={`mt-3 rounded-2xl border px-3 py-2 text-sm font-bold ${accessBadgeClasses[accessSummary.tone]}`}
              >
                {accessSummary.label}
              </div>
            )}

            <nav className="mt-3 grid gap-2" aria-label="Mobile navigation">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="rounded-2xl px-4 py-3 text-base font-bold text-slate-800 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  {link.label}
                </Link>
              ))}

              {showDevTools && (
                <Link
                  href="/super-admin/dev-tools"
                  onClick={closeMenu}
                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-bold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  Dev Tools
                </Link>
              )}

              {showAccount && (
                <Link
                  href="/sign-in"
                  onClick={closeMenu}
                  className="rounded-2xl bg-emerald-700 px-4 py-3 text-center text-base font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  Account
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
