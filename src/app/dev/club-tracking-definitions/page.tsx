import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { isClubTrackingDefinitionDevExplorerEnabled } from '@/lib/features'
import { prisma } from '@/lib/prisma'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import {
  approveClubTrackingDefinition,
  approveStandardMapping,
  createClubTrackingDefinitionDraft,
  getClubTrackingDefinitionUsage,
  getClubTrackingReportingIdentity,
  rejectClubTrackingDefinition,
  rejectStandardMapping,
  retireClubTrackingDefinition,
  restoreClubTrackingDefinition,
  searchExistingTrackingDefinitions,
  submitClubTrackingDefinitionForReview,
} from '@/lib/clubTrackingDefinitions'

export const dynamic = 'force-dynamic'

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function requireExplorerUser() {
  if (!isClubTrackingDefinitionDevExplorerEnabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()
  return user
}

async function createDefinitionAction(formData: FormData) {
  'use server'
  const user = await requireExplorerUser()
  await createClubTrackingDefinitionDraft({ userId: user.id, input: { clubId: getText(formData, 'clubId'), kind: getText(formData, 'kind') as never, name: getText(formData, 'name'), description: getText(formData, 'description'), guidance: getText(formData, 'guidance'), mappedEventDefinitionId: getText(formData, 'mappedEventDefinitionId') || null, mappedPatternDefinitionId: getText(formData, 'mappedPatternDefinitionId') || null, searchToken: getText(formData, 'searchToken'), proposalType: getText(formData, 'proposalType') as 'EVENT' | 'PATTERN', nearDuplicateAcknowledged: formData.get('nearDuplicateAcknowledged') === 'on' } })
  revalidatePath('/dev/club-tracking-definitions')
}

async function transitionAction(formData: FormData) {
  'use server'
  const user = await requireExplorerUser()
  const action = getText(formData, 'action')
  const definitionId = getText(formData, 'definitionId')
  if (action === 'submit') await submitClubTrackingDefinitionForReview({ userId: user.id, definitionId })
  if (action === 'approve') await approveClubTrackingDefinition({ userId: user.id, definitionId })
  if (action === 'reject') await rejectClubTrackingDefinition({ userId: user.id, definitionId })
  if (action === 'standard-approve') await approveStandardMapping({ actorEmail: user.email, definitionId })
  if (action === 'standard-reject') await rejectStandardMapping({ actorEmail: user.email, definitionId })
  if (action === 'retire') await retireClubTrackingDefinition({ userId: user.id, definitionId })
  if (action === 'restore') await restoreClubTrackingDefinition({ userId: user.id, definitionId })
  revalidatePath('/dev/club-tracking-definitions')
}

export default async function ClubTrackingDefinitionsExplorer({ searchParams }: { searchParams: Promise<{ clubId?: string; q?: string }> }) {
  const user = await requireExplorerUser()
  const { clubId, q = '' } = await searchParams
  const clubs = await prisma.club.findMany({ orderBy: { name: 'asc' }, take: 50 })
  const selectedClubId = clubId ?? clubs[0]?.id ?? ''
  const [definitions, standardEvents, standardPatterns, search, usageRows] = await Promise.all([
    selectedClubId ? prisma.clubTrackingDefinition.findMany({ where: { clubId: selectedClubId }, orderBy: [{ status: 'asc' }, { name: 'asc' }] }) : [],
    prisma.eventDefinition.findMany({ where: { scope: 'GLOBAL', isActive: true }, orderBy: { name: 'asc' }, take: 100 }),
    prisma.trackingPatternDefinition.findMany({ where: { ownerScope: 'GLOBAL', active: true }, orderBy: { name: 'asc' }, take: 100 }),
    selectedClubId && q ? searchExistingTrackingDefinitions({ userId: user.id, clubId: selectedClubId, query: q }) : null,
    selectedClubId ? prisma.clubTrackingDefinition.findMany({ where: { clubId: selectedClubId }, select: { id: true } }) : [],
  ])
  const usageByDefinition = new Map<string, Awaited<ReturnType<typeof getClubTrackingDefinitionUsage>>>()
  for (const row of usageRows) usageByDefinition.set(row.id, await getClubTrackingDefinitionUsage({ userId: user.id, definitionId: row.id }))

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:p-6">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Dev Explorer</p>
      <h1 className="mt-1 text-3xl font-bold">Club tracking definitions</h1>
      <p className="mt-2 text-sm text-slate-600">Internal explorer gated by ENABLE_CLUB_TRACKING_DEFINITION_DEV_EXPLORER and super-admin access.</p>

      <form className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3">
        <select name="clubId" defaultValue={selectedClubId} className="rounded-xl border px-3 py-2 text-sm">{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
        <input name="q" defaultValue={q} className="rounded-xl border px-3 py-2 text-sm" placeholder="Search before create" />
        <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Search</button>
      </form>

      {search?.ok && <section className="mt-4 rounded-2xl border bg-blue-50 p-4 text-sm"><p className="font-bold">Search token</p><code>{search.value.searchToken}</code><p className="mt-2">Exact matches: {search.value.exactMatches.map((match) => match.name).join(', ') || 'None'}</p><p>Warnings: {search.value.warnings.join(' ') || 'None'}</p></section>}

      <section className="mt-5 rounded-2xl border bg-white p-4">
        <h2 className="text-xl font-bold">Create disposable draft</h2>
        <form action={createDefinitionAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="clubId" value={selectedClubId} />
          <input name="searchToken" defaultValue={search?.ok ? search.value.searchToken : ''} className="rounded-xl border px-3 py-2 text-sm" placeholder="Search token" />
          <select name="kind" className="rounded-xl border px-3 py-2 text-sm"><option value="EVENT_ALIAS">Event alias</option><option value="EVENT_MAPPED">Event mapped</option><option value="EVENT_CUSTOM">Event custom</option><option value="PATTERN_ALIAS">Pattern alias</option><option value="PATTERN_MAPPED">Pattern mapped</option></select>
          <select name="proposalType" className="rounded-xl border px-3 py-2 text-sm"><option value="EVENT">One observable event</option><option value="PATTERN">Tactical pattern or sequence</option></select>
          <input name="name" defaultValue={q} className="rounded-xl border px-3 py-2 text-sm" placeholder="Club label" />
          <select name="mappedEventDefinitionId" className="rounded-xl border px-3 py-2 text-sm"><option value="">No event mapping</option>{standardEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select>
          <select name="mappedPatternDefinitionId" className="rounded-xl border px-3 py-2 text-sm"><option value="">No pattern mapping</option>{standardPatterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}</select>
          <textarea name="guidance" className="rounded-xl border px-3 py-2 text-sm sm:col-span-2" placeholder="Guidance" />
          <label className="text-sm font-semibold"><input type="checkbox" name="nearDuplicateAcknowledged" /> Acknowledge warnings</label>
          <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Create through service</button>
        </form>
      </section>

      <section className="mt-5 grid gap-4">
        {definitions.map(async (definition) => {
          const identity = await getClubTrackingReportingIdentity({ clubTrackingDefinitionId: definition.id })
          const usage = usageByDefinition.get(definition.id)
          return <article key={definition.id} className="rounded-2xl border bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{definition.name}</p><p className="text-sm text-slate-600">{definition.kind} · {definition.status} · {definition.mappingStatus} · rev {definition.mappingRevision}</p><p className="mt-1 text-xs text-slate-500">Reporting: {identity.ok ? `${identity.value.identityType}, standard=${identity.value.contributesToStandardReporting}, club=${identity.value.contributesToClubReporting}, benchmark=${identity.value.benchmarkEligible}` : identity.reason}</p><p className="mt-1 text-xs text-slate-500">Usage refs: {usage?.ok ? usage.value.totalReferences : 'n/a'}</p></div><form action={transitionAction} className="flex flex-wrap gap-2"><input type="hidden" name="definitionId" value={definition.id} />{['submit', 'approve', 'reject', 'standard-approve', 'standard-reject', definition.active ? 'retire' : 'restore'].map((action) => <button key={action} name="action" value={action} className="rounded-lg border px-3 py-2 text-xs font-bold">{action}</button>)}</form></div><pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify({ id: definition.id, mappedEventDefinitionId: definition.mappedEventDefinitionId, mappedPatternDefinitionId: definition.mappedPatternDefinitionId, retiredAt: definition.retiredAt }, null, 2)}</pre></article>
        })}
      </section>
    </main>
  )
}
