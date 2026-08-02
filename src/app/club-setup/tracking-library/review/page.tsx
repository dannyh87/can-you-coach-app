import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'

import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import FormField from '@/components/ui/FormField'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName } from '@/components/ui/formStyles'
import { getCurrentUser } from '@/lib/auth'
import { approveClubTrackingDefinition, getClubTrackingDefinitionUsage, getClubTrackingReportingIdentity, getTrackingLibraryClubsForUser, getTrackingLibraryForUser, rejectClubTrackingDefinition } from '@/lib/clubTrackingDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { BackToLibrary, displayDate, formatKind, formatMappingStatus, standardName, StatusPill } from '../ui'

export const dynamic = 'force-dynamic'

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function reviewAction(formData: FormData) {
  'use server'
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const clubId = getText(formData, 'clubId')
  const definitionId = getText(formData, 'definitionId')
  const action = getText(formData, 'action')
  const result = action === 'approve'
    ? await approveClubTrackingDefinition({ userId: user.id, definitionId })
    : await rejectClubTrackingDefinition({ userId: user.id, definitionId, reason: getText(formData, 'rejectionReason') })
  if (!result.ok) redirect(`/club-setup/tracking-library/review?clubId=${clubId}&error=${encodeURIComponent(result.reason)}`)
  revalidatePath('/club-setup/tracking-library')
  revalidatePath('/club-setup/tracking-library/review')
  redirect(`/club-setup/tracking-library/review?clubId=${clubId}&success=1`)
}

export default async function TrackingLibraryReviewPage({ searchParams }: { searchParams: Promise<{ clubId?: string; error?: string; success?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const params = await searchParams
  const clubs = (await getTrackingLibraryClubsForUser({ userId: user.id })).filter((club) => club.role === 'OWNER')
  if (clubs.length === 0) notFound()
  const selectedClub = clubs.find((club) => club.id === params.clubId) ?? clubs[0]
  const library = await getTrackingLibraryForUser({ userId: user.id, clubId: selectedClub.id, includeRetired: false })
  if (!library.ok || library.value.role !== 'OWNER') notFound()
  const pending = library.value.definitions.filter((definition) => definition.status === 'PENDING_REVIEW')
  const usagePairs = await Promise.all(pending.map(async (definition) => [definition.id, await getClubTrackingDefinitionUsage({ userId: user.id, definitionId: definition.id })] as const))
  const identities = new Map(await Promise.all(pending.map(async (definition) => [definition.id, await getClubTrackingReportingIdentity({ clubTrackingDefinitionId: definition.id })] as const)))
  const usage = new Map(usagePairs)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <BackToLibrary clubId={selectedClub.id} />
      <PageHeader title="Tracking definition review" description="Approve club use or reject coach-created definitions with feedback." />
      {params.error && <Alert variant="error" className="mt-4">{params.error}</Alert>}
      {params.success && <Alert variant="success" className="mt-4">Review action saved.</Alert>}

      <form className="mt-4 rounded-2xl border bg-white p-4">
        <label className="text-sm font-semibold">Club
          <select name="clubId" defaultValue={selectedClub.id} className="mt-1 w-full rounded-xl border px-3 py-2">
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </label>
        <button className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Change club</button>
      </form>

      <SectionCard className="mt-5" title={`Pending definitions (${pending.length})`}>
        {pending.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">There are no definitions waiting for owner review.</p> : <div className="grid gap-4">{pending.map((definition) => {
          const usageResult = usage.get(definition.id)
          const identity = identities.get(definition.id)
          return <article key={definition.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">{definition.name}</h2><p className="mt-1 text-sm font-semibold text-slate-700">{formatKind(definition.kind)}{standardName(definition) ? ` for ${standardName(definition)}` : ''}</p><p className="mt-1 text-sm text-slate-600">Created by {definition.createdBy.email} · Submitted {displayDate(definition.submittedAt)}</p></div><Link href={`/club-setup/tracking-library/${definition.id}`} className="rounded-lg border px-3 py-2 text-sm font-bold text-blue-800">View details</Link></div><div className="mt-3 flex flex-wrap gap-2"><StatusPill tone="amber">Mapping: {formatMappingStatus(definition.mappingStatus)}</StatusPill><StatusPill tone={identity?.ok && identity.value.contributesToStandardReporting ? 'green' : 'slate'}>{identity?.ok && identity.value.contributesToStandardReporting ? 'Standard reporting' : 'Club reporting only for now'}</StatusPill></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold">Usage before approval: {usageResult?.ok ? usageResult.value.totalReferences : 'Unavailable'} references</p><div className="mt-4 grid gap-3 md:grid-cols-2"><form action={reviewAction} className="rounded-xl border border-green-200 bg-green-50 p-4"><input type="hidden" name="clubId" value={selectedClub.id} /><input type="hidden" name="definitionId" value={definition.id} /><input type="hidden" name="action" value="approve" /><p className="text-sm font-semibold text-green-950">Approve this definition for use across the club? Standard mapping approval remains separate.</p><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required /> I understand.</label><Button type="submit" variant="secondary" className="mt-3">Approve for club use</Button></form><form action={reviewAction} className="rounded-xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="clubId" value={selectedClub.id} /><input type="hidden" name="definitionId" value={definition.id} /><input type="hidden" name="action" value="reject" /><FormField label="Rejection feedback"><textarea name="rejectionReason" className={fieldClassName} required rows={3} /></FormField><label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" required /> Reject with this feedback.</label><Button type="submit" variant="secondary" className="mt-3">Reject</Button></form></div></article>
        })}</div>}
      </SectionCard>
    </main>
  )
}
