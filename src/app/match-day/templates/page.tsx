import Link from 'next/link'
import { notFound } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { getAccessibleTrackingTemplates } from '@/lib/trackingSetupTemplates'

export const dynamic = 'force-dynamic'

export default async function MatchDayTemplatesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!isMatchDayTrackingV2Enabled()) notFound()
  const user = await getCurrentUser()
  const { q } = await searchParams
  const templates = await getAccessibleTrackingTemplates({ userId: user.id, query: q })

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <Link href="/match-day" className="text-sm font-semibold text-blue-800 hover:underline">Back to Match Day</Link>
      <PageHeader title="Tracking templates" description="Reusable Match Day V2 tracking setups for standard events and tactical patterns." />
      <form className="mt-4 flex gap-2">
        <input name="q" defaultValue={q ?? ''} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Search by template, topic, event, pattern or alias" />
        <button className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white" type="submit">Search</button>
      </form>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {templates.length === 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">No templates found. Create one from the Match Day V2 review step.</p> : templates.map((template) => (
          <article key={template.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{template.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{template.visibility}{template.teamName ? ` · ${template.teamName}` : ''} · Revision {template.revision}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{template.taskCount} tasks</span>
            </div>
            {template.description && <p className="mt-3 text-sm text-slate-700">{template.description}</p>}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">Events</dt><dd className="text-lg font-bold">{template.eventCount}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">Patterns</dt><dd className="text-lg font-bold">{template.patternCount}</dd></div>
              <div className="rounded-xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">Scopes</dt><dd className="text-sm font-bold">{template.scopeSummary || 'None'}</dd></div>
            </dl>
            <p className="mt-3 text-xs font-semibold text-slate-500">Last used: {template.lastUsedAt ? new Intl.DateTimeFormat('en-GB').format(template.lastUsedAt) : 'Never'}</p>
          </article>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/match-day/new-v2" className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Use a template in setup</Link>
      </div>
    </main>
  )
}
