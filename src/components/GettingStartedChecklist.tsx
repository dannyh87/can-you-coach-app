import Link from 'next/link'

import type { OnboardingState } from '@/lib/onboarding'

type GettingStartedChecklistProps = {
  state: OnboardingState
}

export default function GettingStartedChecklist({ state }: GettingStartedChecklistProps) {
  if (state.kind === 'complete') {
    return (
      <section className="mt-6 rounded-2xl border border-green-100 bg-green-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-700">Setup ready</p>
            <h2 className="mt-1 text-xl font-extrabold text-green-950">Your coaching workspace is ready.</h2>
            <p className="mt-1 text-sm text-green-800">
              Keep going with fitness testing, match day or squad updates when you need them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryLink href={state.primaryCta.href}>{state.primaryCta.label}</PrimaryLink>
            {state.secondaryCtas.map((cta) => (
              <SecondaryLink key={cta.href} href={cta.href}>{cta.label}</SecondaryLink>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (state.kind === 'assistant') {
    return (
      <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Assistant Coach</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-950">You are ready to help record sessions and matches.</h2>
            <p className="mt-2 text-sm text-blue-900">
              You have recording access for {state.assignedTeamCount} assigned team{state.assignedTeamCount === 1 ? '' : 's'}. Club admins and coaches handle setup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryLink href={state.primaryCta.href}>{state.primaryCta.label}</PrimaryLink>
            {state.secondaryCtas.map((cta) => (
              <SecondaryLink key={cta.href} href={cta.href}>{cta.label}</SecondaryLink>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (state.kind === 'parent') {
    return (
      <section className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-700">Parent Contributor</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-amber-950">Follow your linked player and share match observations.</h2>
            <p className="mt-2 text-sm text-amber-900">
              You are linked to {state.linkedPlayerCount} player{state.linkedPlayerCount === 1 ? '' : 's'}. You can view their page and submit observations when a linked player has a live match.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryLink href={state.primaryCta.href}>{state.primaryCta.label}</PrimaryLink>
            {state.secondaryCtas.map((cta) => (
              <SecondaryLink key={cta.href} href={cta.href}>{cta.label}</SecondaryLink>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (state.kind === 'no_access') {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Access needed</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-950">You do not currently have access to a club, team or player.</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Ask a club admin to invite you to a club/team or link you to a player before using Can You Coach.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="grid gap-4 bg-gradient-to-br from-white to-blue-50 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Getting started</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Get ready for your first session</h2>
          <p className="mt-2 text-sm text-slate-600">
            Progress: {state.completedCount} of {state.totalCount} complete. Follow the next step, then come back when you are ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryLink href={state.primaryCta.href}>{state.primaryCta.label}</PrimaryLink>
          {state.secondaryCtas.slice(0, 2).map((cta) => (
            <SecondaryLink key={cta.href} href={cta.href}>{cta.label}</SecondaryLink>
          ))}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-5">
        {state.items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`rounded-xl border p-3 transition hover:border-blue-300 hover:bg-blue-50/60 ${item.complete ? 'border-green-100 bg-green-50' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-extrabold ${item.complete ? 'bg-green-700 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {item.complete ? '✓' : '·'}
              </span>
              <h3 className="font-bold text-slate-950">{item.label}</h3>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900">
      {children}
    </Link>
  )
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50">
      {children}
    </Link>
  )
}
