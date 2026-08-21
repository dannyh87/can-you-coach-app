import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  applyClassicTrackingModeSwitch,
  buildClassicMatchDayPlayerCreates,
  getClassicRecordingRequirement,
  sanitizeClassicTemplateSetup,
} from '@/lib/matchDayClassicSetup'
import { buildMatchEventCsvRows, resolveMatchReportEvents } from '@/lib/matchReportCsvRows'

const activePlayers = [
  { id: 'player-1', squadNumber: 9 },
  { id: 'player-2', squadNumber: 10 },
]

describe('classic match day setup rules', () => {
  it('defaults new schema rows to playing-time tracking off and migrates existing rows on', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260817120000_add_match_day_player_minutes_tracking/migration.sql'), 'utf8')
    const scopeMigration = readFileSync(join(process.cwd(), 'prisma/migrations/20260817123000_add_match_day_event_tracking_scope/migration.sql'), 'utf8')

    expect(schema).toContain('trackPlayerMinutes   Boolean                               @default(false)')
    expect(schema).toContain('eventTrackingScope   MatchDayEventTrackingScope            @default(TEAM)')
    expect(migration).toContain('ADD COLUMN "trackPlayerMinutes" BOOLEAN NOT NULL DEFAULT false')
    expect(migration).toContain('UPDATE "MatchDay" SET "trackPlayerMinutes" = true')
    expect(scopeMigration).toContain('ADD COLUMN "eventTrackingScope" "MatchDayEventTrackingScope" NOT NULL DEFAULT \'TEAM\'')
    expect(scopeMigration).toContain('UPDATE "MatchDay" SET "eventTrackingScope" = \'PLAYER\'')
  })

  it('copy setup carries the playing-time setting while clearing live state', () => {
    const pageSource = readFileSync(join(process.cwd(), 'src/app/match-day/[id]/page.tsx'), 'utf8')

    expect(pageSource).toContain('trackPlayerMinutes: sourceMatch.trackPlayerMinutes')
    expect(pageSource).toContain('eventTrackingScope: sourceMatch.eventTrackingScope')
    expect(pageSource).toContain('ownScore: 0')
    expect(pageSource).toContain('oppositionScore: 0')
    expect(pageSource).toContain('firstHalfStartedAt: null')
    expect(pageSource).toContain('completedAt: null')
  })

  it('creates no player rows for team-only tracking when minutes tracking is off', () => {
    const rows = buildClassicMatchDayPlayerCreates({ activePlayers, trackPlayerMinutes: false, eventTrackingScope: 'TEAM', trackedPlayerIds: new Set(), playerStatusById: new Map() })

    expect(rows).toEqual([])
  })

  it('creates only selected event-target player rows when minutes tracking is off', () => {
    const rows = buildClassicMatchDayPlayerCreates({ activePlayers, trackPlayerMinutes: false, eventTrackingScope: 'PLAYER', trackedPlayerIds: new Set(['player-2']), playerStatusById: new Map() })

    expect(rows).toEqual([{ playerId: 'player-2', squadStatus: 'NOT_INVOLVED', startingPosition: null, shirtNumberSnapshot: 10, isTracked: true }])
  })

  it('preserves starter and substitute classifications when minutes tracking is on', () => {
    const rows = buildClassicMatchDayPlayerCreates({ activePlayers, trackPlayerMinutes: true, eventTrackingScope: 'PLAYER', trackedPlayerIds: new Set(), playerStatusById: new Map([['player-1', 'STARTER'], ['player-2', 'SUBSTITUTE']]) })

    expect(rows).toEqual([
      { playerId: 'player-1', squadStatus: 'STARTER', startingPosition: null, shirtNumberSnapshot: 9, isTracked: true },
      { playerId: 'player-2', squadStatus: 'SUBSTITUTE', startingPosition: null, shirtNumberSnapshot: 10, isTracked: true },
    ])
  })

  it('copies full reusable template setup while omitting inactive players and unavailable events', () => {
    const result = sanitizeClassicTemplateSetup({
      template: {
        eventTrackingScope: 'PLAYER',
        trackPlayerMinutes: true,
        locationTrackingEnabled: true,
        selectedEventDefinitionIds: ['event-1', 'event-2', 'event-2', 'stale-event'],
        players: [
          { playerId: 'player-1', playerName: 'Alex One', squadStatus: 'STARTER', startingPosition: 'CM', shirtNumberSnapshot: 9, isTracked: true },
          { playerId: 'inactive-player', playerName: 'Inactive Player', squadStatus: 'SUBSTITUTE', startingPosition: 'LW', shirtNumberSnapshot: 7, isTracked: true },
          { playerId: 'player-2', playerName: 'Bea Two', squadStatus: 'NOT_INVOLVED', startingPosition: null, shirtNumberSnapshot: 10, isTracked: false },
        ],
      },
      activePlayers: [{ id: 'player-1', squadNumber: 9 }, { id: 'player-2', squadNumber: 10 }],
      validEventDefinitionIds: new Set(['event-1', 'event-2']),
    })

    expect(result).toMatchObject({
      eventTrackingScope: 'PLAYER',
      trackPlayerMinutes: true,
      locationTrackingEnabled: true,
      selectedEventDefinitionIds: ['event-1', 'event-2'],
      trackedPlayerIds: ['player-1'],
      playerStatuses: { 'player-1': 'STARTER', 'player-2': 'NOT_INVOLVED' },
      startingPositions: { 'player-1': 'CM', 'player-2': '' },
      omittedPlayers: ['Inactive Player'],
      omittedEventDefinitionCount: 2,
    })
  })

  it('keeps the new wizard copy flow in a modal and preserves fixture details', () => {
    const wizardSource = readFileSync(join(process.cwd(), 'src/app/match-day/new/MatchDayWizard.tsx'), 'utf8')
    const pageSource = readFileSync(join(process.cwd(), 'src/app/match-day/new/page.tsx'), 'utf8')

    expect(wizardSource).toContain('TemplatePickerModal')
    expect(wizardSource).toContain('Preview and apply setup inside this wizard.')
    expect(wizardSource).toContain('Fixture details stay unchanged.')
    expect(wizardSource).toContain('Use this setup')
    expect(wizardSource).not.toContain('Open an existing match and use Copy setup.')
    expect(pageSource).toContain('where: { id: templateId, teamId }')
  })

  it('saved copy setup creates an unambiguous new draft without live/result data', () => {
    const pageSource = readFileSync(join(process.cwd(), 'src/app/match-day/[id]/page.tsx'), 'utf8')

    expect(pageSource).toContain('opposition: `Copy of ${sourceMatch.opposition}`')
    expect(pageSource).toContain('redirect(`/match-day/${newMatch.id}?setupCopied=1`)')
    expect(pageSource).toContain('ownScore: 0')
    expect(pageSource).toContain('oppositionScore: 0')
    expect(pageSource).toContain('firstHalfStartedAt: null')
    expect(pageSource).toContain('completedAt: null')
    expect(pageSource).toContain('activePlayerIds.has(player.playerId)')
  })

  it('wizard validation and recommendation copy stay user-triggered', () => {
    const wizardSource = readFileSync(join(process.cwd(), 'src/app/match-day/new/MatchDayWizard.tsx'), 'utf8')

    expect(wizardSource).toContain('No events selected yet.')
    expect(wizardSource).toContain('Select at least one event to track for this match.')
    expect(wizardSource).toContain('These events will be recorded for the whole team.')
    expect(wizardSource).toContain('These events will be attributed to your selected players.')
    expect(wizardSource).toContain('recommendationApplied ?')
  })

  it('clears stale selected players when switching to team-only tracking', () => {
    const nextState = applyClassicTrackingModeSwitch({ trackPlayerMinutes: false, eventTrackingScope: 'TEAM', trackedPlayerIds: ['player-1'], playerStatuses: { 'player-1': 'STARTER' } })

    expect(nextState.trackedPlayerIds).toEqual([])
    expect(nextState.playerStatuses).toEqual({})
  })

  it('clears stale squad classifications when switching playing-time tracking off', () => {
    const nextState = applyClassicTrackingModeSwitch({ trackPlayerMinutes: false, eventTrackingScope: 'PLAYER', trackedPlayerIds: ['player-1'], playerStatuses: { 'player-1': 'STARTER' } })

    expect(nextState.trackedPlayerIds).toEqual(['player-1'])
    expect(nextState.playerStatuses).toEqual({})
  })

  it('retains explicit choices while playing-time tracking is on', () => {
    const nextState = applyClassicTrackingModeSwitch({ trackPlayerMinutes: true, eventTrackingScope: 'PLAYER', trackedPlayerIds: ['player-1'], playerStatuses: { 'player-1': 'STARTER' } })

    expect(nextState.trackedPlayerIds).toEqual(['player-1'])
    expect(nextState.playerStatuses).toEqual({ 'player-1': 'STARTER' })
  })

  it('allows team-only event recording without a player target', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'TEAM', trackPlayerMinutes: false, hasPlayerTarget: false, playerIsValidTarget: false, playerHasOpenStint: false })).toEqual({ ok: true, playerIdRequired: false })
  })

  it('rejects a player target in team event tracking', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'TEAM', trackPlayerMinutes: true, hasPlayerTarget: true, playerIsValidTarget: true, playerHasOpenStint: true })).toEqual({ ok: false, reason: 'Team event tracking does not accept a player target.' })
  })

  it('requires selected players for player event tracking', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'PLAYER', trackPlayerMinutes: false, hasPlayerTarget: false, playerIsValidTarget: false, playerHasOpenStint: false })).toEqual({ ok: false, reason: 'Select a player for player event tracking.' })
  })

  it('allows selected-player recording without an open stint when minutes tracking is off', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'PLAYER', trackPlayerMinutes: false, hasPlayerTarget: true, playerIsValidTarget: true, playerHasOpenStint: false })).toEqual({ ok: true, playerIdRequired: true })
  })

  it('rejects unselected players for player event tracking', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'PLAYER', trackPlayerMinutes: false, hasPlayerTarget: true, playerIsValidTarget: false, playerHasOpenStint: false })).toEqual({ ok: false, reason: 'Player is not available for event tracking in this match.' })
  })

  it('keeps on-pitch enforcement when minutes tracking is on', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'PLAYER', trackPlayerMinutes: true, hasPlayerTarget: true, playerIsValidTarget: true, playerHasOpenStint: false })).toEqual({ ok: false, reason: 'Events can only be recorded for players on the pitch.' })
  })

  it('allows team events while minutes tracking is on', () => {
    expect(getClassicRecordingRequirement({ eventTrackingScope: 'TEAM', trackPlayerMinutes: true, hasPlayerTarget: false, playerIsValidTarget: false, playerHasOpenStint: false })).toEqual({ ok: true, playerIdRequired: false })
  })

  it('renders team and player events correctly in CSV rows', () => {
    const events = resolveMatchReportEvents([
      { id: 'team-event', half: 'FIRST_HALF', matchSecond: 60, playerId: null, player: null, eventType: 'PASS_COMPLETE', eventDefinitionId: null, eventDefinition: null, standardEventDefinitionIdAtRecording: null, standardEventDefinitionAtRecording: null, clubTrackingDefinitionId: null, clubTrackingDefinition: null, clubMappingStatusAtRecording: null, clubMappingRevisionAtRecording: null, ownScoreAtTime: 0, oppositionScoreAtTime: 0 },
      { id: 'player-event', half: 'FIRST_HALF', matchSecond: 120, playerId: 'player-1', player: { firstName: 'Alex', surname: 'Morgan' }, eventType: 'SHOT_ON_TARGET', eventDefinitionId: null, eventDefinition: null, standardEventDefinitionIdAtRecording: null, standardEventDefinitionAtRecording: null, clubTrackingDefinitionId: null, clubTrackingDefinition: null, clubMappingStatusAtRecording: null, clubMappingRevisionAtRecording: null, ownScoreAtTime: 0, oppositionScoreAtTime: 0 },
    ])

    expect(events.map((event) => event.targetScope)).toEqual(['TEAM', 'PLAYER'])
    expect(buildMatchEventCsvRows(events).map((row) => row.playerName)).toEqual(['Whole team', 'Alex Morgan'])
  })
})
