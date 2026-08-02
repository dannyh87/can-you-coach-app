import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import type { ClubTrackingDefinitionKind, EventDefinitionAgePhase, MatchTrackingScope, TrackingFocusArea, TrackingTargetContext, TrackingTopicPhase } from '@prisma/client'

import Alert from '@/components/ui/Alert'
import FormField from '@/components/ui/FormField'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import { fieldClassName, formGridClassName } from '@/components/ui/formStyles'
import { getCurrentUser } from '@/lib/auth'
import { createClubTrackingDefinitionDraft, getTrackingLibraryClubsForUser, searchExistingTrackingDefinitions } from '@/lib/clubTrackingDefinitions'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { prisma } from '@/lib/prisma'
import { ageOptions, BackToLibrary, focusOptions, formatKind, phaseOptions, proposalOptions, scopeOptions, targetOptions } from '../ui'

export const dynamic = 'force-dynamic'

type SearchParams = { clubId?: string; proposalType?: 'EVENT' | 'PATTERN'; q?: string; kind?: ClubTrackingDefinitionKind; standardId?: string; error?: string }

const getText = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

const optional = <T extends string>(value: string) => value ? value as T : null
const getAges = (formData: FormData) => formData.getAll('agePhase').filter((value): value is EventDefinitionAgePhase => typeof value === 'string' && ['FOUNDATION', 'YOUTH', 'ADULT'].includes(value))

async function requireCreateAccess(clubId: string) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const clubs = await getTrackingLibraryClubsForUser({ userId: user.id })
  const club = clubs.find((item) => item.id === clubId)
  if (!club || !['OWNER', 'COACH'].includes(club.role)) notFound()
  return { user, club }
}

async function createDefinitionAction(formData: FormData) {
  'use server'
  const clubId = getText(formData, 'clubId')
  const { user } = await requireCreateAccess(clubId)
  const kind = getText(formData, 'kind') as ClubTrackingDefinitionKind
  const proposalType = getText(formData, 'proposalType') as 'EVENT' | 'PATTERN'
  const result = await createClubTrackingDefinitionDraft({
    userId: user.id,
    input: {
      clubId,
      kind,
      name: getText(formData, 'name'),
      description: getText(formData, 'description'),
      guidance: getText(formData, 'guidance'),
      scopeType: optional<MatchTrackingScope>(getText(formData, 'scopeType')),
      targetContext: optional<TrackingTargetContext>(getText(formData, 'targetContext')),
      phase: optional<TrackingTopicPhase>(getText(formData, 'phase')),
      focusArea: optional<TrackingFocusArea>(getText(formData, 'focusArea')),
      agePhases: getAges(formData),
      requiresLocation: formData.get('requiresLocation') === 'on',
      mappedEventDefinitionId: getText(formData, 'mappedEventDefinitionId') || null,
      mappedPatternDefinitionId: getText(formData, 'mappedPatternDefinitionId') || null,
      searchToken: getText(formData, 'searchToken'),
      proposalType,
      nearDuplicateAcknowledged: formData.get('nearDuplicateAcknowledged') === 'on' || formData.get('customAcknowledged') === 'on',
      createAsDraft: formData.get('createAsDraft') === 'on',
    },
  })
  if (!result.ok) {
    const detail = result.fieldErrors?.warnings?.join(' ') || Object.values(result.fieldErrors ?? {}).flat().join(' ') || result.reason
    redirect(`/club-setup/tracking-library/new?clubId=${clubId}&proposalType=${proposalType}&q=${encodeURIComponent(getText(formData, 'name'))}&kind=${kind}&error=${encodeURIComponent(detail)}`)
  }
  revalidatePath('/club-setup/tracking-library')
  redirect(`/club-setup/tracking-library/${result.value.id}?created=1`)
}

