import type { ReactNode } from 'react'

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
  mostInvolvedPlayers: PlayerEventCountRow[]
  timelineEvents: TimelineEvent[]
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
  mostInvolvedPlayers,
  timelineEvents,
}: MatchSummaryReportProps) {
  return (
    <section className="rounded-2xl bg-gray-50 p-5 sm:p-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-green-700">Match report</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{headline}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {matchDate} · {statusLabel}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-medium text-gray-500">Final score</p>
            <p className="text-5xl font-bold tabular-nums">{finalScore}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <ReportCard label="Match result" value={finalScore} />
        <ReportCard label="Team events" value={String(teamEventTotals.reduce((total, row) => total + row.count, 0))} />
        <ReportCard label="Players used" value={String(minutesRows.filter((row) => row.minutesPlayed > 0).length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ReportPanel title="Minutes played">
          {minutesRows.length === 0 ? (
            <EmptyText>No minutes were recorded.</EmptyText>
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

        <ReportPanel title="Team event totals">
          {teamEventTotals.length === 0 ? (
            <EmptyText>No events were recorded.</EmptyText>
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
        <ReportPanel title="Player event counts">
          {playerEventCounts.length === 0 ? (
            <EmptyText>No player events were recorded.</EmptyText>
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
            <EmptyText>No involvement data yet.</EmptyText>
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
      </div>

      <ReportPanel title="Match timeline" className="mt-4">
        {timelineEvents.length === 0 ? (
          <EmptyText>No timeline events were recorded.</EmptyText>
        ) : (
          <div className="space-y-2">
            {timelineEvents.map((event) => (
              <article key={event.id} className="rounded-lg bg-gray-50 p-3">
                <p className="font-bold">{event.label}</p>
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
