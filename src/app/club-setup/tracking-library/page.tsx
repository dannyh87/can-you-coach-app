import Link from 'next/link'
import { notFound } from 'next/navigation'

import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import { getCurrentUser } from '@/lib/auth'
import { getClubTrackingDefinitionUsage, getTrackingLibraryClubsForUser, getTrackingLibraryForUser } from '@/lib/clubTrackingDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { formatKind, formatMappingStatus, formatStatus, standardName, StatusPill, displayDate, isPatternKind } from './ui'

export const dynamic = 'force-dynamic'

type SearchParams = {
  clubId?: string
  q?: string
  type?: string
  identity?: string
  lifecycle?: string
  mapping?: string
  creator?: string
  retired?: string
}

const text = (value?: string) => value?.trim() ?? ''

export default async function TrackingLibraryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const params = await searchParams
  const clubs = await getTrackingLibraryClubsForUser({ userId: user.id })
  if (clubs.length === 0) notFound()
  const selectedClub = clubs.find((club) => club.id === params.clubId) ?? clubs[0]
  const includeRetired = params.retired === 'true'
  const library = await getTrackingLibraryForUser({ userId: user.id, clubId: selectedClub.id, includeRetired, query: params.q })
  if (!library.ok) notFound()

  const definitions = library.value.definitions.filter((definition) => {
    if (params.type === 'EVENTS' && isPatternKind(definition.kind)) return false
    if (params.type === 'PATTERNS' && !isPatternKind(definition.kind)) return false
    if (params.identity === 'ALIAS' && !definition.kind.endsWith('ALIAS')) return false
    if (params.identity === 'MAPPED' && !definition.kind.endsWith('MAPPED')) return false
    if (params.identity === 'CUSTOM' && definition.kind !== 'EVENT_CUSTOM') return false
    if (params.lifecycle && params.lifecycle !== 'ALL' && definition.status !== params.lifecycle) return false
    if (params.mapping && params.mapping !== 'ALL' && definition.mappingStatus !== params.mapping) return false
    if (params.creator === 'MINE' && definition.createdByUserId !== user.id) return false
    return true
  })
  const usagePairs = await Promise.all(definitions.map(async (definition) => [definition.id, await getClubTrackingDefinitionUsage({ userId: user.id, definitionId: definition.id })] as const))
  const usage = new Map(usagePairs)
  const allRows = library.value.definitions
  const approved = allRows.filter((definition) => definition.status === 'APPROVED').length
  const myDrafts = allRows.filter((definition) => definition.createdByUserId === user.id && definition.status === 'DRAFT').length
  const pending = allRows.filter((definition) => definition.status === 'PENDING_REVIEW').length
  const mappingReview = allRows.filter((definition) => definition.mappingStatus === 'CLUB_APPROVED').length
  const retired = allRows.filter((definition) => definition.status === 'RETIRED').length
  const canCreate = library.value.role === 'OWNER' || library.value.role === 'COACH'
  const isOwner = library.value.role === 'OWNER'

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/club-setup" className="text-sm font-semibold text-blue-800 hover:underline">Back to Club Setup</Link>
      <PageHeader title="Tracking Library" description="Create and manage club terminology, aliases and mapped coaching definitions before they are used in future Match Day tracking." />

      <form className="mt-4 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-sm font-semibold lg:col-span-2">Club
          <select name="clubId" defaultValue={selectedClub.id} className="mt-1 w-full rounded-xl border px-3 py-2">
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name} ({club.role.toLowerCase().replace('_', ' ')})</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold lg:col-span-2">Search
          <input name="q" defaultValue={text(params.q)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Name, standard, guidance or creator" />
        </label>
        <label className="text-sm font-semibold">Type
          <select name="type" defaultValue={params.type ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All</option><option value="EVENTS">Events</option><option value="PATTERNS">Tactical patterns</option></select>
        </label>
        <label className="text-sm font-semibold">Identity
          <select name="identity" defaultValue={params.identity ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All</option><option value="ALIAS">Standard alias</option><option value="MAPPED">Club mapped</option><option value="CUSTOM">Club specific</option></select>
        </label>
        <label className="text-sm font-semibold">Lifecycle
          <select name="lifecycle" defaultValue={params.lifecycle ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All</option><option value="DRAFT">Draft</option><option value="PENDING_REVIEW">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="RETIRED">Retired</option></select>
        </label>
        <label className="text-sm font-semibold">Mapping
          <select name="mapping" defaultValue={params.mapping ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All</option><option value="NONE">None</option><option value="PROPOSED">Proposed</option><option value="CLUB_APPROVED">Club approved</option><option value="STANDARD_APPROVED">Standard approved</option><option value="REJECTED">Mapping rejected</option></select>
        </label>
        <label className="text-sm font-semibold">Creator
          <select name="creator" defaultValue={params.creator ?? 'ALL'} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="ALL">All permitted</option><option value="MINE">Mine</option></select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold lg:mt-6"><input type="checkbox" name="retired" value="true" defaultChecked={includeRetired} /> Include retired</label>
        <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white lg:mt-6">Apply filters</button>
      </form>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Approved" value={approved} />
        {(library.value.role === 'OWNER' || library.value.role === 'COACH') && <StatCard label="My drafts" value={myDrafts} />}
        <StatCard label="Pending review" value={pending} />
        <StatCard label="Mapping review" value={mappingReview} />
        <StatCard label="Retired" value={retired} />
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {canCreate && <Link href={`/club-setup/tracking-library/new?clubId=${selectedClub.id}`} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">Create definition</Link>}
        {isOwner && <Link href={`/club-setup/tracking-library/review?clubId=${selectedClub.id}`} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100">Review queue ({pending})</Link>}
      </div>

      <SectionCard className="mt-6" title="Definitions" description={`${definitions.length} visible definition${definitions.length === 1 ? '' : 's'} for ${selectedClub.name}.`}>
        {definitions.length === 0 ? (
          <EmptyState eyebrow="No definitions" title="Nothing matches these filters." description="Search existing standards before creating a club tracking definition." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {definitions.map((definition) => {
              const usageResult = usage.get(definition.id)
              const mapped = standardName(definition)
              return (
                <article key={definition.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-extrabold text-slate-950">{definition.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{formatKind(definition.kind)}{mapped ? <> for <span className="font-bold">{mapped}</span></> : null}</p>
                    </div>
                    <Link href={`/club-setup/tracking-library/${definition.id}`} className="rounded-lg border px-3 py-2 text-sm font-bold text-blue-800">Details</Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone={definition.status === 'APPROVED' ? 'green' : definition.status === 'REJECTED' ? 'red' : definition.status === 'PENDING_REVIEW' ? 'amber' : 'slate'}>Lifecycle: {formatStatus(definition.status)}</StatusPill>
                    <StatusPill tone={definition.mappingStatus === 'STANDARD_APPROVED' ? 'green' : definition.mappingStatus === 'REJECTED' ? 'red' : definition.mappingStatus === 'CLUB_APPROVED' ? 'amber' : 'blue'}>Mapping: {formatMappingStatus(definition.mappingStatus)}</StatusPill>
                    {definition.requiresLocation && <StatusPill tone="amber">Location required</StatusPill>}
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="font-bold text-slate-500">Scope</dt><dd>{definition.scopeType ?? 'Not specified'}</dd></div>
                    <div><dt className="font-bold text-slate-500">Target</dt><dd>{definition.targetContext ?? 'Not specified'}</dd></div>
                    <div><dt className="font-bold text-slate-500">Phase</dt><dd>{definition.phase ?? 'Not specified'}</dd></div>
                    <div><dt className="font-bold text-slate-500">Focus</dt><dd>{definition.focusArea ?? 'Not specified'}</dd></div>
                    <div><dt className="font-bold text-slate-500">Creator</dt><dd className="break-words">{definition.createdBy.email}</dd></div>
                    <div><dt className="font-bold text-slate-500">Updated</dt><dd>{displayDate(definition.updatedAt)}</dd></div>
                  </dl>
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">Usage: {usageResult?.ok ? `${usageResult.value.totalReferences} observation references` : 'Unavailable'}</p>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>
    </main>
  )
}
