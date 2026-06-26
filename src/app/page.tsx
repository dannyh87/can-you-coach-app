import Link from 'next/link'

import ActionLink from '@/components/ui/ActionLink'
import DashboardSnapshot from '@/components/DashboardSnapshot'
import EmptyState from '@/components/ui/EmptyState'
import GettingStartedChecklist from '@/components/GettingStartedChecklist'
import NeedsAttentionPanel from '@/components/NeedsAttentionPanel'
import ParentDashboardPanel from '@/components/ParentDashboardPanel'
import RecentReportsPanel from '@/components/RecentReportsPanel'
import StatusBadge, { getStatusBadgeVariant } from '@/components/ui/StatusBadge'
import { accessibleMatchWhere, accessibleSessionWhere, accessibleTeamWhere } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard'
import { getFitnessRecordingModes } from '@/lib/fitnessRecordingModes'
import { formatFitnessSessionStatus } from '@/lib/fitnessSessionStatus'
import { getOnboardingState } from '@/lib/onboarding'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const actionCards = [
  {
    href: '/fitness',
    eyebrow: 'Fitness',
    title: 'Start Fitness Test',
    description: 'Create a test, continue a live session, or review recent results.',
    tone: 'blue',
  },
  {
    href: '/match-day',
    eyebrow: 'Touchline',
    title: 'Start Match Day',
    description: 'Prepare the squad, start the clock, update score and record events.',
    tone: 'green',
  },
  {
    href: '/players',
    eyebrow: 'Squad',
    title: 'Manage Squad',
    description: 'Add players, update positions and keep squad numbers tidy.',
    tone: 'slate',
  },
  {
    href: '/fitness/progress',
    eyebrow: 'Review',
    title: 'View Reports',
    description: 'Check fitness progress and use completed match reports.',
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
  const user = await getCurrentUser()
  const teamWhere = await accessibleTeamWhere(user.id)
  const sessionWhere = await accessibleSessionWhere(user.id)
  const matchWhere = await accessibleMatchWhere(user.id)

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
    getOnboardingState(user.id),
    getDashboardData(user.id),
  ])

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
      <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 p-5 text-white shadow-sm sm:p-7">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-200">Can You Coach</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              What would you like to do today?
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-blue-100">
              Pick the coaching job in front of you. Start a test, get ready for match day, manage the squad, or review what happened last time.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-3 text-center backdrop-blur">
            <DashboardStat label="Teams" value={teamCount} />
            <DashboardStat label="Players" value={activePlayerCount} />
            <DashboardStat label="Live" value={activeFitnessSessions.length + activeMatches.length} />
          </div>
        </div>
      </section>

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

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Recent activity</h2>
            <p className="mt-1 text-sm text-slate-600">Latest tests and matches touched by your coaching workflow.</p>
          </div>
          <ActionLink href="/fitness/progress" variant="ghost" size="sm">View Reports</ActionLink>
        </div>

        {recentActivity.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="Nothing recorded yet"
            description="Create a fitness test or match day to start building your coaching history."
            action={<ActionLink href="/club-setup" variant="secondary" size="sm">Set up your club</ActionLink>}
          />
        ) : (
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {recentActivity.map((activity) => (
              <Link
                key={activity.id}
                href={activity.href}
                className="flex flex-col gap-2 p-4 transition hover:bg-blue-50/60 sm:flex-row sm:items-center sm:justify-between"
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

function DashboardStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-3">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-100">{label}</p>
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
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-900',
  }

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${toneClasses[tone]}`}
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
      className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/70"
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
