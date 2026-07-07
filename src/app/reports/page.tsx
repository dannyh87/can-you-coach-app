import Link from 'next/link'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  await getCurrentUser()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Use reports to spot trends across matches, not just review one scoreline."
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/reports/team-trends"
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Match trends</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Team Event Trends</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Track how one selected match event changes across completed matches over time.
          </p>
          <span className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
            Open report
          </span>
        </Link>
      </section>
    </main>
  )
}
