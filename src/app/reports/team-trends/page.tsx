import type { MatchEventType, MatchType } from '@prisma/client'
import Link from 'next/link'

import TeamEventTrendChart from '@/components/TeamEventTrendChart'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleMatchWhere, accessibleTeamWhere } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { formatMatchEventType } from '@/lib/matchEventTaxonomy'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type SearchParams = {
  teamId?: string
  eventKey?: string
  from?: string
  to?: string
  matchType?: string
}

type EventOption = {
  key: string
  label: string
}

const matchTypes = ['LEAGUE', 'CUP', 'FRIENDLY'] as const satisfies MatchType[]

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)
const formatMatchType = (matchType: string) =>
  matchType.charAt(0) + matchType.slice(1).toLowerCase()

const parseDateInput = (value: string | undefined) => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const getEndOfDay = (date: Date) => {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end
}

const getChartLabel = (date: Date, opposition: string) =>
  `${formatDate(date)} ${opposition}`

const addEventOption = (options: Map<string, EventOption>, option: EventOption) => {
  if (!options.has(option.key)) options.set(option.key, option)
}

export default async function TeamEventTrendsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  const teamWhere = await accessibleTeamWhere(user.id)
  const matchWhere = await accessibleMatchWhere(user.id)
  const fromDate = parseDateInput(params.from)
  const toDate = parseDateInput(params.to)
  const selectedMatchType = matchTypes.includes(params.matchType as MatchType)
    ? params.matchType as MatchType
    : ''

  const teams = await prisma.team.findMany({
    where: teamWhere,
    include: { club: true },
    orderBy: [{ club: { name: 'asc' } }, { name: 'asc' }],
  })

  const requestedTeam = params.teamId
    ? teams.find((team) => team.id === params.teamId) ?? null
    : null
  const selectedTeam = requestedTeam ?? teams[0] ?? null

  const matchDateWhere = fromDate || toDate
    ? {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: getEndOfDay(toDate) } : {}),
      }
    : undefined

  const matchesDescending = selectedTeam
    ? await prisma.matchDay.findMany({
        where: {
          AND: [matchWhere],
          teamId: selectedTeam.id,
          status: 'COMPLETED',
          ...(matchDateWhere ? { kickoffAt: matchDateWhere } : {}),
          ...(selectedMatchType ? { matchType: selectedMatchType } : {}),
        },
        include: {
          matchEvents: {
            include: {
              eventDefinition: { select: { name: true } },
            },
          },
          matchDayEventTypes: {
            include: {
              eventDefinition: { select: { name: true } },
            },
          },
        },
        orderBy: { kickoffAt: 'desc' },
        ...(matchDateWhere ? {} : { take: 10 }),
      })
    : []

  const matches = [...matchesDescending].sort(
    (firstMatch, secondMatch) => firstMatch.kickoffAt.getTime() - secondMatch.kickoffAt.getTime()
  )

  const eventOptionsByKey = new Map<string, EventOption>()

  for (const match of matches) {
    for (const eventType of match.matchDayEventTypes) {
      if (eventType.eventDefinitionId) {
        addEventOption(eventOptionsByKey, {
          key: `definition:${eventType.eventDefinitionId}`,
          label: eventType.eventDefinition?.name ?? (eventType.eventType ? formatMatchEventType(eventType.eventType) : 'Unknown event'),
        })
        continue
      }

      if (eventType.eventType) {
        addEventOption(eventOptionsByKey, {
          key: `legacy:${eventType.eventType}`,
          label: formatMatchEventType(eventType.eventType),
        })
      }
    }

    for (const event of match.matchEvents) {
      if (event.eventDefinitionId) {
        addEventOption(eventOptionsByKey, {
          key: `definition:${event.eventDefinitionId}`,
          label: event.eventDefinition?.name ?? (event.eventType ? formatMatchEventType(event.eventType) : 'Unknown event'),
        })
        continue
      }

      if (event.eventType) {
        addEventOption(eventOptionsByKey, {
          key: `legacy:${event.eventType}`,
          label: formatMatchEventType(event.eventType),
        })
      }
    }
  }

  const eventOptions = Array.from(eventOptionsByKey.values()).sort((firstOption, secondOption) =>
    firstOption.label.localeCompare(secondOption.label)
  )
  const selectedEvent = params.eventKey
    ? eventOptions.find((option) => option.key === params.eventKey) ?? eventOptions[0] ?? null
    : eventOptions[0] ?? null

  const rows = selectedEvent
    ? matches.map((match) => {
        const [eventSource, eventValue] = selectedEvent.key.split(':') as ['definition' | 'legacy', string]
        const count = match.matchEvents.filter((event) => {
          if (eventSource === 'definition') return event.eventDefinitionId === eventValue
          return event.eventType === eventValue as MatchEventType
        }).length

        return {
          id: match.id,
          date: match.kickoffAt,
          dateLabel: formatDate(match.kickoffAt),
          opposition: match.opposition,
          matchType: match.matchType,
          matchTypeLabel: formatMatchType(match.matchType),
          chartLabel: getChartLabel(match.kickoffAt, match.opposition),
          score: `${match.ownScore}-${match.oppositionScore}`,
          count,
        }
      })
    : []

  const totalCount = rows.reduce((total, row) => total + row.count, 0)
  const averageCount = rows.length > 0 ? totalCount / rows.length : 0
  const highestRow = rows.reduce<typeof rows[number] | null>(
    (highest, row) => (!highest || row.count > highest.count ? row : highest),
    null
  )
  const latestRow = rows.at(-1) ?? null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        eyebrow="Reports"
        title="Team Event Trends"
        description="See how one match event changes across completed matches over time."
        actions={(
          <Link href="/reports" className="text-sm font-bold text-emerald-700 hover:underline">
            All reports
          </Link>
        )}
      />

      {teams.length === 0 ? (
        <EmptyState title="You do not have access to any teams yet." />
      ) : (
        <>
          <form className="mb-6 rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.055)] sm:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Team
                <select
                  name="teamId"
                  defaultValue={selectedTeam?.id ?? ''}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.club.name} / {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Date from
                <input
                  type="date"
                  name="from"
                  defaultValue={fromDate ? formatDateInput(fromDate) : ''}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Date to
                <input
                  type="date"
                  name="to"
                  defaultValue={toDate ? formatDateInput(toDate) : ''}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Event
                <select
                  name="eventKey"
                  defaultValue={selectedEvent?.key ?? ''}
                  disabled={eventOptions.length === 0}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {eventOptions.length === 0 ? (
                    <option value="">No events</option>
                  ) : eventOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Match type
                <select
                  name="matchType"
                  defaultValue={selectedMatchType}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="">All types</option>
                  {matchTypes.map((matchType) => (
                    <option key={matchType} value={matchType}>
                      {formatMatchType(matchType)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                Update report
              </button>
              <Link href="/reports/team-trends" className="text-sm font-bold text-slate-600 hover:text-emerald-800 hover:underline">
                Reset filters
              </Link>
            </div>
          </form>

          {matches.length === 0 ? (
            <EmptyState title="Complete a match first to see trends." />
          ) : eventOptions.length === 0 ? (
            <EmptyState title="No events found for this selection." />
          ) : (
            <>
              <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Total count" value={String(totalCount)} />
                <SummaryCard label="Average per match" value={averageCount.toFixed(1)} />
                <SummaryCard
                  label="Highest match"
                  value={highestRow ? String(highestRow.count) : '0'}
                  detail={highestRow ? `${highestRow.dateLabel} vs ${highestRow.opposition}` : undefined}
                />
                <SummaryCard
                  label="Latest match count"
                  value={latestRow ? String(latestRow.count) : '0'}
                  detail={latestRow ? `${latestRow.dateLabel} vs ${latestRow.opposition}` : undefined}
                />
              </section>

              {totalCount === 0 && (
                <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  This event was available in the selected matches but has not been recorded in this period.
                </p>
              )}

              <TeamEventTrendChart data={rows.map((row) => ({ label: row.chartLabel, count: row.count }))} />

              <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                  <h2 className="text-lg font-extrabold text-slate-950">
                    {selectedEvent?.label ?? 'Selected event'} by match
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">Date</th>
                        <th scope="col" className="px-4 py-3">Opposition</th>
                        <th scope="col" className="px-4 py-3">Score</th>
                        <th scope="col" className="px-4 py-3 text-right">Selected event count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.id} className="hover:bg-emerald-50/40">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{row.dateLabel}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-semibold text-slate-900">{row.opposition}</div>
                            <div className="text-xs font-medium text-slate-500">{row.matchTypeLabel}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{row.score}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-slate-950">{value}</p>
      {detail && <p className="mt-2 text-sm font-medium text-slate-600">{detail}</p>}
    </div>
  )
}
