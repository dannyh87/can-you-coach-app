import type { DashboardData } from '@/lib/dashboard'

type CoachDashboardData = Extract<DashboardData, { kind: 'coach' }>

type DashboardSnapshotProps = {
  data: CoachDashboardData
}

export default function DashboardSnapshot({ data }: DashboardSnapshotProps) {
  const cards = [
    { label: 'Players tracked', value: data.snapshot.playersTracked, helper: 'Active squad players' },
    { label: 'Completed matches', value: data.snapshot.completedMatches, helper: 'Last 30 days' },
    { label: 'Completed fitness', value: data.snapshot.completedFitnessSessions, helper: 'Last 30 days' },
    { label: 'Parent submissions', value: data.snapshot.pendingParentSubmissions, helper: 'Needs review' },
    { label: 'Active work', value: data.snapshot.activeWorkCount, helper: 'Live tests or matches' },
  ]

  return (
    <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.055)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">{data.contextLabel}</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">What your data says today</h2>
          <p className="mt-1 text-sm text-slate-600">
            A lightweight view of recent coaching activity and items that may need review.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-stone-50/80 p-4">
            <p className="text-sm font-semibold text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-950">{card.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{card.helper}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
