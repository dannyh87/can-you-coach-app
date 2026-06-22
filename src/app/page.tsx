import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'

const setupLinks = [
  {
    href: '/club-setup',
    title: 'Set up teams',
    description: 'Add your club and teams first so squads, tests and matches stay organised.',
  },
  {
    href: '/players',
    title: 'Build your squad',
    description: 'Keep player details, positions and squad numbers ready for testing and match day.',
  },
  {
    href: '/fitness',
    title: 'Run fitness tests',
    description: 'Record results, lock completed tests, compare rankings and track progress.',
  },
  {
    href: '/match-day',
    title: 'Match Day',
    description: 'Prepare the squad, track minutes and record key moments from the touchline.',
  },
]

const quickLinks = [
  { href: '/fitness/test-types', label: 'Manage Fitness Test Library' },
  { href: '/fitness/progress', label: 'Review Fitness Progress' },
  { href: '/match-day', label: 'Open Match Day' },
]

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-6 sm:p-6">
      <PageHeader
        eyebrow="Can You Coach"
        title="Simple tools for grassroots coaches"
        description="Set up your squad, run fitness tests and manage match day from one phone-friendly workspace. Built for quick use by coaches and volunteers."
      />

      <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm sm:p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-800">Start here</p>
        <h2 className="mt-2 text-2xl font-extrabold text-blue-950">Pick the coaching job you are doing now</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900">
          Use the setup tools before the season, Fitness when testing players, and Match Day when you are on the touchline. Reports and rankings help you review what happened afterwards.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

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
