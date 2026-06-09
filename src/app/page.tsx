import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'

const setupLinks = [
  {
    href: '/club-setup',
    title: 'Club Setup',
    description: 'Manage your club details and teams in one place.',
  },
  {
    href: '/players',
    title: 'Players',
    description: 'Add, edit, archive and restore players inside teams.',
  },
  {
    href: '/fitness',
    title: 'Fitness',
    description: 'Create and review fitness test sessions for teams.',
  },
  {
    href: '/match-day',
    title: 'Match Day',
    description: 'Set up matches, track substitutions and record key events.',
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center p-6">
      <PageHeader
        eyebrow="Can You Coach"
        title="Coach tools for the week ahead"
        description="Start with your club and players, then run fitness sessions or manage match day from one place."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {setupLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <h2 className="text-xl font-bold text-slate-950">{link.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
