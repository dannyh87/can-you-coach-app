import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  applyClassicTrackingModeSwitch,
  buildClassicMatchDayPlayerCreates,
  getClassicRecordingRequirement,
} from '@/lib/matchDayClassicSetup'

const activePlayers = [
  { id: 'player-1', squadNumber: 9 },
  { id: 'player-2', squadNumber: 10 },
]

describe('classic match day setup rules', () => {
  it('defaults new schema rows to playing-time tracking off and migrates existing rows on', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const migration = readFileSync(join(process.cwd(), 'prisma/migrations/20260817120000_add_match_day_player_minutes_tracking/migration.sql'), 'utf8')

    expect(schema).toContain('trackPlayerMinutes   Boolean                               @default(false)')
    expect(migration).toContain('ADD COLUMN "trackPlayerMinutes" BOOLEAN NOT NULL DEFAULT false')
    expect(migration).toContain('UPDATE "MatchDay" SET "trackPlayerMinutes" = true')
  })

  it('copy setup carries the playing-time setting while clearing live state', () => {
    const pageSource = readFileSync(join(process.cwd(), 'src/app/match-day/[id]/page.tsx'), 'utf8')

    expect(pageSource).toContain('trackPlayerMinutes: sourceMatch.trackPlayerMinutes')
    expect(pageSource).toContain('ownScore: 0')
    expect(pageSource).toContain('oppositionScore: 0')
    expect(pageSource).toContain('firstHalfStartedAt: null')
    expect(pageSource).toContain('completedAt: null')
  })

  it('creates no player rows for team-only tracking when minutes tracking is off', () => {
    const rows = buildClassicMatchDayPlayerCreates({ activePlayers, trackPlayerMinutes: false, trackingFocus: 'TEAM', trackedPlayerIds: new Set(), playerStatusById: new Map() })

    expect(rows).toEqual([])
  })

  it('creates only selected event-target player rows when minutes tracking is off', () => {
    const rows = buildClassicMatchDayPlayerCreates({ activePlayers, trackPlayerMinutes: false, trackingFocus: 'PLAYERS', trackedPlayerIds: new Set(['player-2']), playerStatusById: new Map() })

    expect(rows).toEqual([{ playerId: 'player-2', squadStatus: 'NOT_INVOLVED', shirtNumberSnapshot: 10, isTracked: true }])
  })

  it('preserves starter and substitute classifications when minutes tracking is on', () => {
    const rows = buildClassicMatchDayPlayerCreates({ activePlayers, trackPlayerMinutes: true, trackingFocus: 'TEAM', trackedPlayerIds: new Set(), playerStatusById: new Map([['player-1', 'STARTER'], ['player-2', 'SUBSTITUTE']]) })

    expect(rows).toEqual([
      { playerId: 'player-1', squadStatus: 'STARTER', shirtNumberSnapshot: 9, isTracked: true },
      { playerId: 'player-2', squadStatus: 'SUBSTITUTE', shirtNumberSnapshot: 10, isTracked: true },
    ])
  })

  it('clears stale selected players when switching to team-only tracking', () => {
    const nextState = applyClassicTrackingModeSwitch({ trackPlayerMinutes: false, trackingFocus: 'TEAM', trackedPlayerIds: ['player-1'], playerStatuses: { 'player-1': 'STARTER' } })

    expect(nextState.trackedPlayerIds).toEqual([])
    expect(nextState.playerStatuses).toEqual({})
  })

  it('clears stale squad classifications when switching playing-time tracking off', () => {
    const nextState = applyClassicTrackingModeSwitch({ trackPlayerMinutes: false, trackingFocus: 'PLAYERS', trackedPlayerIds: ['player-1'], playerStatuses: { 'player-1': 'STARTER' } })

    expect(nextState.trackedPlayerIds).toEqual(['player-1'])
    expect(nextState.playerStatuses).toEqual({})
  })

  it('retains explicit choices while playing-time tracking is on', () => {
    const nextState = applyClassicTrackingModeSwitch({ trackPlayerMinutes: true, trackingFocus: 'PLAYERS', trackedPlayerIds: ['player-1'], playerStatuses: { 'player-1': 'STARTER' } })

    expect(nextState.trackedPlayerIds).toEqual(['player-1'])
    expect(nextState.playerStatuses).toEqual({ 'player-1': 'STARTER' })
  })

  it('allows team-only event recording without a player target', () => {
    expect(getClassicRecordingRequirement({ trackPlayerMinutes: false, hasPlayerTarget: false, playerIsValidTarget: false, playerHasOpenStint: false })).toEqual({ ok: true, playerIdRequired: false })
  })

  it('allows selected-player recording without an open stint when minutes tracking is off', () => {
    expect(getClassicRecordingRequirement({ trackPlayerMinutes: false, hasPlayerTarget: true, playerIsValidTarget: true, playerHasOpenStint: false })).toEqual({ ok: true, playerIdRequired: true })
  })

  it('keeps on-pitch enforcement when minutes tracking is on', () => {
    expect(getClassicRecordingRequirement({ trackPlayerMinutes: true, hasPlayerTarget: true, playerIsValidTarget: true, playerHasOpenStint: false })).toEqual({ ok: false, reason: 'Events can only be recorded for players on the pitch.' })
  })
})
