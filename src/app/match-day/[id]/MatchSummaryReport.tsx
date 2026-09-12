import type { ReactNode } from 'react'

import MatchSummaryCsvButtons from '@/app/match-day/[id]/MatchSummaryCsvButtons'
import BrandLogo from '@/components/BrandLogo'
import type {
  MatchCsvMetadata,
  MatchEventCsvRow,
  MatchPatternObservationCsvRow,
  MatchSummaryCsvRow,
} from '@/lib/reportCsv'
import type { FootballMetricReport } from '@/lib/footballObservationMetrics'
import type { TacticalObservationReport } from '@/lib/teamTacticalObservations'
import { getObservationIdentityLabel, type ClubEventAggregate, type ClubPatternAggregate, type MappingCoverageRow } from '@/lib/observationReporting'

type MatchHalf = 'FIRST_HALF' | 'SECOND_HALF'

type SummaryMinuteRow = {
  playerId: string
  playerName: string
  squadNumber: number | null
  minutesPlayed: number
}

type EventTotalRow = {
  key: string
  label: string
  count: number
}

type PlayerEventCountRow = {
  playerId: string
  playerName: string
  total: number
  eventCounts: EventTotalRow[]
}

type TimelineEvent = {
  id: string
  label: string
  secondaryLabel: string | null
  half: MatchHalf
  matchSecond: number
  playerName: string
  score: string
}

type MatchSummaryReportProps = {
  headline: string
  finalScore: string
  statusLabel: string
  matchDate: string
  minutesRows: SummaryMinuteRow[]
  teamEventTotals: EventTotalRow[]
  playerEventCounts: PlayerEventCountRow[]
  footballMetricReport: FootballMetricReport
  tacticalObservationReport: TacticalObservationReport
  mostInvolvedPlayers: PlayerEventCountRow[]
  timelineEvents: TimelineEvent[]
  csvMetadata: MatchCsvMetadata
  summaryCsvRows: MatchSummaryCsvRow[]
  eventCsvRows: MatchEventCsvRow[]
  patternCsvRows: MatchPatternObservationCsvRow[]
  standardPatternRows: MatchPatternObservationCsvRow[]
  showClubTracking: boolean
  clubEventAggregates: ClubEventAggregate[]
  clubPatternAggregates: ClubPatternAggregate[]
  mappingCoverageRows: MappingCoverageRow[]
}

const formatSquadNumber = (squadNumber: number | null) =>
  squadNumber === null ? 'No squad number' : `#${squadNumber}`

const formatHalf = (half: MatchHalf) => (half === 'FIRST_HALF' ? '1H' : '2H')

