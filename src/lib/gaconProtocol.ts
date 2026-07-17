export const GACON_PROTOCOL_NAME = 'Gacon 45/15'
export const GACON_STARTING_LEVEL = 1
export const GACON_START_DISTANCE_METRES = 125
export const GACON_DISTANCE_INCREMENT_METRES = 6.25
export const GACON_COUNTDOWN_SECONDS = 3
export const GACON_WORK_SECONDS = 45
export const GACON_REST_SECONDS = 15

export type GaconProtocolPhase = 'COUNTDOWN' | 'WORK' | 'REST'

export type GaconRunningState = {
  phase: GaconProtocolPhase
  level: number
  nextLevel: number
  elapsedMs: number
  remainingMs: number
  durationMs: number
  phaseStartedAtMs: number
  phaseEndsAtMs: number
}

export type GaconPausedState = {
  phase: GaconProtocolPhase
  level: number
  remainingMs: number
}

const secondsToMs = (seconds: number) => seconds * 1000

export const GACON_COUNTDOWN_MS = secondsToMs(GACON_COUNTDOWN_SECONDS)
export const GACON_WORK_MS = secondsToMs(GACON_WORK_SECONDS)
export const GACON_REST_MS = secondsToMs(GACON_REST_SECONDS)
export const GACON_CYCLE_MS = GACON_WORK_MS + GACON_REST_MS

export const getGaconTargetDistance = (level: number) =>
  GACON_START_DISTANCE_METRES +
  (Math.max(GACON_STARTING_LEVEL, level) - GACON_STARTING_LEVEL) *
    GACON_DISTANCE_INCREMENT_METRES

export const formatGaconDistance = (distance: number) =>
  `${Number(distance.toFixed(2)).toLocaleString('en-GB', {
    maximumFractionDigits: 2,
  })} m`

export const formatGaconPhaseTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const getGaconRunningState = (
  protocolStartedAtMs: number,
  nowMs: number,
  startingLevel = GACON_STARTING_LEVEL
): GaconRunningState => {
  const protocolStartingLevel = Math.max(GACON_STARTING_LEVEL, startingLevel)
  const elapsedSinceStartMs = Math.max(0, nowMs - protocolStartedAtMs)

  if (elapsedSinceStartMs < GACON_COUNTDOWN_MS) {
    return {
      phase: 'COUNTDOWN',
      level: protocolStartingLevel,
      nextLevel: protocolStartingLevel,
      elapsedMs: elapsedSinceStartMs,
      remainingMs: GACON_COUNTDOWN_MS - elapsedSinceStartMs,
      durationMs: GACON_COUNTDOWN_MS,
      phaseStartedAtMs: protocolStartedAtMs,
      phaseEndsAtMs: protocolStartedAtMs + GACON_COUNTDOWN_MS,
    }
  }

  const elapsedAfterCountdownMs = elapsedSinceStartMs - GACON_COUNTDOWN_MS
  const completedCycles = Math.floor(elapsedAfterCountdownMs / GACON_CYCLE_MS)
  const cycleElapsedMs = elapsedAfterCountdownMs % GACON_CYCLE_MS
  const level = protocolStartingLevel + completedCycles
  const cycleStartedAtMs =
    protocolStartedAtMs + GACON_COUNTDOWN_MS + completedCycles * GACON_CYCLE_MS

  if (cycleElapsedMs < GACON_WORK_MS) {
    return {
      phase: 'WORK',
      level,
      nextLevel: level + 1,
      elapsedMs: cycleElapsedMs,
      remainingMs: GACON_WORK_MS - cycleElapsedMs,
      durationMs: GACON_WORK_MS,
      phaseStartedAtMs: cycleStartedAtMs,
      phaseEndsAtMs: cycleStartedAtMs + GACON_WORK_MS,
    }
  }

  const restElapsedMs = cycleElapsedMs - GACON_WORK_MS

  return {
    phase: 'REST',
    level,
    nextLevel: level + 1,
    elapsedMs: restElapsedMs,
    remainingMs: GACON_REST_MS - restElapsedMs,
    durationMs: GACON_REST_MS,
    phaseStartedAtMs: cycleStartedAtMs + GACON_WORK_MS,
    phaseEndsAtMs: cycleStartedAtMs + GACON_CYCLE_MS,
  }
}

export const getGaconProtocolStartFromPausedState = (
  pausedState: GaconPausedState,
  nowMs: number,
  startingLevel = GACON_STARTING_LEVEL
) => {
  const protocolStartingLevel = Math.max(GACON_STARTING_LEVEL, startingLevel)
  const remainingMs = Math.max(0, pausedState.remainingMs)

  if (pausedState.phase === 'COUNTDOWN') {
    const elapsedInPhaseMs = GACON_COUNTDOWN_MS - remainingMs
    return nowMs - elapsedInPhaseMs
  }

  const completedCycles = Math.max(
    0,
    pausedState.level - protocolStartingLevel
  )
  const cycleOffsetMs = completedCycles * GACON_CYCLE_MS

  if (pausedState.phase === 'WORK') {
    const elapsedInPhaseMs = GACON_WORK_MS - remainingMs
    return nowMs - GACON_COUNTDOWN_MS - cycleOffsetMs - elapsedInPhaseMs
  }

  const elapsedInPhaseMs = GACON_REST_MS - remainingMs
  return (
    nowMs -
    GACON_COUNTDOWN_MS -
    cycleOffsetMs -
    GACON_WORK_MS -
    elapsedInPhaseMs
  )
}
