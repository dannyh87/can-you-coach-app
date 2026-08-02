import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import type { EventDefinitionAgePhase, MatchTrackingScope, TrackingFocusArea, TrackingTargetContext, TrackingTopicPhase } from '@prisma/client'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'
import { getCurrentUser } from '@/lib/auth'
import { approveClubTrackingDefinition, getClubTrackingDefinitionUsage, getClubTrackingReportingIdentity, getProductionClubTrackingDefinition, rejectClubTrackingDefinition, restoreClubTrackingDefinition, retireClubTrackingDefinition, submitClubTrackingDefinitionForReview, updateClubTrackingDefinition } from '@/lib/clubTrackingDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { ageOptions, BackToLibrary, displayDate, focusOptions, formatKind, formatMappingStatus, formatStatus, isAliasKind, isPatternKind, phaseOptions, scopeOptions, standardName, StatusPill, targetOptions } from '../ui'

export const dynamic = 'force-dynamic'

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
const optional = <T extends string>(value: string) => value ? value as T : null
const getAges = (formData: FormData) => formData.getAll('agePhase').filter((value): value is EventDefinitionAgePhase => typeof value === 'string' && ['FOUNDATION', 'YOUTH', 'ADULT'].includes(value))
type ProductionDefinition = NonNullable<Awaited<ReturnType<typeof getProductionClubTrackingDefinition>>>['definition']
const formatMappingRejectionCategory = (value: string | null) => value ? value.toLowerCase().replace(/_/g, ' ') : 'Not set'

async function runTransition(formData: FormData) {
  'use server'
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const definitionId = getText(formData, 'definitionId')
  const action = getText(formData, 'action')
  let result
  if (action === 'submit') result = await submitClubTrackingDefinitionForReview({ userId: user.id, definitionId })
  if (action === 'approve') result = await approveClubTrackingDefinition({ userId: user.id, definitionId })
  if (action === 'reject') result = await rejectClubTrackingDefinition({ userId: user.id, definitionId, reason: getText(formData, 'rejectionReason') })
  if (action === 'retire') result = await retireClubTrackingDefinition({ userId: user.id, definitionId })
  if (action === 'restore') result = await restoreClubTrackingDefinition({ userId: user.id, definitionId })
  if (!result) result = { ok: false as const, reason: 'Action is invalid.' }
  if (!result.ok) redirect(`/club-setup/tracking-library/${definitionId}?error=${encodeURIComponent(result.reason)}`)
  revalidatePath('/club-setup/tracking-library')
  revalidatePath(`/club-setup/tracking-library/${definitionId}`)
  redirect(`/club-setup/tracking-library/${definitionId}?success=1`)
}

async function updateDefinitionAction(formData: FormData) {
  'use server'
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const definitionId = getText(formData, 'definitionId')
  const result = await updateClubTrackingDefinition({
    userId: user.id,
    definitionId,
    updates: {
      name: getText(formData, 'name'),
      description: getText(formData, 'description'),
      guidance: getText(formData, 'guidance'),
      scopeType: optional<MatchTrackingScope>(getText(formData, 'scopeType')),
      targetContext: optional<TrackingTargetContext>(getText(formData, 'targetContext')),
      phase: optional<TrackingTopicPhase>(getText(formData, 'phase')),
      focusArea: optional<TrackingFocusArea>(getText(formData, 'focusArea')),
      agePhases: getAges(formData),
      requiresLocation: formData.get('requiresLocation') === 'on',
    },
  })
  if (!result.ok) redirect(`/club-setup/tracking-library/${definitionId}?error=${encodeURIComponent(result.reason)}`)
  revalidatePath('/club-setup/tracking-library')
  revalidatePath(`/club-setup/tracking-library/${definitionId}`)
  redirect(`/club-setup/tracking-library/${definitionId}?saved=1`)
}

