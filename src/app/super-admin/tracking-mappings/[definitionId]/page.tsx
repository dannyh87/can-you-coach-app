import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import type { ClubTrackingStandardMappingRejectionCategory } from '@prisma/client'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName } from '@/components/ui/formStyles'
import { getCurrentUser } from '@/lib/auth'
import { approveClubTrackingStandardMapping, getStandardMappingReviewDetail, rejectClubTrackingStandardMapping } from '@/lib/clubTrackingDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'

export const dynamic = 'force-dynamic'

const categories: Array<{ value: ClubTrackingStandardMappingRejectionCategory; label: string }> = [
  { value: 'NOT_EQUIVALENT', label: 'Not equivalent' },
  { value: 'EVENT_PATTERN_MISMATCH', label: 'Event/pattern mismatch' },
  { value: 'SCOPE_CONTEXT_MISMATCH', label: 'Scope/context mismatch' },
  { value: 'OUTCOME_MISMATCH', label: 'Outcome mismatch' },
  { value: 'BENCHMARK_INCOMPATIBLE', label: 'Benchmark incompatible' },
  { value: 'BETTER_STANDARD_EXISTS', label: 'Better standard exists' },
  { value: 'NEEDS_CLARIFICATION', label: 'Needs clarification' },
  { value: 'DUPLICATE_MAPPING', label: 'Duplicate mapping' },
  { value: 'OTHER', label: 'Other' },
]

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
const formatDate = (value: Date | null) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(value) : 'Not set'
const standardName = (definition: { mappedEventDefinition?: { name: string } | null; mappedPatternDefinition?: { name: string } | null }) => definition.mappedEventDefinition?.name ?? definition.mappedPatternDefinition?.name ?? 'Missing standard'

async function reviewAction(formData: FormData) {
  'use server'
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()
  const definitionId = getText(formData, 'definitionId')
  const expectedMappingRevision = Number(getText(formData, 'expectedMappingRevision'))
  const expectedMappingStatus = getText(formData, 'expectedMappingStatus') as never
  const action = getText(formData, 'action')
  const result = action === 'approve'
    ? await approveClubTrackingStandardMapping({ actorEmail: user.email, actorUserId: user.id, definitionId, expectedMappingRevision, expectedMappingStatus })
    : await rejectClubTrackingStandardMapping({ actorEmail: user.email, actorUserId: user.id, definitionId, expectedMappingRevision, expectedMappingStatus, category: getText(formData, 'category') as ClubTrackingStandardMappingRejectionCategory, reason: getText(formData, 'reason') })
  if (!result.ok) redirect(`/super-admin/tracking-mappings/${definitionId}?error=${encodeURIComponent(result.reason)}`)
  revalidatePath('/super-admin/tracking-mappings')
  revalidatePath(`/super-admin/tracking-mappings/${definitionId}`)
  redirect(`/super-admin/tracking-mappings/${definitionId}?success=1`)
}

