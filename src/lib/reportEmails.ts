import { Resend } from 'resend'

import {
  buildMatchEventCsvRows,
  buildMatchPatternCsvRows,
  resolveMatchReportEvents,
  type MatchReportEventCsvSource,
  type MatchReportPatternCsvSource,
} from '@/lib/matchReportCsvRows'
import { prisma } from '@/lib/prisma'
import {
  buildFitnessResultsCsv,
  buildMatchEventsCsv,
  buildMatchPatternObservationsCsv,
  buildMatchSummaryCsv,
  getFitnessCsvFilename,
  getMatchCsvBaseFilename,
  type FitnessCsvResult,
  type MatchCsvMetadata,
  type MatchSummaryCsvRow,
} from '@/lib/reportCsv'

const formatDate = (date: Date) => new Intl.DateTimeFormat('en-GB').format(date)
const formatDateForFilename = (date: Date) => date.toISOString().slice(0, 10)

const formatStatus = (status: string) =>
  status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')

const formatSquadStatus = (status: string) => {
  if (status === 'STARTER') return 'Starter'
  if (status === 'SUBSTITUTE') return 'Substitute'
  return 'Not involved'
}

const formatMatchType = (matchType: string) =>
  matchType.charAt(0) + matchType.slice(1).toLowerCase()

const formatVenue = (venue: string) =>
  venue.charAt(0) + venue.slice(1).toLowerCase()

const formatResultStatus = (status: string) => {
  if (status === 'DID_NOT_START') return 'Did not start'
  if (status === 'DROPPED_OUT') return 'Dropped out'
  if (status === 'ABSENT') return 'Missed'
  return formatStatus(status)
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const getReportEmailConfig = () => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.REPORT_EMAIL_FROM

  if (!apiKey || !from) {
    console.warn(
      'Report email skipped: RESEND_API_KEY and REPORT_EMAIL_FROM must both be configured.'
    )
    return null
  }

  return { apiKey, from }
}

type CompletedMatchReportEmailMatch = {
  venue: string
  opposition: string
  kickoffAt: Date
  ownScore: number
  oppositionScore: number
  matchType: string
  team: { name: string; clubId: string; club: { name: string; sendMatchReportEmails: boolean } }
  matchDayPlayers: Array<{
    playerId: string
    squadStatus: string
    isTracked: boolean
    player: { firstName: string; surname: string; squadNumber: number | null }
    stints: Array<{ startedAt: Date; endedAt: Date | null }>
  }>
  matchEvents: MatchReportEventCsvSource[]
  patternObservations: MatchReportPatternCsvSource[]
}