const formatMatchTime = (matchSecond: number) => {
  const minutes = Math.floor(matchSecond / 60)
  const seconds = matchSecond % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function MatchSummaryReport({
  headline,
  finalScore,
  statusLabel,
  matchDate,
  minutesRows,
  teamEventTotals,
  playerEventCounts,
  footballMetricReport,
  tacticalObservationReport,
  mostInvolvedPlayers,
  timelineEvents,
  csvMetadata,
  summaryCsvRows,
  eventCsvRows,
  patternCsvRows,
  standardPatternRows,
  showClubTracking,
  clubEventAggregates,
  clubPatternAggregates,
  mappingCoverageRows,
}: MatchSummaryReportProps) {
  const totalTeamEvents = teamEventTotals.reduce((total, row) => total + row.count, 0)
  const playersUsed = minutesRows.filter((row) => row.minutesPlayed > 0).length
  const mostInvolvedPlayer = mostInvolvedPlayers[0]
  const totalClubEvents = clubEventAggregates.reduce((total, row) => total + row.count, 0)
  const totalClubPatterns = clubPatternAggregates.reduce((total, row) => total + row.count, 0)
  const totalClubObservations = totalClubEvents + totalClubPatterns
  const standardReportableClubObservations = clubEventAggregates.reduce((total, row) => total + row.standardReportableCount, 0) + clubPatternAggregates.reduce((total, row) => total + row.standardReportableCount, 0)
  const clubOnlyMappedObservations = [...clubEventAggregates, ...clubPatternAggregates].reduce((total, row) => row.identityTypes.includes('CLUB_MAPPED_CLUB_ONLY') ? total + row.clubOnlyCount : total, 0)
  const clubSpecificObservations = clubEventAggregates.reduce((total, row) => row.identityTypes.includes('CLUB_SPECIFIC') ? total + row.count : total, 0)

  return (
    <section className="rounded-2xl bg-stone-50 p-5 sm:p-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <BrandLogo size="sm" />
        <p className="mt-4 text-sm font-bold uppercase tracking-wide text-[var(--brand-teal-dark)]">Match report</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--brand-navy)]">{headline}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {matchDate} · {statusLabel}
            </p>
          </div>
          <div className="space-y-3 text-left sm:text-right">
            <div>
              <p className="text-sm font-medium text-gray-500">Final score</p>
              <p className="text-5xl font-bold tabular-nums text-[var(--brand-navy)]">{finalScore}</p>
            </div>
            <MatchSummaryCsvButtons
              metadata={csvMetadata}
              summaryRows={summaryCsvRows}
              eventRows={eventCsvRows}
              patternRows={patternCsvRows}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <ReportCard label="Match result" value={finalScore} />
        <ReportCard label="Standard-reportable team events" value={String(totalTeamEvents)} />
        <ReportCard label="Players used" value={String(playersUsed)} />
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <h3 className="text-lg font-bold text-blue-950">Coach summary</h3>
        <p className="mt-1 text-sm font-medium leading-6 text-blue-900">
          {playersUsed > 0
            ? `${playersUsed} player${playersUsed === 1 ? '' : 's'} recorded minutes.`
            : 'No player minutes were recorded.'}{' '}
          {totalTeamEvents > 0
            ? `${totalTeamEvents} standard-reportable tracked event${totalTeamEvents === 1 ? '' : 's'} were recorded.`
            : 'No standard-reportable tracked events were recorded.'}{' '}
          {mostInvolvedPlayer
            ? `${mostInvolvedPlayer.playerName} was the most involved tracked player with ${mostInvolvedPlayer.total} event${mostInvolvedPlayer.total === 1 ? '' : 's'}.`
            : 'Record events during live play to build involvement summaries.'}
        </p>
        <p className="mt-2 text-xs font-semibold text-blue-800">
          Standard totals include native standard observations, club aliases and club mappings that were approved for standard reporting when recorded.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ReportPanel title="Minutes played">
          {minutesRows.length === 0 ? (
            <EmptyText>No minutes were recorded. Use Sub on/off during a live match to build this view.</EmptyText>
          ) : (
            <div className="space-y-2">
              {minutesRows.map((row) => (
                <div key={row.playerId} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 text-sm">
                  <div>
                    <p className="font-bold">{row.playerName}</p>
                    <p className="text-gray-500">{formatSquadNumber(row.squadNumber)}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">{row.minutesPlayed} min</p>
                </div>
              ))}
            </div>
          )}
        </ReportPanel>

        <ReportPanel title="Standard-reportable event totals">
          {teamEventTotals.length === 0 ? (
            <EmptyText>No events were recorded. Select tracked event types before or during match setup to fill this panel.</EmptyText>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {teamEventTotals.map((row) => (
                <div key={row.key} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-500">{row.label}</p>
                  <p className="mt-1 text-2xl font-bold">{row.count}</p>
                </div>
              ))}
            </div>
          )}
        </ReportPanel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ReportPanel title="Professional-stat leaderboards">
          <p className="mb-3 rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
            Leaderboards show selected evidence for coaching review. A high count is not automatically a better performance.
          </p>
          <div className="space-y-3">
            {footballMetricReport.leaderboards.map((leaderboard) => (
              <div key={leaderboard.key} className="rounded-lg bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{leaderboard.label}</p>
                  <p className="text-xs font-bold text-slate-500">{leaderboard.coverageLabel}</p>
                </div>
                {leaderboard.rows.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No player events recorded for this metric.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {leaderboard.rows.map((row, index) => (
                      <div key={row.playerId} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                        <p className="font-semibold">{index + 1}. {row.playerName}</p>
                        <p className="font-black tabular-nums">{row.value}{row.per90 !== null ? <span className="ml-2 text-xs font-bold text-slate-500">{row.per90.toFixed(1)} per 90</span> : null}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Professional-stat coverage">
          <div className="space-y-2">
            {footballMetricReport.metrics.filter((metric) => metric.tracked || metric.total > 0).map((metric) => (
              <div key={metric.key} className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{metric.label}</p>
                  <p className="text-xs font-bold text-slate-500">{metric.coverageLabel}</p>
                </div>
                <p className="mt-1 text-slate-600">
                  {metric.attempts === null
                    ? `Total: ${metric.total}`
                    : `Attempts: ${metric.attempts} · Successes: ${metric.successes ?? 0} · Success rate: ${metric.successRate === null ? 'n/a' : `${Math.round(metric.successRate * 100)}%`}`}
                </p>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="Team tactical observations">
          <p className="mb-3 rounded-lg bg-purple-50 p-3 text-xs font-semibold leading-5 text-purple-950">
            These are simplified coaching observations for style-of-play review. Relationship measures only appear when events are explicitly linked; nearby timing is not treated as causation.
          </p>
          <div className="space-y-3">
            {tacticalObservationReport.metrics.filter((metric) => metric.tracked || metric.total > 0).map((metric) => (
              <div key={metric.key} className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{metric.label}</p>
                  <p className="text-xs font-bold text-slate-500">{metric.coverageLabel}</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{metric.question}</p>
                <p className="mt-2 text-slate-700">
                  {metric.attempts === null
                    ? `Total: ${metric.total}`
                    : `Attempts: ${metric.attempts} · Successes: ${metric.successes ?? 0} · Failures: ${metric.failures ?? 0} · Success rate: ${metric.successRate === null ? 'n/a' : `${Math.round(metric.successRate * 100)}%`}`}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Our team: {metric.ourTeamTotal} · Opposition: {metric.oppositionTotal}</p>
                {metric.outcomeBreakdown.length > 0 && <p className="mt-1 text-xs text-slate-600">Outcomes: {metric.outcomeBreakdown.map((row) => `${row.label}: ${row.count}`).join(' · ')}</p>}
                {metric.detailBreakdown.length > 0 && <p className="mt-1 text-xs text-slate-600">Details: {metric.detailBreakdown.map((row) => `${row.label}: ${row.count}`).join(' · ')}</p>}
              </div>
            ))}
            {tacticalObservationReport.metrics.every((metric) => !metric.tracked && metric.total === 0) && (
              <EmptyText>No tactical observation events were selected or recorded for this match.</EmptyText>
            )}
          </div>
          {tacticalObservationReport.causalMeasures.length > 0 && (
            <div className="mt-4 rounded-lg border border-[rgba(6,186,169,0.24)] bg-[var(--brand-teal-soft)] p-3">
              <p className="text-sm font-bold text-[var(--brand-navy)]">Validated linked measures</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {tacticalObservationReport.causalMeasures.map((measure) => (
                  <div key={measure.key} className="rounded-lg bg-white p-3 text-sm">
                    <p className="font-bold text-slate-950">{measure.label}</p>
                    <p className="mt-1 font-black tabular-nums text-[var(--brand-teal-dark)]">{measure.numerator}/{measure.denominator}{measure.rate === null ? '' : ` · ${Math.round(measure.rate * 100)}%`}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{measure.coverageLabel}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tacticalObservationReport.unavailableMeasures.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-950">Unavailable linked measures</p>
              <div className="mt-2 space-y-2">
                {tacticalObservationReport.unavailableMeasures.map((measure) => (
                  <p key={measure.label} className="text-xs font-semibold leading-5 text-amber-900">
                    <span className="font-black">{measure.label}:</span> {measure.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </ReportPanel>

        <ReportPanel title="Standard-reportable tactical-pattern totals">
          {standardPatternRows.length === 0 ? (
            <EmptyText>No standard-reportable tactical-pattern observations were accepted for this match.</EmptyText>
          ) : (
            <div className="space-y-3">
              {Object.entries(standardPatternRows.reduce((groups, row) => {
                const group = groups[row.pattern] ?? { count: 0, outcomes: {} as Record<string, number> }
                group.count += 1
                group.outcomes[row.outcome] = (group.outcomes[row.outcome] ?? 0) + 1
                groups[row.pattern] = group
                return groups
              }, {} as Record<string, { count: number; outcomes: Record<string, number> }>)).map(([pattern, group]) => (
                <div key={pattern} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3"><p className="font-bold">{pattern}</p><p className="text-lg font-bold">{group.count}</p></div>
                  <p className="mt-1 text-sm text-gray-500">{Object.entries(group.outcomes).map(([outcome, count]) => `${outcome}: ${count}`).join(' · ')}</p>
                </div>
              ))}
            </div>
          )}
        </ReportPanel>

        <ReportPanel title="Player event counts">
          {playerEventCounts.length === 0 ? (
            <EmptyText>No player events were recorded. Event recording creates per-player totals for post-match review.</EmptyText>
          ) : (
            <div className="space-y-3">
              {playerEventCounts.map((row) => (
                <div key={row.playerId} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{row.playerName}</p>
                    <p className="text-lg font-bold">{row.total}</p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {row.eventCounts.map((eventCount) => `${eventCount.label}: ${eventCount.count}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ReportPanel>

        <ReportPanel title="Most involved players">
          {mostInvolvedPlayers.length === 0 ? (
            <EmptyText>No involvement data yet. Record player events to identify who was most involved.</EmptyText>
          ) : (
            <div className="space-y-2">
              {mostInvolvedPlayers.map((row, index) => (
                <div key={row.playerId} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
                  <p className="font-bold">{index + 1}. {row.playerName}</p>
                  <p className="text-lg font-bold">{row.total}</p>
                </div>
              ))}
            </div>
          )}
        </ReportPanel>

        {showClubTracking && (
          <ReportPanel title="Club tracking">
            {totalClubObservations === 0 ? (
              <EmptyText>No club tracking observations were accepted for this match.</EmptyText>
            ) : (
              <div className="space-y-5">
                <p className="rounded-lg bg-[var(--brand-teal-soft)] p-3 text-sm font-semibold leading-6 text-[var(--brand-navy)]">
                  Club tracking is an additional breakdown of observations recorded using your club&apos;s terminology. Some aliases and approved mappings also appear in the standard totals above.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MiniStat label="Total club observations" value={totalClubObservations} />
                  <MiniStat label="Standard-reportable club observations" value={standardReportableClubObservations} />
                  <MiniStat label="Club-only mapped observations" value={clubOnlyMappedObservations} />
                  <MiniStat label="Club-specific observations" value={clubSpecificObservations} />
                </div>
                <ClubCoverage rows={mappingCoverageRows} />
                <ClubEventGroups rows={clubEventAggregates} />
                <ClubPatternGroups rows={clubPatternAggregates} />
              </div>
            )}
          </ReportPanel>
        )}
      </div>

      <ReportPanel title="Match timeline" className="mt-4">
        {timelineEvents.length === 0 ? (
          <EmptyText>No timeline events were recorded. Live event taps will appear here in match order.</EmptyText>
        ) : (
          <div className="space-y-2">
            {timelineEvents.map((event) => (
              <article key={event.id} className="rounded-lg bg-gray-50 p-3">
                <p className="font-bold">{event.label}</p>
                {event.secondaryLabel && <p className="mt-1 text-xs font-bold text-slate-500">{event.secondaryLabel}</p>}
                <p className="mt-1 text-sm text-gray-500">
                  {formatHalf(event.half)} {formatMatchTime(event.matchSecond)} · {event.playerName} · {event.score}
                </p>
              </article>
            ))}
          </div>
        )}
      </ReportPanel>
    </section>
  )
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  )
}

function ReportPanel({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`rounded-xl bg-white p-4 shadow-sm ${className}`}>
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">{children}</p>
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function ClubCoverage({ rows }: { rows: MappingCoverageRow[] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <h4 className="font-bold text-slate-950">Mapping coverage</h4>
      <p className="mt-1 text-xs font-semibold text-slate-500">Reporting coverage and identity context, not a quality score.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-slate-100 bg-white p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-slate-950">{row.label}</p>
              <p className="font-black tabular-nums">{row.count}</p>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{Math.round(row.percentage * 100)}% of club observations</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClubEventGroups({ rows }: { rows: ClubEventAggregate[] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <h4 className="font-bold text-slate-950">Club event observations</h4>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <ClubGroupCard key={row.key} title={row.label} count={row.count} identityTypes={row.identityTypes} snapshots={row.mappingSnapshots}>
            <p>Standard-reportable: {row.standardReportableCount} · Club-only: {row.clubOnlyCount}</p>
            <p>Players: {row.playerCount} · Unit targets: {row.unitTargetCount} · Team targets: {row.teamTargetCount} · Locations: {row.locationCount}</p>
            <IdentityList label="Recorded standard" identities={row.recordedStandardIdentities} />
            <IdentityList label="Proposed standard" identities={row.proposedStandardIdentities} />
          </ClubGroupCard>
        ))}
      </div>
    </div>
  )
}

function ClubPatternGroups({ rows }: { rows: ClubPatternAggregate[] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <h4 className="font-bold text-slate-950">Club tactical-pattern observations</h4>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <ClubGroupCard key={row.key} title={row.label} count={row.count} identityTypes={row.identityTypes} snapshots={row.mappingSnapshots}>
            <p>Standard-reportable: {row.standardReportableCount} · Club-only: {row.clubOnlyCount} · Locations: {row.locationCount}</p>
            <p>Positive rate: {row.positiveRate === null ? 'Not available' : `${Math.round(row.positiveRate * 100)}%`}</p>
            <p>Outcomes: {Object.entries(row.outcomeCounts).map(([outcome, count]) => `${outcome}: ${count}`).join(' · ')}</p>
            <p>Scopes: {Object.entries(row.scopeCounts).map(([scope, count]) => `${scope}: ${count}`).join(' · ') || 'None'}</p>
            <IdentityList label="Recorded standard" identities={row.recordedStandardIdentities} />
            <IdentityList label="Proposed standard" identities={row.proposedStandardIdentities} />
          </ClubGroupCard>
        ))}
      </div>
    </div>
  )
}

function ClubGroupCard({
  title,
  count,
  identityTypes,
  snapshots,
  children,
}: {
  title: string
  count: number
  identityTypes: ClubEventAggregate['identityTypes']
  snapshots: ClubEventAggregate['mappingSnapshots']
  children: ReactNode
}) {
  const identityLabel = identityTypes.length === 1
    ? getObservationIdentityLabel(identityTypes[0])
    : 'Mixed historical mapping statuses'
  return (
    <article className="rounded-lg bg-gray-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{title}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">{identityLabel}</p>
        </div>
        <p className="text-2xl font-black tabular-nums text-slate-950">{count}</p>
      </div>
      <div className="mt-2 space-y-1 text-slate-600">{children}</div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-bold text-slate-600">Status and revision details</summary>
        <div className="mt-2 space-y-1 text-xs font-semibold text-slate-500">
          {snapshots.map((snapshot) => (
            <p key={`${snapshot.mappingStatusAtRecording ?? 'none'}:${snapshot.mappingRevisionAtRecording ?? 'none'}`}>
              {snapshot.mappingStatusAtRecording ?? 'No mapping status'} · rev {snapshot.mappingRevisionAtRecording ?? 'n/a'}: {snapshot.count}
            </p>
          ))}
        </div>
      </details>
    </article>
  )
}

function IdentityList({ label, identities }: { label: string; identities: Array<{ label: string }> }) {
  if (identities.length === 0) return null
  return <p>{label}: {identities.map((identity) => identity.label).join(', ')}</p>
}
