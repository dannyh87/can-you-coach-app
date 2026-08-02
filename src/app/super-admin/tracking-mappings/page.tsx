import Link from 'next/link'
import { notFound } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import { getCurrentUser } from '@/lib/auth'
import { getStandardMappingReviewQueue } from '@/lib/clubTrackingDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'

export const dynamic = 'force-dynamic'

const formatDate = (value: Date | null) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(value) : 'Not set'
const kindLabel = (kind: string) => kind === 'EVENT_MAPPED' ? 'Mapped event' : 'Mapped pattern'
const standardName = (definition: { mappedEventDefinition?: { name: string } | null; mappedPatternDefinition?: { name: string } | null }) => definition.mappedEventDefinition?.name ?? definition.mappedPatternDefinition?.name ?? 'Missing standard'

export default async function StandardMappingQueuePage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; club?: string; risk?: string; sort?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()
  const params = await searchParams
  const queue = await getStandardMappingReviewQueue({ filters: { status: params.status as never, type: params.type as never, clubQuery: params.club, risk: params.risk as never, sort: params.sort as never } })
  const awaiting = queue.filter((row) => row.definition.mappingStatus === 'CLUB_APPROVED').length
  const approved = queue.filter((row) => row.definition.mappingStatus === 'STANDARD_APPROVED').length
  const rejected = queue.filter((row) => row.definition.mappingStatus === 'REJECTED').length
  const used = queue.filter((row) => row.usageCount > 0).length
  const benchmarkable = queue.filter((row) => row.benchmarkable).length

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/super-admin/events" className="text-sm font-semibold text-blue-800 hover:underline">Back to Event Library</Link>
      <PageHeader title="Standard Mapping Review" description="Review club mapped definitions before they contribute to global standard reporting." />
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Awaiting review" value={awaiting} />
        <StatCard label="Standard approved" value={approved} />
        <StatCard label="Rejected" value={rejected} />
        <StatCard label="Used locally" value={used} />
        <StatCard label="Benchmarkable" value={benchmarkable} />
      </section>

      <form className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm font-semibold">Status
          <select name="status" defaultValue={params.status ?? 'AWAITING'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="AWAITING">Awaiting review</option><option value="STANDARD_APPROVED">Standard approved</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select>
        </label>
        <label className="text-sm font-semibold">Type
          <select name="type" defaultValue={params.type ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All</option><option value="EVENTS">Events</option><option value="PATTERNS">Tactical patterns</option></select>
        </label>
        <label className="text-sm font-semibold">Club
          <input name="club" defaultValue={params.club ?? ''} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Search club" />
        </label>
        <label className="text-sm font-semibold">Risk
          <select name="risk" defaultValue={params.risk ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All</option><option value="NO_USAGE">No usage</option><option value="USED">Used locally</option><option value="BENCHMARKABLE">Benchmarkable standard</option><option value="REVISION_CHANGED">Revision changed</option><option value="SIMILAR_STANDARDS">Similar standards</option></select>
        </label>
        <label className="text-sm font-semibold">Sort
          <select name="sort" defaultValue={params.sort ?? 'NEWEST'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="NEWEST">Newest</option><option value="OLDEST">Oldest</option><option value="LONGEST_WAITING">Longest waiting</option></select>
        </label>
        <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white lg:col-span-5">Apply filters</button>
      </form>

      <SectionCard className="mt-6" title={`Mappings (${queue.length})`}>
        {queue.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No mappings match these filters.</p> : <div className="grid gap-4 md:grid-cols-2">{queue.map(({ definition, usageCount, benchmarkable: isBenchmarkable, warnings }) => (
          <article key={definition.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-blue-700">{definition.club.name}</p><h2 className="break-words text-xl font-extrabold">{definition.name}</h2><p className="mt-1 text-sm font-semibold text-slate-700">{kindLabel(definition.kind)} for {standardName(definition)}</p></div><Link href={`/super-admin/tracking-mappings/${definition.id}`} className="rounded-lg border px-3 py-2 text-sm font-bold text-blue-800">Review</Link></div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><Info label="Lifecycle" value={definition.status} /><Info label="Mapping" value={definition.mappingStatus} /><Info label="Revision" value={String(definition.mappingRevision)} /><Info label="Club approved" value={formatDate(definition.approvedAt)} /><Info label="Waiting age" value={formatDate(definition.standardMappingReviewedAt ?? definition.updatedAt)} /><Info label="Usage" value={`${usageCount} observation refs`} /><Info label="Benchmark" value={isBenchmarkable ? 'Would inherit benchmark eligibility' : 'No benchmark implication'} /></dl>
            {warnings.length > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{warnings.join(' · ')}</div>}
          </article>
        ))}</div>}
      </SectionCard>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>
}
