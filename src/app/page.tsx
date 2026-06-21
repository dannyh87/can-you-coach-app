import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'

const setupLinks = [
  {
    href: '/club-setup',
    title: 'Set up your club',
    description: 'Add clubs and teams so every player, test and match sits in the right place.',
  },
  {
    href: '/players',
    title: 'Players',
    description: 'Keep squad details tidy before training, testing or match day.',
  },
  {
    href: '/fitness',
    title: 'Fitness testing',
    description: 'Run tests, lock results, compare rankings and track progress over time.',
  },
  {
    href: '/match-day',
    title: 'Match Day',
    description: 'Prepare the squad, track minutes and record key moments during the game.',
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-6 sm:p-6">
      <PageHeader
        eyebrow="Can You Coach"
        title="Simple tools for grassroots coaches"
        description="Set up your squad, run fitness tests and manage match day from one phone-friendly workspace. Built for quick use by coaches and volunteers."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {setupLinks.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <p className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-800">
              {index + 1}
            </p>
            <h2 className="text-xl font-bold text-slate-950">{link.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