export default async function NewTrackingDefinitionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const params = await searchParams
  const clubs = await getTrackingLibraryClubsForUser({ userId: user.id })
  const permittedClubs = clubs.filter((club) => club.role === 'OWNER' || club.role === 'COACH')
  if (permittedClubs.length === 0) notFound()
  const selectedClub = permittedClubs.find((club) => club.id === params.clubId) ?? permittedClubs[0]
  const proposalType = params.proposalType === 'PATTERN' ? 'PATTERN' : params.proposalType === 'EVENT' ? 'EVENT' : null
  const query = params.q?.trim() ?? ''
  const search = proposalType && query ? await searchExistingTrackingDefinitions({ userId: user.id, clubId: selectedClub.id, query }) : null
  const kind = params.kind
  const standardId = params.standardId
  const standardEvent = standardId && kind?.startsWith('EVENT') ? await prisma.eventDefinition.findFirst({ where: { id: standardId, scope: 'GLOBAL', isActive: true } }) : null
  const standardPattern = standardId && kind?.startsWith('PATTERN') ? await prisma.trackingPatternDefinition.findFirst({ where: { id: standardId, ownerScope: 'GLOBAL', active: true }, include: { steps: { orderBy: { stepOrder: 'asc' }, include: { eventDefinition: true } }, outcomes: { orderBy: { displayOrder: 'asc' } } } }) : null
  const canShowCreateForm = Boolean(search?.ok && kind && (kind === 'EVENT_CUSTOM' || standardEvent || standardPattern))

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <BackToLibrary clubId={selectedClub.id} />
      <PageHeader title="Create tracking definition" description="Search standard and club libraries before creating club terminology or a club-specific event." />
      {params.error && <Alert variant="error" className="mt-4">{params.error}</Alert>}

      <SectionCard className="mt-5" title="Step 1: What do you want to track?">
        <form className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Club
            <select name="clubId" defaultValue={selectedClub.id} className="mt-1 w-full rounded-xl border px-3 py-2">
              {permittedClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
          </label>
          <fieldset className="grid gap-2 sm:col-span-2" aria-describedby="proposal-help">
            <legend className="text-sm font-bold">Definition type</legend>
            <p id="proposal-help" className="text-sm text-slate-600">Choose whether this is one observable event or a tactical pattern.</p>
            {proposalOptions.map((option) => <label key={option.value} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-semibold"><input type="radio" name="proposalType" value={option.value} defaultChecked={proposalType === option.value} required /> {option.label}</label>)}
          </fieldset>
          <label className="text-sm font-semibold sm:col-span-2">Search existing definitions
            <input name="q" defaultValue={query} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="e.g. Break the line" required />
          </label>
          <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-2">Search before creating</button>
        </form>
      </SectionCard>

      {search?.ok && proposalType && (
        <SectionCard className="mt-5" title="Step 2: Search results" description="Choose an existing standard where possible. Custom club events are only available for one observable event.">
          {search.value.exactMatches.length > 0 && <ResultGroup title="Exact matches" rows={search.value.exactMatches.map((match) => ({ id: match.id, name: match.name, detail: match.source.replace('_', ' ') }))} />}
          <ResultGroup title="Existing club definitions" rows={search.value.clubCandidates.map((candidate) => ({ id: candidate.id, name: candidate.name, detail: `${formatKind(candidate.kind)} · ${candidate.status}` }))} />
          <div className="mt-4 grid gap-3">
            <h2 className="text-lg font-bold">Standard definitions</h2>
            {search.value.standardCandidates.filter((candidate) => candidate.itemType === proposalType).map((candidate) => (
              <article key={`${candidate.itemType}-${candidate.id}`} className="rounded-xl border p-4">
                <p className="font-bold">{candidate.name}</p>
                <p className="mt-1 text-sm text-slate-600">{candidate.itemType === 'EVENT' ? 'Standard event' : 'Standard tactical pattern'} · {candidate.description ?? 'No description'}</p>
                {'benchmarkable' in candidate && <p className="mt-1 text-sm font-semibold text-slate-700">{candidate.benchmarkable ? 'Benchmark eligible as a standard event' : 'Not benchmark eligible'}</p>}
                {'aliases' in candidate && candidate.aliases.length > 0 && <p className="mt-1 text-sm text-slate-600">Aliases: {candidate.aliases.join(', ')}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/club-setup/tracking-library?clubId=${selectedClub.id}`} className="rounded-lg border px-3 py-2 text-sm font-bold text-slate-800">Use standard</Link>
                  <Link href={createHref(selectedClub.id, proposalType, query, candidate.itemType === 'EVENT' ? 'EVENT_ALIAS' : 'PATTERN_ALIAS', candidate.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white">Create club alias</Link>
                  <Link href={createHref(selectedClub.id, proposalType, query, candidate.itemType === 'EVENT' ? 'EVENT_MAPPED' : 'PATTERN_MAPPED', candidate.id)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Create mapped definition</Link>
                </div>
              </article>
            ))}
            {proposalType === 'EVENT' && <Link href={createHref(selectedClub.id, proposalType, query, 'EVENT_CUSTOM')} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">No suitable standard? Create a club-specific event</Link>}
          </div>
          {search.value.warnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Similar matches</p>{search.value.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
        </SectionCard>
      )}

      {canShowCreateForm && search?.ok && proposalType && (
        <SectionCard className="mt-5" title={`Step 3: ${formatKind(kind!)}`} description="If the club-facing name changes materially, search again before saving.">
          <form action={createDefinitionAction} className={formGridClassName}>
            <input type="hidden" name="clubId" value={selectedClub.id} />
            <input type="hidden" name="proposalType" value={proposalType} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="searchToken" value={search.value.searchToken} />
            {standardEvent && <input type="hidden" name="mappedEventDefinitionId" value={standardEvent.id} />}
            {standardPattern && <input type="hidden" name="mappedPatternDefinitionId" value={standardPattern.id} />}
            {(standardEvent || standardPattern) && <InheritedStandard event={standardEvent} pattern={standardPattern} />}
            <DefinitionFields defaultName={query} isAlias={kind!.endsWith('ALIAS')} isCustom={kind === 'EVENT_CUSTOM'} role={selectedClub.role} />
            <button className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white md:col-span-2">Create definition</button>
          </form>
        </SectionCard>
      )}
    </main>
  )
}

function createHref(clubId: string, proposalType: 'EVENT' | 'PATTERN', query: string, kind: ClubTrackingDefinitionKind, standardId?: string) {
  const params = new URLSearchParams({ clubId, proposalType, q: query, kind })
  if (standardId) params.set('standardId', standardId)
  return `/club-setup/tracking-library/new?${params.toString()}`
}

function ResultGroup({ title, rows }: { title: string; rows: Array<{ id: string; name: string; detail: string }> }) {
  if (rows.length === 0) return null
  return <section className="mt-4"><h2 className="text-lg font-bold">{title}</h2><div className="mt-2 grid gap-2">{rows.map((row) => <article key={row.id} className="rounded-xl border bg-slate-50 p-3"><p className="font-bold">{row.name}</p><p className="text-sm text-slate-600">{row.detail}</p></article>)}</div></section>
}

function InheritedStandard({ event, pattern }: { event: { name: string; description: string | null; requiresLocation: boolean; benchmarkable: boolean } | null; pattern: { name: string; description: string | null; requiresLocation: boolean; steps: Array<{ id: string; label: string | null; eventDefinition: { name: string } }>; outcomes: Array<{ id: string; label: string }> } | null }) {
  return <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950 md:col-span-2"><p className="font-bold">Inherited standard identity: {event?.name ?? pattern?.name}</p><p className="mt-1">{event?.description ?? pattern?.description ?? 'No description provided.'}</p><p className="mt-1 font-semibold">{event?.requiresLocation || pattern?.requiresLocation ? 'Requires location' : 'No required location'}{event ? ` · ${event.benchmarkable ? 'Benchmark eligible' : 'Not benchmark eligible'}` : ''}</p>{pattern && <><p className="mt-3 font-bold">Standard steps</p><ol className="list-decimal pl-5">{pattern.steps.map((step) => <li key={step.id}>{step.label ?? step.eventDefinition.name}</li>)}</ol><p className="mt-3 font-bold">Standard outcomes</p><ul className="list-disc pl-5">{pattern.outcomes.map((outcome) => <li key={outcome.id}>{outcome.label}</li>)}</ul></>}</div>
}

function DefinitionFields({ defaultName, isAlias, isCustom, role }: { defaultName: string; isAlias: boolean; isCustom: boolean; role: string }) {
  return <>
    <FormField label="Club-facing name"><input name="name" defaultValue={defaultName} className={fieldClassName} required /></FormField>
    <FormField label="Description"><textarea name="description" className={fieldClassName} rows={3} /></FormField>
    <div className="md:col-span-2"><FormField label="Coach guidance"><textarea name="guidance" className={fieldClassName} rows={3} /></FormField></div>
    {!isAlias && <><FormField label="Scope"><select name="scopeType" className={fieldClassName}>{scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><FormField label="Target context"><select name="targetContext" className={fieldClassName}>{targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><FormField label="Phase"><select name="phase" className={fieldClassName}>{phaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><FormField label="Focus area"><select name="focusArea" className={fieldClassName}>{focusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FormField><fieldset className="md:col-span-2"><legend className="text-sm font-bold">Age suitability</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{ageOptions.map((option) => <label key={option.value} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" name="agePhase" value={option.value} defaultChecked={option.value === 'YOUTH'} /> {option.label}</label>)}</div></fieldset><label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold md:col-span-2"><input type="checkbox" name="requiresLocation" /> Requires location</label></>}
    {isCustom && <label className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950 md:col-span-2"><input type="checkbox" name="customAcknowledged" required className="mr-2" /> This is a club-specific observation. It will not be included in standard comparisons or global benchmarks.</label>}
    <label className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950 md:col-span-2"><input type="checkbox" name="nearDuplicateAcknowledged" className="mr-2" /> I have reviewed duplicate and pattern-like warnings and want to continue if warnings apply.</label>
    {role === 'OWNER' && <label className="rounded-xl border bg-slate-50 p-4 text-sm font-semibold md:col-span-2"><input type="checkbox" name="createAsDraft" className="mr-2" /> Save as draft instead of approving immediately</label>}
  </>
}