export function buildCompletedMatchReportEmailAttachments(match: CompletedMatchReportEmailMatch) {
  const headline = match.venue === 'AWAY'
    ? `${match.opposition} vs ${match.team.name}`
    : `${match.team.name} vs ${match.opposition}`
  const finalScore = `${match.ownScore}-${match.oppositionScore}`
  const metadata: MatchCsvMetadata = {
    match: headline,
    dateLabel: formatDate(match.kickoffAt),
    dateForFilename: formatDateForFilename(match.kickoffAt),
    teamName: match.team.name,
    opposition: match.opposition,
    venue: formatVenue(match.venue),
    matchType: formatMatchType(match.matchType),
    finalScore,
  }
  const resolvedEvents = resolveMatchReportEvents(match.matchEvents)
  const standardReportEvents = resolvedEvents.filter((event) => event.reportingIdentity.contributesToStandardReporting)
  const playerEventCounts = new Map<string, Map<string, number>>()

  for (const event of standardReportEvents) {
    const playerId = event.playerId
    if (!playerId) continue

    const eventKey = event.eventDefinition?.legacyEventType ?? event.eventType
    if (!eventKey) continue

    const eventCounts = playerEventCounts.get(playerId) ?? new Map<string, number>()
    eventCounts.set(eventKey, (eventCounts.get(eventKey) ?? 0) + 1)
    playerEventCounts.set(playerId, eventCounts)
  }

  const getPlayerEventCount = (playerId: string, eventType: string) =>
    playerEventCounts.get(playerId)?.get(eventType) ?? 0
  const summaryRows: MatchSummaryCsvRow[] = match.matchDayPlayers.map((matchPlayer) => {
    const eventCounts = playerEventCounts.get(matchPlayer.playerId)
    const totalEvents = eventCounts
      ? Array.from(eventCounts.values()).reduce((total, count) => total + count, 0)
      : 0
    const totalMilliseconds = matchPlayer.stints.reduce((total, stint) => {
      if (!stint.endedAt) return total
      return total + Math.max(0, stint.endedAt.getTime() - stint.startedAt.getTime())
    }, 0)

    return {
      playerName: `${matchPlayer.player.firstName} ${matchPlayer.player.surname}`,
      squadNumber: matchPlayer.player.squadNumber,
      squadStatus: formatSquadStatus(matchPlayer.squadStatus),
      trackedForEvents: matchPlayer.isTracked,
      minutesPlayed: Math.round(totalMilliseconds / 60000),
      totalEvents,
      goals: getPlayerEventCount(matchPlayer.playerId, 'GOAL'),
      assists: getPlayerEventCount(matchPlayer.playerId, 'ASSIST'),
      shotsOnTarget: getPlayerEventCount(matchPlayer.playerId, 'SHOT_ON_TARGET'),
      shotsOffTarget: getPlayerEventCount(matchPlayer.playerId, 'SHOT_OFF_TARGET'),
      passComplete: getPlayerEventCount(matchPlayer.playerId, 'PASS_COMPLETE'),
      passIncomplete: getPlayerEventCount(matchPlayer.playerId, 'PASS_INCOMPLETE'),
      oneVOneSuccess: getPlayerEventCount(matchPlayer.playerId, 'ONE_V_ONE_SUCCESS'),
      oneVOneUnsuccessful: getPlayerEventCount(matchPlayer.playerId, 'ONE_V_ONE_UNSUCCESSFUL'),
    }
  })
  const baseFilename = getMatchCsvBaseFilename(metadata)
  const attachments = [{
    filename: `match-summary-${baseFilename}.csv`,
    content: buildMatchSummaryCsv(metadata, summaryRows),
  }]

  if (match.matchEvents.length > 0) {
    attachments.push({
      filename: `match-events-${baseFilename}.csv`,
      content: buildMatchEventsCsv(metadata, buildMatchEventCsvRows(resolvedEvents)),
    })
  }

  if (match.patternObservations.length > 0) {
    attachments.push({
      filename: `match-pattern-observations-${baseFilename}.csv`,
      content: buildMatchPatternObservationsCsv(metadata, buildMatchPatternCsvRows(match.patternObservations)),
    })
  }

  return { headline, finalScore, metadata, attachments }
}

const sendOwnerReportEmail = async ({
  clubId,
  subject,
  html,
  text,
  attachments,
}: {
  clubId: string
  subject: string
  html: string
  text: string
  attachments: { filename: string; content: string }[]
}) => {
  const config = getReportEmailConfig()
  if (!config) return

  const ownerEmails = await prisma.clubMembership.findMany({
    where: { clubId, role: 'OWNER' },
    select: { user: { select: { email: true } } },
  })
  const recipients = Array.from(
    new Set(
      ownerEmails
        .map((membership) => membership.user.email.trim())
        .filter(Boolean)
    )
  )

  if (recipients.length === 0) {
    console.warn(`Report email skipped: no club owner email addresses found for club ${clubId}.`)
    return
  }

  const resend = new Resend(config.apiKey)
  await resend.emails.send({
    from: config.from,
    to: config.from,
    bcc: recipients,
    subject,
    html,
    text,
    attachments,
  })
}

