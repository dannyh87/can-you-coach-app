import type { OnboardingRole } from '@prisma/client'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import PageHeader from '@/components/ui/PageHeader'
import { getCurrentUser } from '@/lib/auth'
import { completeOnboarding } from '@/lib/firstTimeOnboarding'

export const dynamic = 'force-dynamic'

type RoleCard = {
  role: OnboardingRole
  title: string
  blurb: string
  cta: string
  accent: string
}

const roleCards: RoleCard[] = [
  {
    role: 'CLUB_OFFICIAL',
    title: 'Club Official / Head Coach',
    blurb: 'Set up and manage your club. Create teams, add players, invite coaches, manage club settings and view information across the club.',
    cta: 'Create or manage a club',
    accent: 'from-emerald-600 to-teal-700',
  },
  {
    role: 'COACH',
    title: 'Coach / Assistant Coach',
    blurb: 'Work with a team you coach. View and record information for players in your team, including match day events, fitness tests and progress over time.',
    cta: 'Join a club or team',
    accent: 'from-blue-600 to-sky-700',
  },
  {
    role: 'PARENT_SPECTATOR',
    title: 'Parent / Spectator',
    blurb: 'Follow or record information for one player. You may be linked to a club and team by invite, or later use Can You Coach independently to track your own child’s progress.',
    cta: 'Track one player',
    accent: 'from-amber-500 to-orange-600',
  },
]

const roleValues = roleCards.map((card) => card.role)

async function chooseRole(formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  const role = formData.get('role')

  if (typeof role !== 'string' || !roleValues.includes(role as OnboardingRole)) {
    redirect('/onboarding')
  }

  await completeOnboarding(user.id, role as OnboardingRole)

  if (role === 'CLUB_OFFICIAL') redirect('/club-setup')
  if (role === 'COACH') redirect('/onboarding?result=coach')
  redirect('/onboarding?result=parent')
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>
}) {
  await getCurrentUser()
  const { result } = await searchParams

  if (result === 'coach') return <CoachResult />
  if (result === 'parent') return <ParentResult />

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#ffffff_60%)] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-800">
            First setup step
          </p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Who are you?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Choose the option that best describes how you’ll use Can You Coach. This helps us guide you to the right setup — it does not grant access by itself.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {roleCards.map((card) => (
            <form key={card.role} action={chooseRole}>
              <input type="hidden" name="role" value={card.role} />
              <button
                type="submit"
                className="group flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                <span className={`block h-2 w-full bg-gradient-to-r ${card.accent}`} />
                <span className="flex flex-1 flex-col p-5 sm:p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white shadow-sm transition group-hover:bg-emerald-700">
                    {card.title.slice(0, 1)}
                  </span>
                  <span className="mt-5 text-2xl font-black tracking-tight text-slate-950">
                    {card.title}
                  </span>
                  <span className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                    {card.blurb}
                  </span>
                  <span className="mt-6 inline-flex items-center justify-center rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-extrabold text-white transition group-hover:bg-emerald-800">
                    {card.cta}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </div>

        <p className="mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600 shadow-sm">
          Access is added only when you create a club, accept a valid invite, or already have club, team or player access linked to your account.
        </p>
      </div>
    </main>
  )
}

function CoachResult() {
  return (
    <ResultShell
      eyebrow="Coach setup"
      title="You’ll usually join by invite."
      description="Coaches and assistants normally need an invite from a club official or head coach before team access appears."
      primaryHref="/"
      primaryLabel="Go to dashboard"
    >
      <GuidanceList
        items={[
          'If you already have an invite link, open that link and accept it while signed in with the invited email.',
          'If you do not have a link yet, ask the club official to invite you from Club Setup → Access.',
          'Choosing Coach here does not grant access to any club or team by itself.',
        ]}
      />
    </ResultShell>
  )
}

function ParentResult() {
  return (
    <ResultShell
      eyebrow="Parent and spectator setup"
      title="You’ll usually be linked to one player by invite."
      description="Parents and spectators normally receive access to a specific player from a coach or club official."
      primaryHref="/my-player"
      primaryLabel="Go to My Player"
      secondaryHref="/"
      secondaryLabel="Go to dashboard"
    >
      <GuidanceList
        items={[
          'If you already have an invite link, open that link and accept it while signed in with the invited email.',
          'If you do not have a link yet, ask the coach or club official to invite you for the player you follow.',
          'Choosing Parent / Spectator here does not grant club, team or player access by itself.',
        ]}
      />
    </ResultShell>
  )
}

function ResultShell({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:p-6">
      <PageHeader title={title} description={description} />
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
        {children}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={primaryHref} className="inline-flex justify-center rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-800">
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref} className="inline-flex justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50">
              {secondaryLabel}
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}

function GuidanceList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 grid gap-3">
      {items.map((item) => (
        <li key={item} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950">
          {item}
        </li>
      ))}
    </ul>
  )
}
