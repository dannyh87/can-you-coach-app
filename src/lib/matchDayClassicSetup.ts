export type ClassicSquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'
export type ClassicEventTrackingScope = 'TEAM' | 'PLAYER'

export type ClassicActivePlayer = {
  id: string
  squadNumber: number | null
}

export function buildClassicMatchDayPlayerCreates({
  activePlayers,
  trackPlayerMinutes,
  eventTrackingScope,
  trackedPlayerIds,
  playerStatusById,
}: {
  activePlayers: ClassicActivePlayer[]
  trackPlayerMinutes: boolean
  eventTrackingScope: ClassicEventTrackingScope
  trackedPlayerIds: Set<string>
  playerStatusById: Map<string, ClassicSquadStatus>
}) {
  if (trackPlayerMinutes) {
    return activePlayers.map((player) => {
      const squadStatus = playerStatusById.get(player.id) ?? 'NOT_INVOLVED'
      return {
        playerId: player.id,
        squadStatus,
        shirtNumberSnapshot: player.squadNumber,
        isTracked: squadStatus !== 'NOT_INVOLVED',
      }
    })
  }

  if (eventTrackingScope === 'TEAM') return []

  return activePlayers
    .filter((player) => trackedPlayerIds.has(player.id))
    .map((player) => ({
      playerId: player.id,
      squadStatus: 'NOT_INVOLVED' as const,
      shirtNumberSnapshot: player.squadNumber,
      isTracked: true,
    }))
}

export function applyClassicTrackingModeSwitch({
  trackPlayerMinutes,
  eventTrackingScope,
  trackedPlayerIds,
  playerStatuses,
}: {
  trackPlayerMinutes: boolean
  eventTrackingScope: ClassicEventTrackingScope
  trackedPlayerIds: string[]
  playerStatuses: Record<string, ClassicSquadStatus>
}) {
  return {
    trackPlayerMinutes,
    eventTrackingScope,
    trackedPlayerIds: eventTrackingScope === 'TEAM' ? [] : trackedPlayerIds,
    playerStatuses: trackPlayerMinutes ? playerStatuses : {},
  }
}

export function getClassicRecordingRequirement({
  eventTrackingScope,
  trackPlayerMinutes,
  hasPlayerTarget,
  playerIsValidTarget,
  playerHasOpenStint,
}: {
  eventTrackingScope: ClassicEventTrackingScope
  trackPlayerMinutes: boolean
  hasPlayerTarget: boolean
  playerIsValidTarget: boolean
  playerHasOpenStint: boolean
}) {
  if (eventTrackingScope === 'TEAM') return hasPlayerTarget
    ? { ok: false as const, reason: 'Team event tracking does not accept a player target.' }
    : { ok: true as const, playerIdRequired: false }
  if (!hasPlayerTarget) return { ok: false as const, reason: 'Select a player for player event tracking.' }
  if (!playerIsValidTarget) return { ok: false as const, reason: 'Player is not available for event tracking in this match.' }
  if (trackPlayerMinutes && !playerHasOpenStint) return { ok: false as const, reason: 'Events can only be recorded for players on the pitch.' }
  return { ok: true as const, playerIdRequired: true }
}
