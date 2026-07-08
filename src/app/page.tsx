import Link from 'next/link'
import { redirect } from 'next/navigation'

import ActionLink from '@/components/ui/ActionLink'
import DashboardSnapshot from '@/components/DashboardSnapshot'
import EmptyState from '@/components/ui/EmptyState'
import GettingStartedChecklist from '@/components/GettingStartedChecklist'
import NeedsAttentionPanel from '@/components/NeedsAttentionPanel'
import ParentDashboardPanel from '@/components/ParentDashboardPanel'
import RecentReportsPanel from '@/components/RecentReportsPanel'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { accessibleMatchWhere, accessibleSessionWhere, accessibleTeamWhere } from '@/lib/accessWhere'
import { getOptionalCurrentUser } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import { formatFitnessSessionStatus } from '@/lib/fitnessSessionStatus'
import { shouldRedirectToOnboarding } from '@/lib/firstTimeOnboarding'
import { getOnboardingState } from '@/lib/onboarding'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const actionCards = [
  {
    href: '/fitness',
    eyebrow: 'Fitness',
    title: 'Start Fitness Test',
    description: 'Create a test, continue a live session, or review recent results.',
    tone: 'emerald',
  },
  {
    href: '/match-day',
    eyebrow: 'Touchline',
    title: 'Start Match Day',
    description: 'Prepare the squad, start the clock, update score and record events.',
    tone: 'teal',
  },
  {
    href: '/players',
    eyebrow: 'Squad',
    title: 'Manage Squad',
    description: 'Add players, update positions and keep squad numbers tidy.',
    tone: 'slate',
  },
  {
    href: '/reports/team-trends',
    eyebrow: 'Review',
    title: 'Team Event Trends',
    description: 'Spot how selected match events change across completed games.',
    tone: 'amber',
  },
  {
    href: '/club-setup',
    eyebrow: 'Setup',
    title: 'Club Setup',
    description: 'Manage clubs, teams, seasons and benchmark context.',
    tone: 'slate',
  },
]

const audienceCards = [
  {
    title: 'Coaches',
    description: 'Record what happened without losing focus on the players in front of you.',
  },
  {
    title: 'Club owners & head coaches',
    description: 'Create a shared way to track teams, player development and club priorities.',
  },
  {
    title: 'Assistants & analysts',
    description: 'Capture match moments, support reviews and spot useful patterns over time.',
  },
  {
    title: 'Parents & spectators',
    description: 'Give families a clearer connection to progress without opening up club admin.',
  },
]

const featureCards = [
  {
    title: 'Match Day Tracking',
    description: 'Track shots, passes, goals, assists, touches and the events your club cares about.',
  },
  {
    title: 'Fitness Testing',
    description: 'Run simple tests, save results and compare player progress across sessions.',
  },
  {
    title: 'Player Progress',
    description: 'Build a useful history around each player, not just a one-off memory from the weekend.',
  },
  {
    title: 'Club & Team Setup',
    description: 'Keep clubs, squads, seasons and teams organised before training or match day starts.',
  },
  {
    title: 'Custom Events',
    description: 'Create club-specific match events so your data reflects the way you coach.',
  },
  {
    title: 'Reports & Trends',
    description: 'Review completed matches and spot trends that support better coaching conversations.',
  },
]

const workflowSteps = [
  {
    step: '01',
    title: 'Set up your club and teams',
    description: 'Add the basics once so coaches can focus on the session, not the spreadsheet.',
  },
  {
    step: '02',
    title: 'Track matches and fitness tests',
    description: 'Use pitch-side tools that are quick enough for real grassroots football.',
  },
  {
    step: '03',
    title: 'Review progress and share insight',
    description: 'Use simple evidence to shape development plans, parent updates and team reviews.',
  },
]

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)

const formatMatchStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

const formatMatchType = (matchType: string) =>
  matchType.charAt(0) + matchType.slice(1).toLowerCase()

const getFitnessSessionHref = (session: {
  id: string
  fitnessTestType: {
    allowedRecordingModes: string
    preferredRecordingMode: string
  }
}) => {
  const recordingModes = getFitnessRecordingModes(session.fitnessTestType)

  if (recordingModes.liveDropout) return `/fitness/sessions/${session.id}/live`
  if (recordingModes.liveTimedFinish) return `/fitness/sessions/${session.id}/timer`
  return `/fitness/sessions/${session.id}`
}

