export type ClassicSquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'
export type ClassicTrackingFocus = 'TEAM' | 'PLAYERS'

export type ClassicActivePlayer = {
  id: string
  squadNumber: number | null
}

export function buildClassicMatchDayPlayerCreates({
  activePlayers,
  trackPlayerMinutes,
  trackingFocus,
  trackedPlayerIds,
  playerStatusById,
}: {
  activePlayers: ClassicActivePlayer[]
  trackPlayerMinutes: boolean
  trackingFocus: ClassicTrackingFocus
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

  if (trackingFocus === 'TEAM') return []

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
  trackingFocus,
  trackedPlayerIds,
  playerStatuses,
}: {
  trackPlayerMinutes: boolean
  trackingFocus: ClassicTrackingFocus
  trackedPlayerIds: string[]
  playerStatuses: Record<string, ClassicSquadStatus>
}) {
  return {
    trackPlayerMinutes,
    trackingFocus,
    trackedPlayerIds: trackingFocus === 'TEAM' ? [] : trackedPlayerIds,
    playerStatuses: trackPlayerMinutes ? playerStatuses : {},
  }
}

export function getClassicRecordingRequirement({
  trackPlayerMinutes,
  hasPlayerTarget,
  playerIsValidTarget,
  playerHasOpenStint,
}: {
  trackPlayerMinutes: boolean
  hasPlayerTarget: boolean
  playerIsValidTarget: boolean
  playerHasOpenStint: boolean
}) {
  if (!hasPlayerTarget) return { ok: true as const, playerIdRequired: false }
  if (!playerIsValidTarget) return { ok: false as const, reason: 'Player is not available for event tracking in this match.' }
  if (trackPlayerMinutes && !playerHasOpenStint) return { ok: false as const, reason: 'Events can only be recorded for players on the pitch.' }
  return { ok: true as const, playerIdRequired: true }
}