export async function sendCompletedMatchReportEmail(matchDayId: string): Promise<void> {
  try {
    const match = await prisma.matchDay.findUnique({
      where: { id: matchDayId },
      include: {
        team: { include: { club: true } },
        matchDayPlayers: {
          include: {
            player: true,
            stints: true,
          },
          orderBy: [{ player: { surname: 'asc' } }, { player: { firstName: 'asc' } }],
        },
        matchEvents: {
          include: {
            player: true,
            eventDefinition: true,
            clubTrackingDefinition: true,
            standardEventDefinitionAtRecording: true,
          },
          orderBy: [{ half: 'asc' }, { matchSecond: 'asc' }, { createdAt: 'asc' }],
        },
        patternObservations: {
          include: {
            player: true,
            pattern: { include: { outcomes: true } },
            outcome: true,
            trackingTask: { select: { scopeType: true, unitLabel: true } },
            clubTrackingDefinition: true,
            standardPatternDefinitionAtRecording: true,
          },
          orderBy: [{ half: 'asc' }, { matchSecond: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!match || match.status !== 'COMPLETED') return
    if (!match.team.club.sendMatchReportEmails) return

    const { headline, finalScore, metadata, attachments } = buildCompletedMatchReportEmailAttachments(match)
    const html = `<p>${escapeHtml(match.team.club.name)} match report completed.</p><ul><li>Match: ${escapeHtml(headline)}</li><li>Date: ${escapeHtml(metadata.dateLabel)}</li><li>Final score: ${escapeHtml(finalScore)}</li><li>Events recorded: ${match.matchEvents.length}</li></ul>`
    const text = `${match.team.club.name} match report completed.\nMatch: ${headline}\nDate: ${metadata.dateLabel}\nFinal score: ${finalScore}\nEvents recorded: ${match.matchEvents.length}`

    await sendOwnerReportEmail({
      clubId: match.team.clubId,
      subject: `Match report: ${headline}`,
      html,
      text,
      attachments,
    })
  } catch (error) {
    console.error('Completed match report email failed.', error)
  }
}

export async function sendCompletedFitnessReportEmail(sessionId: string): Promise<void> {
  try {
    const session = await prisma.fitnessTestSession.findUnique({
      where: { id: sessionId },
      include: {
        team: { include: { club: true } },
        fitnessTestType: true,
        results: {
          include: { player: true },
          orderBy: [{ player: { surname: 'asc' } }, { player: { firstName: 'asc' } }],
        },
      },
    })

    if (!session || session.status !== 'COMPLETED') return
    if (!session.team.club.sendFitnessReportEmails) return

    const resultRanks = new Map<string, number>()
    session.results
      .filter((result) => result.resultValue !== null)
      .sort((firstResult, secondResult) => {
        const firstValue = firstResult.resultValue ?? 0
        const secondValue = secondResult.resultValue ?? 0

        return session.fitnessTestType.higherIsBetter
          ? secondValue - firstValue
          : firstValue - secondValue
      })
      .forEach((result, index) => {
        resultRanks.set(result.id, index + 1)
      })

    const results: FitnessCsvResult[] = session.results.map((result) => ({
      playerName: `${result.player.firstName} ${result.player.surname}`,
      squadNumber: result.player.squadNumber,
      result:
        result.resultText ||
        (result.resultValue !== null
          ? `${result.resultValue} ${session.fitnessTestType.resultUnit}`
          : ''),
      resultValue: result.resultValue,
      resultStatus: formatResultStatus(result.status),
      rank: resultRanks.get(result.id) ?? null,
      notes: result.notes,
    }))
    const metadata = {
      sessionName: session.fitnessTestType.name,
      dateLabel: formatDate(session.date),
      dateForFilename: formatDateForFilename(session.date),
      teamName: session.team.name,
      clubName: session.team.club.name,
      testTypeName: session.fitnessTestType.name,
      sessionStatusLabel: 'Completed session',
    }
    const html = `<p>${escapeHtml(session.team.club.name)} fitness report completed.</p><ul><li>Test: ${escapeHtml(session.fitnessTestType.name)}</li><li>Team: ${escapeHtml(session.team.name)}</li><li>Date: ${escapeHtml(metadata.dateLabel)}</li><li>Results saved: ${session.results.length}</li></ul>`
    const text = `${session.team.club.name} fitness report completed.\nTest: ${session.fitnessTestType.name}\nTeam: ${session.team.name}\nDate: ${metadata.dateLabel}\nResults saved: ${session.results.length}`

    await sendOwnerReportEmail({
      clubId: session.team.clubId,
      subject: `Fitness report: ${session.fitnessTestType.name} - ${session.team.name}`,
      html,
      text,
      attachments: [
        {
          filename: getFitnessCsvFilename(metadata),
          content: buildFitnessResultsCsv(metadata, results),
        },
      ],
    })
  } catch (error) {
    console.error('Completed fitness report email failed.', error)
  }
}