export default async function Home() {
  const user = await getOptionalCurrentUser()

  if (!user) return <LandingPage />
  if (await shouldRedirectToOnboarding(user)) redirect('/onboarding')

  return <AuthenticatedHome user={user} />
}

function LandingPage() {
  return (
    <main className="overflow-hidden bg-slate-950 text-white">
      <section className="relative isolate px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.32),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(132,204,22,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#064e3b_48%,#111827_100%)]" />
        <div className="absolute inset-x-4 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-100">
              Grassroots football, clearer coaching
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
              Coach the game. Capture the moments. See the progress.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50/85 sm:text-xl">
              Can You Coach helps grassroots clubs record the moments that matter, from match day events to fitness tests, so coaches can support player development without turning football into admin.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ActionLink href="/sign-up" variant="primary" size="lg" className="bg-white text-slate-950 hover:bg-emerald-50 focus-visible:ring-white">
                Sign up
              </ActionLink>
              <ActionLink href="/sign-in" variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 focus-visible:ring-white">
                Log in
              </ActionLink>
              <ActionLink href="#what-it-does" variant="ghost" size="lg" className="text-emerald-100 hover:bg-white/10 focus-visible:ring-white">
                See what it does
              </ActionLink>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-emerald-950/40 backdrop-blur sm:p-5">
            <div className="rounded-[1.5rem] bg-white p-5 text-slate-950 shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">Match day</p>
                  <h2 className="mt-1 text-2xl font-black">Useful evidence, fast</h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Live</span>
              </div>
              <div className="mt-5 grid gap-3">
                {['Shots and chances', 'Custom club events', 'Player minutes', 'Fitness results'].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <p className="font-bold text-slate-950">{item}</p>
                      <p className="mt-1 text-sm text-slate-500">Track it, review it, coach from it.</p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-700 text-sm font-black text-white">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-stone-50 px-4 py-12 text-slate-950 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <LandingSectionHeader
            eyebrow="Who it is for"
            title="Built for real coaches on real touchlines."
            description="Simple enough for match day, structured enough for clubs that want better player development conversations."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audienceCards.map((card) => (
              <LandingCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <section id="what-it-does" className="bg-white px-4 py-12 text-slate-950 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <LandingSectionHeader
            eyebrow="What it does"
            title="Everything starts with the moments you already notice."
            description="Track touches, shots, passes, custom club events, fitness scores and trends without pretending grassroots football is a control room."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <LandingCard key={card.title} {...card} featured />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-emerald-950 px-4 py-12 text-white sm:px-6 sm:py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-emerald-200">Why it matters</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Data should support coaching, not replace it.</h2>
          </div>
          <div className="space-y-4 text-base leading-7 text-emerald-50/85">
            <p>
              Grassroots coaches often rely on memory, gut feel and a busy Saturday morning. That experience matters, but it is easy to miss patterns when the game moves quickly.
            </p>
            <p>
              Can You Coach gives clubs simple evidence over time. It helps coaches talk about development, parents understand progress, and players see more than just the final score.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-stone-50 px-4 py-12 text-slate-950 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <LandingSectionHeader
            eyebrow="Simple workflow"
            title="Set up once. Track what matters. Review the story."
            description="A practical flow for coaches, assistants and clubs who need tools that fit around football."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {workflowSteps.map((step) => (
              <div key={step.step} className="rounded-[1.75rem] border border-emerald-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
                <p className="text-5xl font-black text-emerald-700">{step.step}</p>
                <h3 className="mt-5 text-xl font-extrabold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 text-slate-950 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl rounded-[2rem] bg-gradient-to-br from-emerald-700 to-slate-950 p-6 text-center text-white shadow-2xl shadow-emerald-950/20 sm:p-10">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-emerald-100">Ready when your team is</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Start building better coaching conversations.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-emerald-50/85">
            Create your account, set up your club, and start capturing the moments that help players improve.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink href="/sign-up" variant="primary" size="lg" className="bg-white text-slate-950 hover:bg-emerald-50 focus-visible:ring-white">
              Create your account
            </ActionLink>
            <ActionLink href="/sign-in" variant="secondary" size="lg" className="border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 focus-visible:ring-white">
              Log in
            </ActionLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950 px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-black">Can You Coach</p>
            <p className="mt-1 text-sm text-slate-400">Simple football data for better grassroots coaching.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-300">
            <Link href="/sign-up" className="hover:text-white">Sign up</Link>
            <Link href="/sign-in" className="hover:text-white">Log in</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

async function AuthenticatedHome({
  user,
}: {
  user: { id: string; onboardingRole: 'CLUB_OFFICIAL' | 'COACH' | 'PARENT_SPECTATOR' | null }
}) {
  const userId = user.id
  const teamWhere = await accessibleTeamWhere(userId)
  const sessionWhere = await accessibleSessionWhere(userId)
  const matchWhere = await accessibleMatchWhere(userId)

  const [
    teamCount,
    activePlayerCount,
    activeFitnessSessions,
    activeMatches,
    recentFitnessSessions,
    recentMatches,
    onboardingState,
    dashboardData,
  ] = await Promise.all([
    prisma.team.count({ where: teamWhere }),
    prisma.player.count({
      where: {
        isActive: true,
        team: teamWhere,
      },
    }),
    prisma.fitnessTestSession.findMany({
      where: {
        ...sessionWhere,
        status: 'IN_PROGRESS',
      },
      include: {
        team: { include: { club: true } },
        fitnessTestType: true,
        _count: { select: { results: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.matchDay.findMany({
      where: {
        ...matchWhere,
        status: { in: ['IN_PROGRESS', 'HALF_TIME'] },
      },
      include: {
        team: { include: { club: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.fitnessTestSession.findMany({
      where: sessionWhere,
      include: {
        team: { include: { club: true } },
        fitnessTestType: true,
        _count: { select: { results: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    prisma.matchDay.findMany({
      where: matchWhere,
      include: {
        team: { include: { club: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    getOnboardingState(userId),
    getDashboardData(userId),
  ])

  if (dashboardData.kind === 'no_access') {
    return <NoAccessDashboard onboardingRole={user.onboardingRole} />
  }

  const recentActivity = [
    ...recentFitnessSessions.map((session) => ({
      id: `fitness-${session.id}`,
      href: `/fitness/sessions/${session.id}`,
      label: `${session.fitnessTestType.name} fitness test`,
      detail: `${session.team.club.name} / ${session.team.name} · ${formatFitnessSessionStatus(session.status)} · ${session._count.results} results`,
      updatedAt: session.updatedAt,
      status: formatFitnessSessionStatus(session.status),
    })),
    ...recentMatches.map((match) => ({
      id: `match-${match.id}`,
      href: `/match-day/${match.id}`,
      label: `${match.team.name} vs ${match.opposition}`,
      detail: `${formatDate(match.kickoffAt)} · ${formatMatchType(match.matchType)} · ${match.ownScore}-${match.oppositionScore}`,
      updatedAt: match.updatedAt,
      status: formatMatchStatus(match.status),
    })),
  ]
    .sort((firstActivity, secondActivity) => secondActivity.updatedAt.getTime() - firstActivity.updatedAt.getTime())
    .slice(0, 6)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-stone-50 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Can You Coach</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
              What would you like to do today?
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Pick the coaching job in front of you. Start a test, get ready for match day, manage the squad, or review what happened last time.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white bg-white/75 p-3 text-center shadow-sm backdrop-blur">
            <DashboardStat label="Teams" value={teamCount} />
            <DashboardStat label="Players" value={activePlayerCount} />
            <DashboardStat label="Live" value={activeFitnessSessions.length + activeMatches.length} />
          </div>
        </div>
      </section>

      <Link
        href="/how-to-use"
        className="mt-4 block rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100/70 sm:p-5"
      >
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Quick guide</p>
        <h2 className="mt-1 text-xl font-extrabold text-slate-950">
          New to Can You Coach?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Read the quick guide to choosing what to track, using match data well, and focusing on player development rather than just the score.
        </p>
        <span className="mt-3 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
          Read the quick guide
        </span>
      </Link>

      <GettingStartedChecklist state={onboardingState} />

      {dashboardData.kind === 'coach' && (
        <>
          <DashboardSnapshot data={dashboardData} />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <NeedsAttentionPanel data={dashboardData} />
            <RecentReportsPanel data={dashboardData} />
          </div>
        </>
      )}

      {dashboardData.kind === 'parent' && (
        <ParentDashboardPanel data={dashboardData} />
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Start with a task</h2>
            <p className="mt-1 text-sm text-slate-600">Fast paths for training night, match day and admin catch-up.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {actionCards.map((action) => (
            <ActionCard key={action.href} {...action} />
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title="Active fitness tests"
          description="Continue live testing without digging through lists."
          action={<ActionLink href="/fitness" variant="ghost" size="sm">Open Fitness</ActionLink>}
        >
          {activeFitnessSessions.length === 0 ? (
            <EmptyState
              title="No fitness tests are live"
              description="Start or continue a test from Fitness when the squad is ready."
              action={<ActionLink href="/fitness" variant="primary" size="sm">Start Fitness Test</ActionLink>}
            />
          ) : (
            <div className="space-y-3">
              {activeFitnessSessions.map((session) => (
                <CompactWorkCard
                  key={session.id}
                  href={getFitnessSessionHref(session)}
                  title={session.fitnessTestType.name}
                  subtitle={`${session.team.club.name} / ${session.team.name}`}
                  meta={`${formatDate(session.date)} · ${session._count.results} results`}
                  status={formatFitnessSessionStatus(session.status)}
                />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Active matches"
          description="Jump back into live or half-time match control."
          action={<ActionLink href="/match-day" variant="ghost" size="sm">Open Match Day</ActionLink>}
        >
          {activeMatches.length === 0 ? (
            <EmptyState
              title="No matches are live"
              description="Create or open a match when you are ready to prepare the squad."
              action={<ActionLink href="/match-day" variant="primary" size="sm">Start Match Day</ActionLink>}
            />
          ) : (
            <div className="space-y-3">
              {activeMatches.map((match) => (
                <CompactWorkCard
                  key={match.id}
                  href={`/match-day/${match.id}`}
                  title={`${match.team.name} vs ${match.opposition}`}
                  subtitle={`${match.team.club.name} · ${formatDate(match.kickoffAt)}`}
                  meta={`Score ${match.ownScore}-${match.oppositionScore}`}
                  status={formatMatchStatus(match.status)}
                />
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.055)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Recent activity</h2>
            <p className="mt-1 text-sm text-slate-600">Latest tests and matches touched by your coaching workflow.</p>
          </div>
          <ActionLink href="/reports/team-trends" variant="ghost" size="sm">View Reports</ActionLink>
        </div>

        {recentActivity.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Nothing recorded yet"
            description="Create a fitness test or match day to start building your coaching history."
            action={<ActionLink href="/club-setup" variant="secondary" size="sm">Set up your club</ActionLink>}
          />
        ) : (
          <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {recentActivity.map((activity) => (
              <Link
                key={activity.id}
                href={activity.href}
                className="flex flex-col gap-2 p-4 transition hover:bg-emerald-50/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold text-slate-950">{activity.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{activity.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge label={activity.status} variant={getStatusBadgeVariant(activity.status)} />
                  <span className="text-xs font-medium text-slate-500">{formatDateTime(activity.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function NoAccessDashboard({
  onboardingRole,
}: {
  onboardingRole: 'CLUB_OFFICIAL' | 'COACH' | 'PARENT_SPECTATOR' | null
}) {
  const content = getNoAccessDashboardContent(onboardingRole)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:p-6">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-700 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
        <div className="p-5 sm:p-8">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-50">
            Next step
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            {content.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/85 sm:text-lg">
            {content.copy}
          </p>
          {content.actions.length > 0 && (
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {content.actions.map((action, index) => (
                <ActionLink
                  key={action.href}
                  href={action.href}
                  variant={index === 0 ? 'primary' : 'secondary'}
                  size="lg"
                  className={index === 0
                    ? 'bg-white text-slate-950 hover:bg-emerald-50 focus-visible:ring-white'
                    : 'border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 focus-visible:ring-white'}
                >
                  {action.label}
                </ActionLink>
              ))}
            </div>
          )}
        </div>
      </section>

      {content.showInviteGuidance && <InviteGuidanceCard />}

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        {content.steps.map((step) => (
          <article key={step.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">{step.eyebrow}</p>
            <h2 className="mt-2 text-lg font-black text-slate-950">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
          </article>
        ))}
      </section>
    </main>
  )
}

function InviteGuidanceCard() {
  return (
    <section className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-blue-950 shadow-sm sm:p-6">
      <p className="text-sm font-extrabold uppercase tracking-wide text-blue-800">I have an invite link</p>
      <p className="mt-2 text-sm leading-6">
        Open the invite link you were sent. Make sure you sign in with the invited email address. Invite links look like <span className="font-mono font-bold">/invite/accept?token=...</span>
      </p>
    </section>
  )
}

function getNoAccessDashboardContent(
  onboardingRole: 'CLUB_OFFICIAL' | 'COACH' | 'PARENT_SPECTATOR' | null
) {
  if (onboardingRole === 'COACH') {
    return {
      heading: 'You’re nearly ready to coach',
      copy: 'Ask your club official or head coach to invite you to a team from Club Setup → Access. Once accepted, your team will appear here.',
      actions: [],
      showInviteGuidance: true,
      steps: [
        { eyebrow: 'Step 1', title: 'Ask for an invite', description: 'A club official or head coach creates your team invite from Access Management.' },
        { eyebrow: 'Step 2', title: 'Open the link', description: 'Use the invite link while signed in with the email address that was invited.' },
        { eyebrow: 'Step 3', title: 'Start coaching', description: 'After acceptance, your assigned team appears on the dashboard.' },
      ],
    }
  }

  if (onboardingRole === 'PARENT_SPECTATOR') {
    return {
      heading: 'Waiting for your player link',
      copy: 'Ask your coach or club official to invite you to a player. Once accepted, you’ll be able to view and record information for that player.',
      actions: [{ href: '/my-player', label: 'Go to My Player' }],
      showInviteGuidance: true,
      steps: [
        { eyebrow: 'Step 1', title: 'Ask for a player invite', description: 'A coach or club official links your email to one player.' },
        { eyebrow: 'Step 2', title: 'Accept the invite', description: 'Open the invite link and sign in with the invited email address.' },
        { eyebrow: 'Step 3', title: 'Follow progress', description: 'Your linked player will appear in My Player after acceptance.' },
      ],
    }
  }

  if (onboardingRole === 'CLUB_OFFICIAL') {
    return {
      heading: 'Set up your club',
      copy: 'Create your club, add teams and players, then invite coaches and parents.',
      actions: [{ href: '/club-setup', label: 'Open Club Setup' }],
      showInviteGuidance: false,
      steps: [
        { eyebrow: 'Step 1', title: 'Create your club', description: 'Add the club record that will own your teams and setup.' },
        { eyebrow: 'Step 2', title: 'Add teams and players', description: 'Build the squad structure before match day or fitness testing.' },
        { eyebrow: 'Step 3', title: 'Invite people', description: 'Invite coaches, assistants, parents and spectators from Club Setup → Access.' },
      ],
    }
  }

  return {
    heading: 'Choose how to get started',
    copy: 'You can set up a club yourself, or accept an invite from a club, team or player when someone sends you one.',
    actions: [
      { href: '/onboarding', label: 'Open Onboarding' },
      { href: '/club-setup', label: 'Open Club Setup' },
    ],
    showInviteGuidance: true,
    steps: [
      { eyebrow: 'Option 1', title: 'Set up a club', description: 'Create your own club if you are the official or head coach managing setup.' },
      { eyebrow: 'Option 2', title: 'Accept an invite', description: 'Use an invite link from a club official, coach or head coach.' },
      { eyebrow: 'Option 3', title: 'Come back later', description: 'Your dashboard will update automatically once access is added.' },
    ],
  }
}

function LandingSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
    </div>
  )
}

function LandingCard({
  title,
  description,
  featured = false,
}: {
  title: string
  description: string
  featured?: boolean
}) {
  return (
    <article className={`rounded-[1.75rem] border p-5 shadow-sm ${featured ? 'border-emerald-100 bg-emerald-50/45' : 'border-slate-200 bg-white'}`}>
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-700 text-sm font-black text-white">
        {title.slice(0, 1)}
      </div>
      <h3 className="mt-5 text-xl font-extrabold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </article>
  )
}

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3 shadow-sm">
      <p className="text-2xl font-extrabold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function ActionCard({
  href,
  eyebrow,
  title,
  description,
  tone,
}: {
  href: string
  eyebrow: string
  title: string
  description: string
  tone: string
}) {
  const toneClasses: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    teal: 'border-teal-200 bg-teal-50 text-teal-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  }

  return (
    <Link
      href={href}
      className={`rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${toneClasses[tone]}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-75">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-extrabold">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
    </Link>
  )
}

function DashboardPanel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.055)] sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function CompactWorkCard({
  href,
  title,
  subtitle,
  meta,
  status,
}: {
  href: string
  title: string
  subtitle: string
  meta: string
  status: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-stone-50/80 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <StatusBadge label={status} variant={getStatusBadgeVariant(status)} />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{meta}</p>
    </Link>
  )
}
