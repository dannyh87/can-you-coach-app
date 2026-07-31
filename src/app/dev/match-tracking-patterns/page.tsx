import { notFound } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { isMatchTrackingPatternDevExplorerEnabled } from '@/lib/features'
import { getAdvancedCompatibleTrackingItems, type TrackingResolverContext } from '@/lib/matchTrackingResolver'
import { prisma } from '@/lib/prisma'
import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import { createPatternObservation, reviewPatternObservation, undoPendingPatternObservation, validatePatternContext } from '@/lib/trackingPatterns'

export const dynamic = 'force-dynamic'

const scopes = ['PLAYER', 'UNIT', 'TEAM'] as const
const targets = ['CENTRE_FORWARD', 'WIDE_PLAYER', 'FULL_BACK', 'DEFENSIVE_UNIT', 'MIDFIELD_UNIT', 'ATTACKING_UNIT', 'PRESSING_UNIT', 'WHOLE_TEAM'] as const
const phases = ['IN_POSSESSION', 'OUT_OF_POSSESSION', 'ATTACKING_TRANSITION', 'DEFENSIVE_TRANSITION'] as const
const focusAreas = ['LINK_PLAY', 'PROGRESSION', 'COMBINATION_PLAY', 'PRESSING', 'PROTECTING_SPACE_BEHIND', 'DEFENDING_WIDE_AREAS', 'ATTACKING_TRANSITION', 'DEFENSIVE_TRANSITION'] as const

async function createDisposableObservation(formData: FormData) {
  'use server'
  const user = await getCurrentUser()
  if (!isMatchTrackingPatternDevExplorerEnabled() || !canManageGlobalEventLibrary(user)) return
  await createPatternObservation({ assignmentId: String(formData.get('assignmentId') ?? ''), actorUserId: user.id, patternId: String(formData.get('patternId') ?? ''), outcomeId: String(formData.get('outcomeId') ?? ''), playerId: String(formData.get('playerId') ?? '') || null, note: `CYCV2-PATTERN-EXPLORER ${String(formData.get('note') ?? '')}`.trim() })
}

async function reviewDisposableObservation(formData: FormData) {
  'use server'
  const user = await getCurrentUser()
  if (!isMatchTrackingPatternDevExplorerEnabled() || !canManageGlobalEventLibrary(user)) return
  const decision = String(formData.get('decision')) === 'IGNORED' ? 'IGNORED' : 'ACCEPTED'
  await reviewPatternObservation({ actorUserId: user.id, observationId: String(formData.get('observationId') ?? ''), decision })
}

async function undoDisposableObservation(formData: FormData) {
  'use server'
  const user = await getCurrentUser()
  if (!isMatchTrackingPatternDevExplorerEnabled() || !canManageGlobalEventLibrary(user)) return
  await undoPendingPatternObservation({ actorUserId: user.id, assignmentId: String(formData.get('assignmentId') ?? ''), observationId: String(formData.get('observationId') ?? '') })
}

