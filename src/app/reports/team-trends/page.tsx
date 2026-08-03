import type { MatchType } from '@prisma/client'
import Link from 'next/link'

import TeamEventTrendChart from '@/components/TeamEventTrendChart'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { accessibleMatchWhere, accessibleTeamWhere } from '@/lib/accessWhere'
import { getCurrentUser } from '@/lib/auth'
import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { prisma } from '@/lib/prisma'
import {
  buildTeamTrendOptions,
  buildTeamTrendSeries,
  decodeTeamTrendDimension,
  decodeTeamTrendIdentity,
  encodeTeamTrendIdentity,
  getLegacyTeamTrendIdentity,
  type TeamTrendDimension,
  type TeamTrendOption,
  type TeamTrendSeries,
} from '@/lib/teamTrackingTrends'

export const dynamic = 'force-dynamic'

type SearchParams = {
  teamId?: string
  eventKey?: string
  trendKey?: string
  dimension?: string
  from?: string
  to?: string
  matchType?: string
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

const formatPercent = (value: number | null | undefined) => value === null || value === undefined ? 'n/a' : `${Math.round(value * 100)}%`

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
  const clubTrendsEnabled = isMatchDayTrackingV2Enabled()
  const selectedDimension = decodeTeamTrendDimension(params.dimension, clubTrendsEnabled)
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
              player: { select: { id: true, firstName: true, surname: true } },
              eventDefinition: { select: { id: true, name: true, benchmarkable: true } },
              standardEventDefinitionAtRecording: { select: { id: true, name: true, benchmarkable: true } },
              clubTrackingDefinition: { select: { id: true, name: true, kind: true, status: true, active: true, retiredAt: true } },
            },
          },
          patternObservations: {
            include: {
              pattern: { select: { id: true, name: true, outcomes: { select: { positive: true } } } },
              standardPatternDefinitionAtRecording: { select: { id: true, name: true } },
              clubTrackingDefinition: { select: { id: true, name: true, kind: true, status: true, active: true, retiredAt: true } },
              outcome: { select: { id: true, label: true, positive: true } },
              player: { select: { firstName: true, surname: true } },
              trackingTask: { select: { scopeType: true, unitLabel: true } },
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

  const allTrendOptions = buildTeamTrendOptions(matches, clubTrendsEnabled)
  const trendOptions = allTrendOptions.filter((option) => option.dimension === selectedDimension)
  const requestedIdentity = decodeTeamTrendIdentity(params.trendKey) ?? getLegacyTeamTrendIdentity(params.eventKey, allTrendOptions)
  const selectedIdentity = requestedIdentity && requestedIdentity.dimension === selectedDimension
    ? requestedIdentity
    : trendOptions[0]?.identity ?? null
  const selectedTrend = selectedIdentity ? buildTeamTrendSeries(matches, selectedIdentity) : null
  const selectedOption = selectedIdentity ? trendOptions.find((option) => encodeTeamTrendIdentity(option.identity) === encodeTeamTrendIdentity(selectedIdentity)) ?? null : null
  const rows = selectedTrend?.points ?? []
  const totalCount = selectedTrend?.total ?? 0
  const averageCount = rows.length > 0 ? totalCount / rows.length : 0
  const highestRow = rows.reduce<typeof rows[number] | null>(
    (highest, row) => (!highest || row.total > highest.total ? row : highest),
    null
  )
  const latestRow = rows.at(-1) ?? null
  const chartItemLabel = selectedTrend?.itemType === 'PATTERN' ? 'Pattern observation' : 'Observation'

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:p-6">
      <PageHeader
        eyebrow="Reports"
        title="Team Tracking Trends"
        description="See how standard and club tracking observations change across completed matches over time."
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
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

              <input type="hidden" name="dimension" value={selectedDimension.toLowerCase()} />

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
                Tracking item
                <select
                  name="trendKey"
                  defaultValue={selectedIdentity ? encodeTeamTrendIdentity(selectedIdentity) : ''}
                  disabled={trendOptions.length === 0}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {trendOptions.length === 0 ? <option value="">No tracking items</option> : renderTrendOptionGroups(trendOptions)}
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

            <div className="mt-4 flex flex-wrap gap-2">
              <DimensionLink label="Standard tracking" dimension="STANDARD" selectedDimension={selectedDimension} disabled={false} params={params} />
              {clubTrendsEnabled && <DimensionLink label="Club tracking" dimension="CLUB" selectedDimension={selectedDimension} disabled={false} params={params} />}
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
          ) : trendOptions.length === 0 ? (
            <EmptyState title="No tracking observations found for this selection." description={selectedDimension === 'CLUB' ? 'Club tracking trends appear when official observations have club tracking provenance.' : 'Standard trends include native standard observations, aliases and approved mappings recorded as standard-reportable.'} />
          ) : (
            <>
              <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Total observations" value={String(totalCount)} detail={selectedTrend?.secondaryLabel ?? undefined} />
                <SummaryCard label="Average per match" value={averageCount.toFixed(1)} />
                <SummaryCard
                  label="Highest match"
                  value={highestRow ? String(highestRow.total) : '0'}
                  detail={highestRow ? `${formatDate(highestRow.matchDate)} vs ${highestRow.opponent}` : undefined}
                />
                <SummaryCard
                  label={selectedTrend?.itemType === 'PATTERN' ? 'Positive rate' : 'Benchmark'}
                  value={selectedTrend?.itemType === 'PATTERN' ? formatPercent(selectedTrend.positiveRate) : selectedTrend?.benchmarkEligible ? 'Eligible' : 'Not eligible'}
                  detail={latestRow ? `Latest: ${latestRow.total} vs ${latestRow.opponent}` : undefined}
                />
              </section>

              {totalCount === 0 && (
                <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  This tracking item was available in the selected matches but has not been recorded in this period.
                </p>
              )}

              <TeamEventTrendChart data={rows.map((row) => ({ label: getChartLabel(row.matchDate, row.opponent ?? ''), count: row.total, positiveRate: row.positiveRate }))} itemLabel={chartItemLabel} />

              {selectedTrend && (
                <TrendContextPanel trend={selectedTrend} selectedOption={selectedOption} />
              )}

              <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                  <h2 className="text-lg font-extrabold text-slate-950">
                    {selectedTrend?.displayName ?? 'Selected tracking item'} by match
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-3">Date</th>
                        <th scope="col" className="px-4 py-3">Opposition</th>
                        <th scope="col" className="px-4 py-3">Score</th>
                        {selectedTrend?.itemType === 'PATTERN' && <th scope="col" className="px-4 py-3 text-right">Positive rate</th>}
                        <th scope="col" className="px-4 py-3 text-right">Observation count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.matchDayId} className="hover:bg-emerald-50/40">
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{formatDate(row.matchDate)}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-semibold text-slate-900">{row.opponent}</div>
                            <div className="text-xs font-medium text-slate-500">{formatMatchType(row.matchType)}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{row.score}</td>
                          {selectedTrend?.itemType === 'PATTERN' && <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-purple-800">{formatPercent(row.positiveRate)}</td>}
                          <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold tabular-nums text-slate-950">{row.total}</td>
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

function renderTrendOptionGroups(options: TeamTrendOption[]) {
  const eventOptions = options.filter((option) => option.itemType === 'EVENT')
  const patternOptions = options.filter((option) => option.itemType === 'PATTERN')
  return (
    <>
      {eventOptions.length > 0 && (
        <optgroup label="Events">
          {eventOptions.map((option) => <TrendOption key={option.key} option={option} />)}
        </optgroup>
      )}
      {patternOptions.length > 0 && (
        <optgroup label="Tactical patterns">
          {patternOptions.map((option) => <TrendOption key={option.key} option={option} />)}
        </optgroup>
      )}
    </>
  )
}

function TrendOption({ option }: { option: TeamTrendOption }) {
  return (
    <option value={option.key}>
      {option.displayName}{option.retired ? ' (retired)' : ''} - {option.total} observation{option.total === 1 ? '' : 's'}
    </option>
  )
}

function DimensionLink({
  label,
  dimension,
  selectedDimension,
  params,
}: {
  label: string
  dimension: TeamTrendDimension
  selectedDimension: TeamTrendDimension
  disabled: boolean
  params: SearchParams
}) {
  const query = new URLSearchParams()
  if (params.teamId) query.set('teamId', params.teamId)
  if (params.from) query.set('from', params.from)
  if (params.to) query.set('to', params.to)
  if (params.matchType) query.set('matchType', params.matchType)
  query.set('dimension', dimension.toLowerCase())
  const selected = dimension === selectedDimension
  return (
    <Link
      href={`/reports/team-trends?${query.toString()}`}
      className={`rounded-full border px-4 py-2 text-sm font-bold ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'}`}
    >
      {label}
    </Link>
  )
}

function TrendContextPanel({ trend, selectedOption }: { trend: TeamTrendSeries; selectedOption: TeamTrendOption | null }) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{trend.dimension === 'STANDARD' ? 'Standard tracking' : 'Club tracking'} / {trend.itemType === 'EVENT' ? 'Event' : 'Tactical pattern'}</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-950">{trend.displayName}</h2>
          {trend.secondaryLabel && <p className="mt-1 text-sm font-semibold text-slate-600">{trend.secondaryLabel}</p>}
        </div>
        {selectedOption?.retired && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Retired definition</span>}
      </div>
      {trend.historicalMappingWarning && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{trend.historicalMappingWarning}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {trend.scopeBreakdown && <InfoBlock label="Scope breakdown" value={`Player ${trend.scopeBreakdown.player} / Unit ${trend.scopeBreakdown.unit} / Team ${trend.scopeBreakdown.team}`} />}
        {trend.outcomeBreakdown && <InfoBlock label="Outcomes" value={trend.outcomeBreakdown.map((row) => `${row.outcomeName}: ${row.count}`).join(' · ') || 'None'} />}
        {trend.mappingBreakdown && <InfoBlock label="Mapping snapshots" value={trend.mappingBreakdown.map((row) => `${row.mappingStatusAtRecording ?? 'None'} rev ${row.mappingRevisionAtRecording ?? 'n/a'}: ${row.count}`).join(' · ')} />}
      </div>
    </section>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{value}</p>
    </div>
  )
}
