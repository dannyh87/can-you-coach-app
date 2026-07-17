'use client'

import { useClerk } from '@clerk/nextjs'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'

import type { AccessSummary } from '@/lib/accessSummary'

type MobileNavLink = {
  href: string
  label: string
}

type MobileNavGroup = {
  title: string
  links: MobileNavLink[]
}

type MobileNavProps = {
  groups: MobileNavGroup[]
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
  groups,
  showDevTools,
  showAccount,
  accessSummary,
  className,
  buttonLabel,
  ariaLabel,
}: MobileNavProps) {
  const { signOut } = useClerk()
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
  const handleSignOut = () => {
    setIsOpen(false)
    void signOut({ redirectUrl: '/' })
  }
  const menuButtonLabel = isOpen ? 'Close menu' : (buttonLabel ?? 'Open menu')
  const visibleGroups = groups.map((group) => {
    if (group.title === 'Admin' && showDevTools) {
      return {
        ...group,
        links: [...group.links, { href: '/super-admin/dev-tools', label: 'Dev Tools' }],
      }
    }

    return group
  }).filter((group) => {
    if (group.links.length > 0) return true
    if (group.title === 'Account') return Boolean(accessSummary || showAccount)
    return false
  })

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
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
            className="absolute right-3 top-3 max-h-[calc(100vh-1.5rem)] w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl"
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

            <nav className="mt-3 grid gap-4" aria-label="Main menu">
              {visibleGroups.map((group) => (
                <div key={group.title}>
                  <h2 className="px-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    {group.title}
                  </h2>
                  <div className="mt-2 grid gap-2">
                    {group.title === 'Account' && accessSummary && (
                      <div
                        title={accessSummary.title}
                        className={`rounded-2xl border px-4 py-3 text-sm font-bold ${accessBadgeClasses[accessSummary.tone]}`}
                      >
                        {accessSummary.label}
                      </div>
                    )}

                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeMenu}
                        className={`rounded-2xl px-4 py-3 text-base font-bold transition focus-visible:outline-none focus-visible:ring-2 ${link.label === 'Dev Tools'
                          ? 'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-600'
                          : 'text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-emerald-700'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}

                    {group.title === 'Account' && showAccount && (
                      <>
                        <Link
                          href="/sign-in"
                          onClick={closeMenu}
                          className="rounded-2xl bg-emerald-700 px-4 py-3 text-center text-base font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                        >
                          Account
                        </Link>
                        <div className="mt-2 border-t border-slate-100 pt-2">
                          <button
                            type="button"
                            onClick={handleSignOut}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 20 20"
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
                              <path d="M12 6l4 4-4 4" />
                              <path d="M16 10H8" />
                            </svg>
                            Log out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