export default async function MatchTrackingPatternsExplorer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isMatchTrackingPatternDevExplorerEnabled()) notFound()
  const user = await getCurrentUser()
  if (!canManageGlobalEventLibrary(user)) notFound()
  const query = await searchParams
  const context: TrackingResolverContext = {
    scope: (query.scope as TrackingResolverContext['scope']) || 'TEAM',
    targetContext: query.targetContext as TrackingResolverContext['targetContext'],
    phase: (query.phase as TrackingResolverContext['phase']) || 'IN_POSSESSION',
    focusArea: (query.focusArea as TrackingResolverContext['focusArea']) || 'PROGRESSION',
    clubId: query.clubId || undefined,
    topicId: query.topicId || undefined,
  }
  const items = await getAdvancedCompatibleTrackingItems(context)
  const selectedPattern = query.patternId ? items.patterns.find((pattern) => pattern.patternId === query.patternId) : items.patterns[0]
  const validation = selectedPattern ? await validatePatternContext({ patternId: selectedPattern.patternId, scopeType: context.scope!, targetContext: context.targetContext, clubId: context.clubId }) : null
  const observations = await prisma.submittedTrackingPatternObservation.findMany({ where: { note: { startsWith: 'CYCV2-PATTERN-EXPLORER' } }, include: { pattern: true, outcome: true, submittedBy: { select: { email: true } }, officialObservation: true }, orderBy: { createdAt: 'desc' }, take: 20 })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader title="Match Tracking Pattern Explorer" description="Development-only inspection for structured tactical patterns, outcomes and resolver compatibility." />
      <form className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-5">
        <select name="scope" defaultValue={context.scope}>{scopes.map((value) => <option key={value}>{value}</option>)}</select>
        <select name="targetContext" defaultValue={context.targetContext ?? ''}><option value="">Any target</option>{targets.map((value) => <option key={value}>{value}</option>)}</select>
        <select name="phase" defaultValue={context.phase}>{phases.map((value) => <option key={value}>{value}</option>)}</select>
        <select name="focusArea" defaultValue={context.focusArea}>{focusAreas.map((value) => <option key={value}>{value}</option>)}</select>
        <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Inspect</button>
      </form>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-bold">Compatible Patterns</h2>
          <div className="mt-3 grid gap-3">{items.patterns.map((pattern) => <article key={pattern.patternId} className="rounded-xl border p-3"><p className="font-bold">{pattern.name}</p><p className="text-sm text-slate-600">{pattern.recommendedByTopic ? 'Recommended by topic' : 'Compatible'} · {pattern.requiresLocation ? 'Requires location' : 'No required location'}</p><p className="mt-1 text-xs text-slate-500">Aliases: {pattern.aliases.join(', ') || 'None'}</p><p className="mt-2 text-sm font-semibold">Steps</p><ol className="list-decimal pl-5 text-sm">{pattern.steps.map((step) => <li key={`${pattern.patternId}-${step.order}`}>{step.label}</li>)}</ol><p className="mt-2 text-sm font-semibold">Outcomes</p><ul className="list-disc pl-5 text-sm">{pattern.outcomes.map((outcome) => <li key={outcome.id}>{outcome.label}</li>)}</ul></article>)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="text-xl font-bold">Validation</h2>
          <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-white">{JSON.stringify({ context, selectedPattern, validation }, null, 2)}</pre>
          <form action={createDisposableObservation} className="mt-4 grid gap-2">
            <h3 className="font-bold">Create Disposable Observation</h3>
            <input name="assignmentId" placeholder="Assignment ID" className="rounded border p-2" />
            <input name="patternId" defaultValue={selectedPattern?.patternId ?? ''} placeholder="Pattern ID" className="rounded border p-2" />
            <input name="outcomeId" defaultValue={selectedPattern?.outcomes[0]?.id ?? ''} placeholder="Outcome ID" className="rounded border p-2" />
            <input name="playerId" placeholder="Player ID for PLAYER scope" className="rounded border p-2" />
            <input name="note" placeholder="Disposable note" className="rounded border p-2" />
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Create pending pattern observation</button>
          </form>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-4">
        <h2 className="text-xl font-bold">Disposable Observations</h2>
        <div className="mt-3 grid gap-3">{observations.map((observation) => <article key={observation.id} className="rounded-xl border p-3"><p className="font-bold">{observation.pattern.name} · {observation.outcome.label}</p><p className="text-sm text-slate-600">{observation.status} · {observation.submittedBy.email} · Official: {observation.officialObservation ? 'yes' : 'no'}</p><div className="mt-2 flex flex-wrap gap-2"><form action={reviewDisposableObservation}><input type="hidden" name="observationId" value={observation.id} /><input type="hidden" name="decision" value="ACCEPTED" /><button className="rounded bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Accept</button></form><form action={reviewDisposableObservation}><input type="hidden" name="observationId" value={observation.id} /><input type="hidden" name="decision" value="IGNORED" /><button className="rounded border px-3 py-2 text-sm font-bold">Ignore</button></form><form action={undoDisposableObservation}><input type="hidden" name="observationId" value={observation.id} /><input type="hidden" name="assignmentId" value={observation.assignmentId} /><button className="rounded border px-3 py-2 text-sm font-bold">Undo pending</button></form></div></article>)}</div>
      </section>
    </main>
  )
}