export default async function DefinitionDetailPage({ params, searchParams }: { params: Promise<{ definitionId: string }>; searchParams: Promise<{ error?: string; success?: string; saved?: string; created?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const [{ definitionId }, query] = await Promise.all([params, searchParams])
  const access = await getProductionClubTrackingDefinition({ userId: user.id, definitionId })
  if (!access) notFound()
  const { role, definition } = access
  const [identity, usage] = await Promise.all([
    getClubTrackingReportingIdentity({ clubTrackingDefinitionId: definition.id }),
    getClubTrackingDefinitionUsage({ userId: user.id, definitionId: definition.id }),
  ])
  const usageCount = usage.ok ? usage.value.totalReferences : 0
  const hasUsage = usageCount > 0
  const canEdit = role === 'OWNER' || definition.createdByUserId === user.id && ['DRAFT', 'REJECTED'].includes(definition.status)
  const canSubmit = (role === 'OWNER' || definition.createdByUserId === user.id) && definition.status === 'DRAFT'
  const canApproveReject = role === 'OWNER' && ['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(definition.status)
  const canRetire = role === 'OWNER' && definition.status === 'APPROVED'
  const canRestore = role === 'OWNER' && definition.status === 'RETIRED'
  const showRejection = Boolean(definition.rejectionReason && (role === 'OWNER' || definition.createdByUserId === user.id))
  const showMappingRejection = Boolean(definition.mappingStatus === 'REJECTED' && definition.standardMappingRejectionReason && (role === 'OWNER' || definition.createdByUserId === user.id))

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <BackToLibrary clubId={definition.clubId} />
      <PageHeader title={definition.name} description={`${formatKind(definition.kind)} for ${definition.club.name}.`} />
      {query.error && <Alert variant="error" className="mt-4">{query.error}</Alert>}
      {(query.success || query.saved || query.created) && <Alert variant="success" className="mt-4">Definition updated.</Alert>}

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatusPill tone={definition.status === 'APPROVED' ? 'green' : definition.status === 'REJECTED' ? 'red' : definition.status === 'PENDING_REVIEW' ? 'amber' : 'slate'}>Lifecycle: {formatStatus(definition.status)}</StatusPill>
        <StatusPill tone={definition.mappingStatus === 'STANDARD_APPROVED' ? 'green' : definition.mappingStatus === 'REJECTED' ? 'red' : definition.mappingStatus === 'CLUB_APPROVED' ? 'amber' : 'blue'}>Mapping: {formatMappingStatus(definition.mappingStatus)}</StatusPill>
      </section>

      <SectionCard className="mt-5" title="Identity and reporting">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Club" value={definition.club.name} />
          <Info label="Definition category" value={formatKind(definition.kind)} />
          <Info label="Event or pattern" value={isPatternKind(definition.kind) ? 'Tactical pattern' : 'Observable event'} />
          <Info label="Mapped standard" value={standardName(definition) ?? 'None'} />
          <Info label="Mapping revision" value={String(definition.mappingRevision)} />
          <Info label="Standard review date" value={displayDate(definition.standardMappingReviewedAt)} />
          <Info label="Standard reporting" value={identity.ok && identity.value.contributesToStandardReporting ? 'Included in standard reporting' : 'Excluded from standard reporting'} />
          <Info label="Club reporting" value={identity.ok && identity.value.contributesToClubReporting ? 'Included in club reporting' : 'Not a club reporting identity'} />
          <Info label="Benchmark eligibility" value={identity.ok && identity.value.benchmarkEligible ? 'Benchmark eligible' : 'Not benchmark eligible'} />
        </dl>
        {showMappingRejection && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Standard mapping rejection</p><p className="mt-1">Category: {formatMappingRejectionCategory(definition.standardMappingRejectionCategory)}</p><p className="mt-1">Review date: {displayDate(definition.standardMappingReviewedAt)}</p><p className="mt-1">Feedback: {definition.standardMappingRejectionReason}</p></div>}
      </SectionCard>

      {showRejection && <Alert variant="error" className="mt-5"><span className="font-bold">Rejection feedback:</span> {definition.rejectionReason}</Alert>}

      <SectionCard className="mt-5" title="Context">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Scope" value={definition.scopeType ?? 'Not specified'} />
          <Info label="Target context" value={definition.targetContext ?? 'Not specified'} />
          <Info label="Phase" value={definition.phase ?? 'Not specified'} />
          <Info label="Focus area" value={definition.focusArea ?? 'Not specified'} />
          <Info label="Age phases" value={definition.agePhases.length ? definition.agePhases.join(', ') : 'Not specified'} />
          <Info label="Location" value={definition.requiresLocation ? 'Requires location' : 'No required location'} />
        </dl>
      </SectionCard>

      <SectionCard className="mt-5" title="Guidance">
        <p className="text-sm text-slate-700"><span className="font-bold">Description:</span> {definition.description ?? 'No description provided.'}</p>
        <p className="mt-3 text-sm text-slate-700"><span className="font-bold">Coach guidance:</span> {definition.guidance ?? 'No guidance provided.'}</p>
        {definition.mappedPatternDefinition && <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold">Inherited pattern steps</p><ol className="mt-2 list-decimal pl-5">{definition.mappedPatternDefinition.steps.map((step) => <li key={step.id}>{step.label ?? step.eventDefinition.name}</li>)}</ol><p className="mt-3 font-bold">Inherited outcomes</p><ul className="mt-2 list-disc pl-5">{definition.mappedPatternDefinition.outcomes.map((outcome) => <li key={outcome.id}>{outcome.label}</li>)}</ul></div>}
      </SectionCard>

      <SectionCard className="mt-5" title="Governance">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Creator" value={definition.createdBy.email} />
          <Info label="Submitted" value={displayDate(definition.submittedAt)} />
          <Info label="Approver" value={definition.approvedBy?.email ?? 'Not approved'} />
          <Info label="Approved" value={displayDate(definition.approvedAt)} />
          <Info label="Rejected by" value={showRejection ? definition.rejectedBy?.email ?? 'Unknown reviewer' : 'Not shown'} />
          <Info label="Rejected" value={showRejection ? displayDate(definition.rejectedAt) : 'Not shown'} />
          <Info label="Updated" value={displayDate(definition.updatedAt)} />
          <Info label="Retired" value={displayDate(definition.retiredAt)} />
        </dl>
      </SectionCard>

      <SectionCard className="mt-5" title="Usage">
        {usage.ok ? <dl className="grid gap-3 text-sm sm:grid-cols-2"><Info label="Submitted event observations" value={String(usage.value.submittedEventObservations)} /><Info label="Official event observations" value={String(usage.value.officialEventObservations)} /><Info label="Submitted pattern observations" value={String(usage.value.submittedPatternObservations)} /><Info label="Official pattern observations" value={String(usage.value.officialPatternObservations)} /><Info label="Teams" value={usage.value.teamIds.length ? `${usage.value.teamIds.length} team(s)` : 'None'} /><Info label="Last used" value={displayDate(usage.value.lastUsedAt)} /></dl> : <Alert variant="error">{usage.reason}</Alert>}
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Match setup and template usage will become available when Match Day integration is added.</p>
      </SectionCard>

      {canEdit && <SectionCard className="mt-5" title="Edit definition" description={hasUsage ? 'Semantic fields are locked because this definition has usage.' : 'Safe edits are saved without changing historical meaning.'}><EditForm definition={definition} hasUsage={hasUsage} /></SectionCard>}

      <SectionCard className="mt-5" title="Actions">
        <div className="grid gap-4">
          {canSubmit && <ConfirmAction definitionId={definition.id} action="submit" label="Submit for owner review" prompt="Submit this definition to the club owner for review?" />}
          {canApproveReject && <ConfirmAction definitionId={definition.id} action="approve" label="Approve for club use" prompt="Approve this definition for use across the club? Mapped definitions still require standard approval for global totals." />}
          {canApproveReject && <form action={runTransition} className="rounded-xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="definitionId" value={definition.id} /><input type="hidden" name="action" value="reject" /><FormField label="Rejection feedback"><textarea name="rejectionReason" className={fieldClassName} required rows={3} /></FormField><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required /> Reject this definition and store this feedback for the creator.</label><div className="mt-3"><Button type="submit" variant="secondary">Reject with feedback</Button></div></form>}
          {canRetire && <ConfirmAction definitionId={definition.id} action="retire" label="Retire this definition" prompt="Retire this definition? Historical definitions and observations remain unchanged." />}
          {canRestore && <ConfirmAction definitionId={definition.id} action="restore" label="Restore this definition" prompt="Restore this definition if no active duplicate exists?" />}
          {!canSubmit && !canApproveReject && !canRetire && !canRestore && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No management actions are available for your role and this lifecycle state.</p>}
        </div>
      </SectionCard>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{value}</dd></div>
}

function EditForm({ definition, hasUsage }: { definition: ProductionDefinition; hasUsage: boolean }) {
  return <form action={updateDefinitionAction} className={formGridClassName}><input type="hidden" name="definitionId" value={definition.id} />{hasUsage && !isAliasKind(definition.kind) && <><input type="hidden" name="scopeType" value={definition.scopeType ?? ''} /><input type="hidden" name="targetContext" value={definition.targetContext ?? ''} /><input type="hidden" name="phase" value={definition.phase ?? ''} /><input type="hidden" name="focusArea" value={definition.focusArea ?? ''} />{definition.agePhases.map((agePhase) => <input key={agePhase} type="hidden" name="agePhase" value={agePhase} />)}{definition.requiresLocation && <input type="hidden" name="requiresLocation" value="on" />}</>}<FormField label="Club-facing name"><input name="name" defaultValue={definition.name} className={fieldClassName} required /></FormField><FormField label="Description"><textarea name="description" defaultValue={definition.description ?? ''} className={fieldClassName} rows={3} /></FormField><div className="md:col-span-2"><FormField label="Coach guidance"><textarea name="guidance" defaultValue={definition.guidance ?? ''} className={fieldClassName} rows={3} /></FormField></div>{!isAliasKind(definition.kind) && <><FormField label="Scope"><select name="scopeType" defaultValue={definition.scopeType ?? ''} className={fieldClassName} disabled={hasUsage}>{scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><FormField label="Target context"><select name="targetContext" defaultValue={definition.targetContext ?? ''} className={fieldClassName} disabled={hasUsage}>{targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><FormField label="Phase"><select name="phase" defaultValue={definition.phase ?? ''} className={fieldClassName} disabled={hasUsage}>{phaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><FormField label="Focus area"><select name="focusArea" defaultValue={definition.focusArea ?? ''} className={fieldClassName} disabled={hasUsage}>{focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><fieldset className="md:col-span-2" disabled={hasUsage}><legend className="text-sm font-bold">Age suitability</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{ageOptions.map((option) => <label key={option.value} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" name="agePhase" value={option.value} defaultChecked={definition.agePhases.includes(option.value)} /> {option.label}</label>)}</div></fieldset><label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold md:col-span-2"><input type="checkbox" name="requiresLocation" defaultChecked={definition.requiresLocation} disabled={hasUsage} /> Requires location</label>{hasUsage && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950 md:col-span-2">Semantic fields are disabled because this definition has observation usage. Create a new definition and retire this one for meaning changes.</p>}</>}<button className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white md:col-span-2">Save changes</button></form>
}

function ConfirmAction({ definitionId, action, label, prompt }: { definitionId: string; action: string; label: string; prompt: string }) {
  return <form action={runTransition} className="rounded-xl border p-4"><input type="hidden" name="definitionId" value={definitionId} /><input type="hidden" name="action" value={action} /><p className="text-sm font-semibold text-slate-700">{prompt}</p><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required /> I understand this action.</label><div className="mt-3"><Button type="submit" variant="secondary">{label}</Button></div></form>
}
