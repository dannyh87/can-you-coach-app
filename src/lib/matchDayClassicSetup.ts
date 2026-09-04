export type ClassicSquadStatus = 'STARTER' | 'SUBSTITUTE' | 'NOT_INVOLVED'
export type ClassicEventTrackingScope = 'TEAM' | 'PLAYER'

export const MAX_CLASSIC_OBSERVATIONS = 8
export const MAX_CLASSIC_RECOMMENDED_OBSERVATIONS = 6
export const CLASSIC_RECOMMENDED_OBSERVATION_RANGE = { min: 4, max: 6 } as const

export type ClassicActivePlayer = {
  id: string
  squadNumber: number | null
}

export type ClassicTemplatePlayer = {
  playerId: string
  playerName?: string
  squadStatus: ClassicSquadStatus
  startingPosition: string | null
  shirtNumberSnapshot: number | null
  isTracked: boolean
}

export type ClassicTemplateSetup = {
  eventTrackingScope: ClassicEventTrackingScope
  trackPlayerMinutes: boolean
  selectedEventDefinitionIds: string[]
  locationTrackingEnabled: boolean
  players: ClassicTemplatePlayer[]
}

export function buildClassicMatchDayPlayerCreates({
  activePlayers,
  trackPlayerMinutes,
  eventTrackingScope,
  trackedPlayerIds,
  playerStatusById,
  startingPositionById = new Map(),
  isTrackedById = new Map(),
}: {
  activePlayers: ClassicActivePlayer[]
  trackPlayerMinutes: boolean
  eventTrackingScope: ClassicEventTrackingScope
  trackedPlayerIds: Set<string>
  playerStatusById: Map<string, ClassicSquadStatus>
  startingPositionById?: Map<string, string>
  isTrackedById?: Map<string, boolean>
}) {
  if (trackPlayerMinutes) {
    return activePlayers.map((player) => {
      const squadStatus = playerStatusById.get(player.id) ?? 'NOT_INVOLVED'
      const startingPosition = startingPositionById.get(player.id)?.trim() || null
      return {
        playerId: player.id,
        squadStatus,
        startingPosition,
        shirtNumberSnapshot: player.squadNumber,
        isTracked: isTrackedById.get(player.id) ?? squadStatus !== 'NOT_INVOLVED',
      }
    })
  }

  if (eventTrackingScope === 'TEAM') return []

  return activePlayers
    .filter((player) => trackedPlayerIds.has(player.id))
    .map((player) => ({
      playerId: player.id,
      squadStatus: 'NOT_INVOLVED' as const,
      startingPosition: startingPositionById.get(player.id)?.trim() || null,
      shirtNumberSnapshot: player.squadNumber,
      isTracked: isTrackedById.get(player.id) ?? true,
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

export function sanitizeClassicTemplateSetup({
  template,
  activePlayers,
  validEventDefinitionIds,
}: {
  template: ClassicTemplateSetup
  activePlayers: Array<ClassicActivePlayer & { name?: string }>
  validEventDefinitionIds: Set<string>
}) {
  const activePlayersById = new Map(activePlayers.map((player) => [player.id, player]))
  const omittedPlayers = template.players.filter((player) => !activePlayersById.has(player.playerId))
  const validPlayers = template.players.filter((player) => activePlayersById.has(player.playerId))
  const selectedEventDefinitionIds = Array.from(new Set(
    template.selectedEventDefinitionIds.filter((eventDefinitionId) => validEventDefinitionIds.has(eventDefinitionId))
  ))

  return {
    eventTrackingScope: template.eventTrackingScope,
    trackPlayerMinutes: template.trackPlayerMinutes,
    selectedEventDefinitionIds,
    locationTrackingEnabled: template.locationTrackingEnabled,
    trackedPlayerIds: validPlayers.filter((player) => player.isTracked).map((player) => player.playerId),
    playerStatuses: Object.fromEntries(validPlayers.map((player) => [player.playerId, player.squadStatus])) as Record<string, ClassicSquadStatus>,
    startingPositions: Object.fromEntries(validPlayers.map((player) => [player.playerId, player.startingPosition ?? ''])) as Record<string, string>,
    omittedPlayers: omittedPlayers.map((player) => player.playerName ?? player.playerId),
    omittedEventDefinitionCount: template.selectedEventDefinitionIds.length - selectedEventDefinitionIds.length,
  }
}

export function limitClassicRecommendedEventIds(eventDefinitionIds: string[]) {
  return eventDefinitionIds.slice(0, MAX_CLASSIC_RECOMMENDED_OBSERVATIONS)
}

export function getClassicObservationLimitState(selectedObservationCount: number) {
  if (selectedObservationCount === 0) {
    return {
      canProceed: false,
      canAddMore: true,
      overLimitBy: 0,
      label: 'No events selected yet.',
      message: 'Choose at least one event to record.',
      tone: 'empty' as const,
    }
  }

  if (selectedObservationCount <= 3) {
    return {
      canProceed: true,
      canAddMore: true,
      overLimitBy: 0,
      label: 'Light setup.',
      message: 'Add a few more if they will help your observation.',
      tone: 'light' as const,
    }
  }

  if (selectedObservationCount <= CLASSIC_RECOMMENDED_OBSERVATION_RANGE.max) {
    return {
      canProceed: true,
      canAddMore: true,
      overLimitBy: 0,
      label: 'Ideal for one observer.',
      message: 'This is a focused set for live recording.',
      tone: 'ideal' as const,
    }
  }

  if (selectedObservationCount <= MAX_CLASSIC_OBSERVATIONS) {
    return {
      canProceed: true,
      canAddMore: selectedObservationCount < MAX_CLASSIC_OBSERVATIONS,
      overLimitBy: 0,
      label: 'Approaching the maximum.',
      message: 'Keep this manageable from the touchline.',
      tone: 'near-limit' as const,
    }
  }

  return {
    canProceed: false,
    canAddMore: false,
    overLimitBy: selectedObservationCount - MAX_CLASSIC_OBSERVATIONS,
    label: 'Too many events selected.',
    message: `Remove ${selectedObservationCount - MAX_CLASSIC_OBSERVATIONS} event${selectedObservationCount - MAX_CLASSIC_OBSERVATIONS === 1 ? '' : 's'} before continuing.`,
    tone: 'over-limit' as const,
  }
}
