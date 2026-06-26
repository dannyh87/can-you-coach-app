import Link from 'next/link'

import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import type { DashboardData, DashboardWorkItem } from '@/lib/dashboard'

type CoachDashboardData = Extract<DashboardData, { kind: 'coach' }>

type RecentReportsPanelProps = {
  data: CoachDashboardData
}

export default function RecentReportsPanel({ data }: RecentReportsPanelProps) {
  const hasReports = data.recentReports.matches.length > 0 || data.recentReports.fitnessSessions.length > 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Recent reports</h2>
          <p className="mt-1 text-sm text-slate-600">Completed match and fitness records ready to review.</p>
        </div>
        <Link href="/fitness/progress" className="text-sm font-bold text-blue-800 hover:underline">
          View fitness progress
        </Link>
      </div>

      {!hasReports ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No completed reports yet. Complete a match day or fitness session to fill this panel.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ReportGroup title="Match reports" emptyText="No completed matches yet.">
            {data.recentReports.matches.map((item) => (
              <ReportItem key={item.id} item={item} />
            ))}
          </ReportGroup>
          <ReportGroup title="Fitness reports" emptyText="No completed fitness sessions yet.">
            {data.recentReports.fitnessSessions.map((item) => (
              <ReportItem key={item.id} item={item} />
            ))}
          </ReportGroup>
        </div>
      )}
    </section>
  )
}

function ReportGroup({
  title,
  emptyText,
  children,
}: {
  title: string
  emptyText: string
  children: React.ReactNode
}) {
  const childArray = Array.isArray(children) ? children : [children]
  const hasChildren = childArray.some(Boolean)

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 space-y-2">
        {hasChildren ? children : <p className="text-sm text-slate-500">{emptyText}</p>}
      </div>
    </div>
  )
}

function ReportItem({ item }: { item: DashboardWorkItem }) {
  return (
    <Link href={item.href} className="block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/70">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-950">{item.title}</p>
          <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
        </div>
        <StatusBadge label={item.status} variant={getStatusBadgeVariant(item.status)} />
      </div>
      <p className="mt-2 text-sm font-medium text-slate-600">{item.meta}</p>
    </Link>
  )
}