export default async function StandardMappingDetailPage({ params, searchParams }: { params: Promise<{ definitionId: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()
  const [{ definitionId }, query] = await Promise.all([params, searchParams])
  const detail = await getStandardMappingReviewDetail({ definitionId })
  if (!detail) notFound()
  const { definition, usageCount, standardAliases, similarStandards, similarClubMappings, checks, eligibility } = detail

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <Link href="/super-admin/tracking-mappings" className="text-sm font-semibold text-blue-800 hover:underline">Back to Mapping Review</Link>
      <PageHeader title={definition.name} description={`Review mapping from ${definition.club.name} to ${standardName(definition)}.`} />
      {query.error && <Alert variant="error" className="mt-4">{query.error}</Alert>}
      {query.success && <Alert variant="success" className="mt-4">Mapping review saved.</Alert>}

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Club definition">
          <dl className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Club" value={definition.club.name} /><Info label="Kind" value={definition.kind} /><Info label="Lifecycle" value={definition.status} /><Info label="Mapping" value={definition.mappingStatus} /><Info label="Revision" value={String(definition.mappingRevision)} /><Info label="Approved" value={formatDate(definition.approvedAt)} /><Info label="Scope" value={definition.scopeType ?? 'Not specified'} /><Info label="Target" value={definition.targetContext ?? 'Not specified'} /><Info label="Phase" value={definition.phase ?? 'Not specified'} /><Info label="Focus" value={definition.focusArea ?? 'Not specified'} /><Info label="Location" value={definition.requiresLocation ? 'Requires location' : 'No required location'} /><Info label="Usage" value={`${usageCount} observation refs`} /></dl>
          <p className="mt-4 text-sm"><span className="font-bold">Description:</span> {definition.description ?? 'None'}</p>
          <p className="mt-2 text-sm"><span className="font-bold">Guidance:</span> {definition.guidance ?? 'None'}</p>
        </SectionCard>

        <SectionCard title="Proposed global standard">
          {definition.mappedEventDefinition && <dl className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Standard" value={definition.mappedEventDefinition.name} /><Info label="Type" value="Event" /><Info label="Active" value={definition.mappedEventDefinition.isActive ? 'Active' : 'Inactive'} /><Info label="Location" value={definition.mappedEventDefinition.requiresLocation ? 'Requires location' : 'No required location'} /><Info label="Benchmark" value={definition.mappedEventDefinition.benchmarkable ? 'Benchmarkable' : 'Not benchmarkable'} /><Info label="Aliases" value={standardAliases.map((alias) => alias.alias).join(', ') || 'None found'} /></dl>}
          {definition.mappedPatternDefinition && <div className="text-sm"><dl className="grid gap-3 sm:grid-cols-2"><Info label="Standard" value={definition.mappedPatternDefinition.name} /><Info label="Type" value="Pattern" /><Info label="Active" value={definition.mappedPatternDefinition.active ? 'Active' : 'Inactive'} /><Info label="Location" value={definition.mappedPatternDefinition.requiresLocation ? 'Requires location' : 'No required location'} /><Info label="Aliases" value={definition.mappedPatternDefinition.aliases.map((alias) => alias.alias).join(', ') || 'None'} /></dl><p className="mt-4 font-bold">Ordered steps</p><ol className="mt-2 list-decimal pl-5">{definition.mappedPatternDefinition.steps.map((step) => <li key={step.id}>{step.label ?? step.eventDefinition.name}</li>)}</ol><p className="mt-4 font-bold">Standard outcomes</p><ul className="mt-2 list-disc pl-5">{definition.mappedPatternDefinition.outcomes.map((outcome) => <li key={outcome.id}>{outcome.label}</li>)}</ul><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-950">Custom club pattern outcomes are not supported.</p></div>}
        </SectionCard>
      </section>

      <SectionCard className="mt-5" title="Deterministic compatibility checks">
        <div className="grid gap-3 md:grid-cols-2">{checks.map((check) => <article key={check.label} className="rounded-xl border p-3 text-sm"><p className="font-bold">{check.label}: {check.level === 'COMPATIBLE' ? 'Compatible' : check.level === 'REVIEW' ? 'Review needed' : 'Blocking issue'}</p><p className="mt-1 text-slate-600">{check.message}</p></article>)}</div>
      </SectionCard>

      <SectionCard className="mt-5" title="Similar mapping context">
        <div className="grid gap-4 md:grid-cols-2"><div><h2 className="font-bold">Similar standards</h2>{similarStandards.length === 0 ? <p className="mt-2 text-sm text-slate-600">None found.</p> : <ul className="mt-2 list-disc pl-5 text-sm">{similarStandards.map((item) => <li key={item.id}>{item.name}</li>)}</ul>}</div><div><h2 className="font-bold">Similar club mappings</h2>{similarClubMappings.length === 0 ? <p className="mt-2 text-sm text-slate-600">None found.</p> : <ul className="mt-2 list-disc pl-5 text-sm">{similarClubMappings.map((item) => <li key={item.id}>{item.club.name}: {item.name} to {standardName(item)}</li>)}</ul>}</div></div>
      </SectionCard>

      <SectionCard className="mt-5" title="Benchmark and historical safety">
        <p className="text-sm font-semibold">{definition.mappedEventDefinition?.benchmarkable ? 'Approving this mapping would make future observations benchmark eligible if recorded under this revision.' : 'No benchmark eligibility is inherited from this standard.'}</p>
        <p className="mt-2 text-sm text-slate-600">Earlier observations remain governed by the mapping status, standard identity and mapping revision captured when they were recorded. This action does not retroactively rewrite observation snapshots.</p>
      </SectionCard>

      <SectionCard className="mt-5" title="Review actions">
        {!eligibility.canApprove && <Alert variant="warning" className="mb-4">Some checks require attention before approval. Rejection remains available for reviewable mappings.</Alert>}
        <div className="grid gap-4 lg:grid-cols-2"><form action={reviewAction} className="rounded-xl border border-green-200 bg-green-50 p-4"><input type="hidden" name="definitionId" value={definition.id} /><input type="hidden" name="expectedMappingRevision" value={definition.mappingRevision} /><input type="hidden" name="expectedMappingStatus" value={definition.mappingStatus} /><input type="hidden" name="action" value="approve" /><p className="text-sm font-semibold text-green-950">Approving this mapping allows future observations recorded under this club definition to contribute to the mapped standard identity, subject to the recorded mapping revision.</p><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required /> I understand earlier observations are not retroactively changed.</label><Button type="submit" variant="secondary" className="mt-3" disabled={!eligibility.canApprove}>Approve standard mapping for {definition.name}</Button></form><form action={reviewAction} className="rounded-xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="definitionId" value={definition.id} /><input type="hidden" name="expectedMappingRevision" value={definition.mappingRevision} /><input type="hidden" name="expectedMappingStatus" value={definition.mappingStatus} /><input type="hidden" name="action" value="reject" /><FormField label="Rejection category"><select name="category" className={fieldClassName} required><option value="">Select category</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></FormField><FormField label="Rejection feedback"><textarea name="reason" className={fieldClassName} required rows={4} /></FormField><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required /> Reject this mapping without changing club guidance or lifecycle state.</label><Button type="submit" variant="secondary" className="mt-3">Reject standard mapping for {definition.name}</Button></form></div>
      </SectionCard>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>
}
