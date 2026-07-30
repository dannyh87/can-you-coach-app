import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import {
  focusAreaLabels,
  getAdvancedCompatibleEvents,
  getAvailableFocusAreas,
  getAvailablePhases,
  getAvailableTargetContexts,
  getAvailableTopics,
  getNextTrackingQuestion,
  getRecommendedEventsForTopic,
  searchTrackingTopics,
  targetContextLabels,
  topicPhaseLabels,
  type TrackingResolverContext,
} from '@/lib/matchTrackingResolver'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import type { MatchTrackingScope, TrackingFocusArea, TrackingTargetContext, TrackingTopicPhase } from '@prisma/client'

export const dynamic = 'force-dynamic'

const explorerEnabled = () => process.env.ENABLE_MATCH_TRACKING_TAXONOMY_DEV_EXPLORER === 'true'
const scopes = ['PLAYER', 'UNIT', 'TEAM'] as const satisfies MatchTrackingScope[]

type SearchParams = { scope?: string; targetContext?: string; phase?: string; focusArea?: string; topicId?: string; q?: string }

const validScope = (value?: string): MatchTrackingScope | undefined => scopes.includes(value as MatchTrackingScope) ? value as MatchTrackingScope : undefined
const validTarget = (value?: string): TrackingTargetContext | undefined => value && value in targetContextLabels ? value as TrackingTargetContext : undefined
const validPhase = (value?: string): TrackingTopicPhase | undefined => value && value in topicPhaseLabels ? value as TrackingTopicPhase : undefined
const validFocus = (value?: string): TrackingFocusArea | undefined => value && value in focusAreaLabels ? value as TrackingFocusArea : undefined

function hrefWith(params: TrackingResolverContext & { q?: string }) {
  const search = new URLSearchParams()
  if (params.scope) search.set('scope', params.scope)
  if (params.targetContext) search.set('targetContext', params.targetContext)
  if (params.phase) search.set('phase', params.phase)
  if (params.focusArea) search.set('focusArea', params.focusArea)
  if (params.topicId) search.set('topicId', params.topicId)
  if (params.q) search.set('q', params.q)
  return `/dev/match-tracking-taxonomy?${search.toString()}`
}

export default async function MatchTrackingTaxonomyExplorer({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (!explorerEnabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()
  const params = await searchParams
  const context: TrackingResolverContext = { scope: validScope(params.scope), targetContext: validTarget(params.targetContext), phase: validPhase(params.phase), focusArea: validFocus(params.focusArea), topicId: params.topicId }
  const targetStep = getAvailableTargetContexts(context)
  const phaseStep = await getAvailablePhases(context)
  const focusStep = await getAvailableFocusAreas(context)
  const topicStep = await getAvailableTopics(context)
  const nextStep = await getNextTrackingQuestion(context)
  const resolvedTopic = context.topicId ? await getRecommendedEventsForTopic(context.topicId, context) : null
  const advancedEvents = await getAdvancedCompatibleEvents(context)
  const searchResults = params.q ? await searchTrackingTopics(params.q, context) : []

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:p-6">
      <PageHeader title="Match Tracking Taxonomy Explorer" description="Development-only resolver diagnostics. This is not the coach setup wizard." />
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">ENABLE_MATCH_TRACKING_TAXONOMY_DEV_EXPLORER is enabled. Do not expose this route publicly.</section>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-bold">Context</h2>
          <OptionGroup label="Scope" options={scopes.map((scope) => ({ value: scope, label: scope }))} selected={context.scope} getHref={(value) => hrefWith({ scope: value as MatchTrackingScope })} />
          {targetStep && <OptionGroup label={targetStep.label} options={targetStep.options} selected={context.targetContext} getHref={(value) => hrefWith({ scope: context.scope, targetContext: value as TrackingTargetContext })} />}
          <OptionGroup label="Phase" options={phaseStep.options} selected={context.phase} getHref={(value) => hrefWith({ scope: context.scope, targetContext: context.targetContext, phase: value as TrackingTopicPhase })} />
          <OptionGroup label={focusStep.label} options={focusStep.options} selected={context.focusArea} getHref={(value) => hrefWith({ scope: context.scope, targetContext: context.targetContext, phase: context.phase, focusArea: value as TrackingFocusArea })} />
          <form className="mt-5 grid gap-2" action="/dev/match-tracking-taxonomy">
            {Object.entries(params).map(([key, value]) => key !== 'q' && value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
            <label className="text-sm font-bold text-slate-700">Search topics or aliases<input name="q" defaultValue={params.q ?? ''} className="mt-1 w-full rounded-xl border p-2" placeholder="third man" /></label>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Search</button>
          </form>
        </section>
        <section className="space-y-5">
          <Panel title="Next question"><pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50">{JSON.stringify(nextStep, null, 2)}</pre></Panel>
          <Panel title="Topics">
            {topicStep.noResultsReason && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{topicStep.noResultsReason}</p>}
            <div className="grid gap-2 sm:grid-cols-2">{topicStep.options.map((option) => <Link key={option.value} href={hrefWith({ ...context, topicId: option.value })} className={`rounded-xl border p-3 text-sm ${option.value === context.topicId ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}><p className="font-bold">{option.label}</p><p className="text-slate-600">{option.description}</p></Link>)}</div>
          </Panel>
          <Panel title="Search results"><pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50">{JSON.stringify(searchResults, null, 2)}</pre></Panel>
          <Panel title="Resolved topic"><pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50">{JSON.stringify(resolvedTopic, null, 2)}</pre></Panel>
          <Panel title="Advanced-compatible events"><pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-50">{JSON.stringify(advancedEvents.slice(0, 30), null, 2)}</pre></Panel>
        </section>
      </div>
    </main>
  )
}

function OptionGroup({ label, options, selected, getHref }: { label: string; options: Array<{ value: string; label: string }>; selected?: string; getHref: (value: string) => string }) {
  if (options.length === 0) return <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No {label.toLowerCase()} options for this context.</p>
  return <div className="mt-4"><h3 className="text-sm font-bold text-slate-700">{label}</h3><div className="mt-2 flex flex-wrap gap-2">{options.map((option) => <Link key={option.value} href={getHref(option.value)} className={`rounded-full border px-3 py-2 text-sm font-bold ${selected === option.value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}>{option.label}</Link>)}</div></div>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="mb-3 text-xl font-bold">{title}</h2>{children}</section>
}
