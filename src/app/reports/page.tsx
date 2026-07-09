import Link from 'next/link'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleTeamWhere } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const user = await getCurrentUser()
  const [accessibleTeamCount, spectatorAccessCount, membershipCount] = await Promise.all([
    prisma.team.count({ where: await accessibleTeamWhere(user.id) }),
    prisma.spectatorAccess.count({ where: { userId: user.id } }),
    prisma.clubMembership.count({ where: { userId: user.id } }),
  ])
  const hasReportAccess = accessibleTeamCount > 0

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Use reports to spot trends across matches, not just review one scoreline."
      />

      {!hasReportAccess ? (
        spectatorAccessCount > 0 ? (
          <EmptyState
            eyebrow="Linked player access"
            title="Reports are for coaching teams."
            description="Parents and spectators can follow linked player information in My Player. Coaches and assigned assistants use reports for team trends and fitness progress."
            action={(
              <Link href="/my-player" className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
                Go to My Player
              </Link>
            )}
          />
        ) : membershipCount === 0 ? (
          <EmptyState
            eyebrow="Invite needed"
            title="No report access yet."
            description="Open your invite link directly and sign in with the invited email. Reports appear after you are linked to a club team."
          />
        ) : (
          <EmptyState
            eyebrow="No assigned teams"
            title="No report access yet."
            description="Ask a club owner or head coach to assign you to a team before using reports."
          />
        )
      ) : (
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
        <Link
          href="/fitness/progress"
          className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Fitness trends</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Fitness Progress</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Compare player fitness results over time by team, player and test type.
          </p>
          <span className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">
            Open report
          </span>
        </Link>
      </section>
      )}
    </main>
  )
}
