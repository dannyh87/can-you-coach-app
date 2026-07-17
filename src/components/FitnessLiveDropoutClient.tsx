'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import FitnessTestCompleteSummary from '@/components/FitnessTestCompleteSummary'
import {
  formatGaconDistance,
  formatGaconPhaseTime,
  GACON_COUNTDOWN_MS,
  GACON_REST_MS,
  GACON_STARTING_LEVEL,
  GACON_WORK_MS,
  getGaconProtocolStartFromPausedState,
  getGaconRunningState,
  getGaconTargetDistance,
  type GaconPausedState,
} from '@/lib/gaconProtocol'

type DropoutPlayer = {
  id: string
  firstName: string
  surname: string
  squadNumber: number | null
  preferredPosition: string | null
  result: {
    resultValue: number | null
    resultText: string | null
  } | null
}

type FitnessLiveDropoutClientProps = {
  sessionId: string
  testTypeName: string
  teamName: string
  dateLabel: string
  sessionStatusLabel: string
  resultUnit: string
  higherIsBetter: boolean
  targetScores?: string | null
  rankingsHref: string
  progressHref: string
  isLive: boolean
  isCompleted: boolean
  startedAt: string | null
  completedAt: string | null
  gaconProtocol?: {
    name: string
    startingLevel: number
    startDistanceMetres: number
    distanceIncrementMetres: number
    countdownSeconds: number
    workSeconds: number
    restSeconds: number
  } | null
  players: DropoutPlayer[]
  startSessionAction: (formData: FormData) =>
    Promise<
      | { ok: true; startedAt: string }
      | { ok: false; reason: string }
      | undefined
    >
  endSessionAction: (formData: FormData) =>
    Promise<
      | { ok: true; completedAt: string }
      | { ok: false; reason: string }
      | undefined
    >
  saveDropoutAction: (formData: FormData) => Promise<
    | {
        ok: true
        playerId: string
        resultValue: number | null
        resultText: string | null
      }
    | { ok: false }
    | undefined
  >
  undoDropoutAction: (formData: FormData) =>
    Promise<{ ok: true; playerId: string } | { ok: false } | undefined>
}

type GaconTimerStatus = 'READY' | 'COUNTDOWN' | 'WORK' | 'REST' | 'PAUSED' | 'COMPLETE'

type AudioContextConstructor = typeof AudioContext

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: AudioContextConstructor
}

type WakeLockSentinelLike = {
  released: boolean
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

const formatResult = (result: DropoutPlayer['result']) => {
  if (!result) return 'Still in'
  if (result.resultText) return result.resultText
  if (result.resultValue !== null) return String(result.resultValue)
  return 'Recorded'
}

const hasRecordedResult = (player: DropoutPlayer) => player.result !== null
const formatPlayerName = (player: DropoutPlayer) => `${player.firstName} ${player.surname}`

const formatLevel = (level: number) =>
  Number.isInteger(level) ? String(level) : level.toFixed(1)

const parsePositiveLevel = (value: string) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= GACON_STARTING_LEVEL
    ? numberValue
    : GACON_STARTING_LEVEL
}

const getCurrentTimeMs = () => performance.timeOrigin + performance.now()

export default function FitnessLiveDropoutClient(
  props: FitnessLiveDropoutClientProps
) {
  return <FitnessLiveDropoutInner key={props.sessionId} {...props} />
}

function FitnessLiveDropoutInner({
  sessionId,
  testTypeName,
  teamName,
  dateLabel,
  sessionStatusLabel,
  resultUnit,
  higherIsBetter,
  targetScores,
  rankingsHref,
  progressHref,
  isLive,
  isCompleted,
  startedAt,
  completedAt,
  gaconProtocol,
  players,
  startSessionAction,
  endSessionAction,
  saveDropoutAction,
  undoDropoutAction,
}: FitnessLiveDropoutClientProps) {
  const [dropoutPlayers, setDropoutPlayers] = useState(players)
  const [localStartedAt, setLocalStartedAt] = useState<string | null>(null)
  const [localCompletedAt, setLocalCompletedAt] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [currentLevel, setCurrentLevel] = useState('1')
  const currentLevelRef = useRef(currentLevel)
  const [gaconTimerStatus, setGaconTimerStatus] = useState<GaconTimerStatus>(
    isCompleted ? 'COMPLETE' : 'READY'
  )
  const [gaconProtocolStartedAtMs, setGaconProtocolStartedAtMs] = useState<number | null>(null)
  const [gaconPausedState, setGaconPausedState] = useState<GaconPausedState | null>(null)
  const [gaconStartingLevel, setGaconStartingLevel] = useState(GACON_STARTING_LEVEL)
  const [nowMs, setNowMs] = useState(() => getCurrentTimeMs())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const previousCueKeyRef = useRef<string | null>(null)
  const countdownCueSecondRef = useRef<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null)
  const activePlayers = dropoutPlayers.filter((player) => !hasRecordedResult(player))
  const completedPlayers = dropoutPlayers.filter(hasRecordedResult)
  const allPlayersFinished =
    dropoutPlayers.length > 0 && completedPlayers.length === dropoutPlayers.length
  const isSessionCompleted = isCompleted || Boolean(localCompletedAt)
  const isSessionLive = !isSessionCompleted && (isLive || Boolean(localStartedAt))
  const effectiveStartedAt = localStartedAt ?? startedAt
  const effectiveCompletedAt = localCompletedAt ?? completedAt
  const isGaconProtocol = Boolean(gaconProtocol)
  const gaconRunningState =
    isGaconProtocol && gaconProtocolStartedAtMs !== null && gaconTimerStatus !== 'PAUSED'
      ? getGaconRunningState(gaconProtocolStartedAtMs, nowMs, gaconStartingLevel)
      : null
  const gaconCurrentLevel = gaconRunningState?.level ?? gaconPausedState?.level ?? parsePositiveLevel(currentLevel)
  const gaconTimerDisplayStatus: GaconTimerStatus = isSessionCompleted
    ? 'COMPLETE'
    : gaconTimerStatus === 'PAUSED'
      ? 'PAUSED'
      : gaconRunningState?.phase ?? gaconTimerStatus

  const gaconPhase = gaconRunningState?.phase ?? null
  const gaconRunningLevel = gaconRunningState?.level ?? null
  const gaconRemainingMs = gaconRunningState?.remainingMs ?? null

  const setSharedCurrentLevel = (nextLevel: string) => {
    currentLevelRef.current = nextLevel
    setCurrentLevel(nextLevel)
  }

  const changeCurrentLevel = (amount: number) => {
    const numberValue = Number(currentLevelRef.current || 0)
    const nextValue = Number.isFinite(numberValue) ? numberValue + amount : amount
    const formattedValue = Number.isInteger(nextValue)
      ? String(nextValue)
      : nextValue.toFixed(1)

    setSharedCurrentLevel(formattedValue)
  }

  const updateCurrentLevel = (value: string) => {
    if (isGaconProtocol && gaconTimerStatus !== 'READY') return
    setSharedCurrentLevel(value)
  }

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null

    const AudioContextClass =
      window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext
    if (!AudioContextClass) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }

    return audioContextRef.current
  }, [])

  const unlockAudio = useCallback(() => {
    const audioContext = getAudioContext()
    if (!audioContext) return

    void audioContext.resume().catch(() => undefined)
  }, [getAudioContext])

  const playTone = useCallback((frequency: number, durationMs: number, delayMs = 0) => {
    if (!soundEnabled) return
    const audioContext = getAudioContext()
    if (!audioContext) return

    const startTime = audioContext.currentTime + delayMs / 1000
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, startTime)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationMs / 1000)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + durationMs / 1000 + 0.03)
  }, [getAudioContext, soundEnabled])

  const playCountdownCue = useCallback(() => playTone(880, 90), [playTone])
  const playWorkCue = useCallback(() => {
    playTone(740, 130)
    playTone(980, 160, 180)
  }, [playTone])
  const playRestCue = useCallback(() => playTone(440, 260), [playTone])

  const testSound = () => {
    unlockAudio()
    playTone(660, 120)
    playTone(880, 140, 170)
  }

  const requestWakeLock = async () => {
    if (typeof navigator === 'undefined') return
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (!wakeLock || wakeLockRef.current) return

    try {
      wakeLockRef.current = await wakeLock.request('screen')
    } catch {
      wakeLockRef.current = null
    }
  }

  const releaseWakeLock = async () => {
    const wakeLock = wakeLockRef.current
    wakeLockRef.current = null
    if (!wakeLock || wakeLock.released) return

    try {
      await wakeLock.release()
    } catch {
      // Wake lock support is progressive enhancement only.
    }
  }

  const recordDropout = async (playerId: string) => {
    if (!isSessionLive || isSessionCompleted || pendingPlayerId) return
    if (
      isGaconProtocol &&
      !['WORK', 'REST', 'PAUSED'].includes(gaconTimerDisplayStatus)
    ) {
      return
    }

    setPendingPlayerId(playerId)
    setMessage(null)

    const formData = new FormData()
    const levelAtDropout = isGaconProtocol
      ? formatLevel(gaconCurrentLevel)
      : currentLevelRef.current
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('playerId', playerId)
    formData.set('resultValue', levelAtDropout)
    formData.set('resultText', levelAtDropout ? `Level ${levelAtDropout}` : '')

    const result = await saveDropoutAction(formData)

    if (result?.ok) {
      setDropoutPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === result.playerId
            ? {
                ...player,
                result: {
                  resultValue: result.resultValue,
                  resultText: result.resultText,
                },
              }
            : player
        )
      )
      setMessage('Dropout recorded.')
    } else {
      setMessage('Dropout could not be recorded. Try again.')
    }

    setPendingPlayerId(null)
  }

  const startFitnessTest = async () => {
    if (isSessionLive || isSessionCompleted || isStarting) return

    if (isGaconProtocol) {
      unlockAudio()
      setGaconTimerStatus('READY')
      setGaconProtocolStartedAtMs(null)
      setGaconPausedState(null)
    }

    setIsStarting(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('mode', 'liveDropout')

    const result = await startSessionAction(formData)

    if (result?.ok) {
      setLocalStartedAt(result.startedAt)
      if (isGaconProtocol) {
        const startingLevel = parsePositiveLevel(currentLevelRef.current)
        const protocolStartedAtMs = getCurrentTimeMs()
        setGaconStartingLevel(startingLevel)
        setSharedCurrentLevel(formatLevel(startingLevel))
        setNowMs(protocolStartedAtMs)
        setGaconProtocolStartedAtMs(protocolStartedAtMs)
        setGaconTimerStatus('COUNTDOWN')
        previousCueKeyRef.current = null
        countdownCueSecondRef.current = null
        playCountdownCue()
        setMessage('Gacon countdown started.')
      } else {
        setMessage('Fitness test started.')
      }
    } else {
      if (isGaconProtocol) {
        setGaconTimerStatus('READY')
        setGaconProtocolStartedAtMs(null)
        setGaconPausedState(null)
      }
      setMessage(result?.reason ?? 'Fitness test could not be started. Try again.')
    }

    setIsStarting(false)
  }

  const formattedStartedAt = effectiveStartedAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(effectiveStartedAt))
    : null

  const formattedCompletedAt = effectiveCompletedAt
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(effectiveCompletedAt))
    : null

  const endFitnessTest = async () => {
    if (!isSessionLive || isSessionCompleted || isEnding) return

    if (
      isGaconProtocol &&
      ['COUNTDOWN', 'WORK', 'REST', 'PAUSED'].includes(gaconTimerDisplayStatus) &&
      !window.confirm('End this active Gacon test and lock the results?')
    ) {
      return
    }

    setIsEnding(true)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)

    const result = await endSessionAction(formData)

    if (result?.ok) {
      setLocalCompletedAt(result.completedAt)
      if (isGaconProtocol) {
        setGaconTimerStatus('COMPLETE')
        setGaconProtocolStartedAtMs(null)
        setGaconPausedState(null)
        void releaseWakeLock()
      }
      setMessage('Fitness test completed. Results are now read-only.')
    } else {
      setMessage(result?.reason ?? 'Fitness test could not be completed. Try again.')
    }

    setIsEnding(false)
  }

  const pauseGaconTimer = () => {
    if (!isGaconProtocol || !gaconRunningState) return

    setGaconPausedState({
      phase: gaconRunningState.phase,
      level: gaconRunningState.level,
      remainingMs: gaconRunningState.remainingMs,
    })
    setGaconProtocolStartedAtMs(null)
    setGaconTimerStatus('PAUSED')
    void releaseWakeLock()
  }

  const resumeGaconTimer = () => {
    if (!isGaconProtocol || !gaconPausedState) return

    unlockAudio()
    const resumedAtMs = getCurrentTimeMs()
    setNowMs(resumedAtMs)
    setGaconProtocolStartedAtMs(
      getGaconProtocolStartFromPausedState(
        gaconPausedState,
        resumedAtMs,
        gaconStartingLevel
      )
    )
    setGaconTimerStatus(gaconPausedState.phase)
    previousCueKeyRef.current = null
    countdownCueSecondRef.current = null
    setGaconPausedState(null)
  }

  useEffect(() => {
    if (!isGaconProtocol || gaconRunningLevel === null) return
    const formattedLevel = formatLevel(gaconRunningLevel)
    currentLevelRef.current = formattedLevel
  }, [gaconRunningLevel, isGaconProtocol])

  useEffect(() => {
    if (!isGaconProtocol || gaconProtocolStartedAtMs === null || gaconTimerStatus === 'PAUSED') return

    const intervalId = window.setInterval(() => setNowMs(getCurrentTimeMs()), 250)
    return () => window.clearInterval(intervalId)
  }, [gaconProtocolStartedAtMs, gaconTimerStatus, isGaconProtocol])

  useEffect(() => {
    if (!isGaconProtocol || !gaconPhase || gaconRunningLevel === null) return

    const cueKey = `${gaconPhase}:${gaconRunningLevel}`
    if (previousCueKeyRef.current === cueKey) return
    previousCueKeyRef.current = cueKey

    if (gaconPhase === 'COUNTDOWN') {
      countdownCueSecondRef.current = null
      return
    }

    if (gaconPhase === 'REST') {
      playRestCue()
      return
    }

    playWorkCue()
  }, [gaconPhase, gaconRunningLevel, isGaconProtocol, playRestCue, playWorkCue])

  useEffect(() => {
    if (
      !isGaconProtocol ||
      gaconPhase !== 'COUNTDOWN' ||
      gaconRemainingMs === null
    ) {
      return
    }

    const countdownSecond = Math.max(1, Math.ceil(gaconRemainingMs / 1000))
    if (countdownCueSecondRef.current === countdownSecond) return
    countdownCueSecondRef.current = countdownSecond
    playCountdownCue()
  }, [gaconPhase, gaconRemainingMs, isGaconProtocol, playCountdownCue])

  useEffect(() => {
    if (!isGaconProtocol || gaconProtocolStartedAtMs === null || gaconTimerStatus === 'PAUSED') {
      void releaseWakeLock()
      return
    }

    void requestWakeLock()
    return () => {
      void releaseWakeLock()
    }
  }, [gaconProtocolStartedAtMs, gaconTimerStatus, isGaconProtocol])

  useEffect(() => {
    if (!isGaconProtocol) return

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      setNowMs(getCurrentTimeMs())
      if (gaconProtocolStartedAtMs !== null && gaconTimerStatus !== 'PAUSED') {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [gaconProtocolStartedAtMs, gaconTimerStatus, isGaconProtocol])

  useEffect(() => {
    if (!isSessionCompleted) return
    void releaseWakeLock()
  }, [isSessionCompleted])

  const undoDropout = async (playerId: string) => {
    if (!isSessionLive || isSessionCompleted || pendingPlayerId) return

    setPendingPlayerId(playerId)
    setMessage(null)

    const formData = new FormData()
    formData.set('fitnessTestSessionId', sessionId)
    formData.set('playerId', playerId)

    const result = await undoDropoutAction(formData)

    if (result?.ok) {
      setDropoutPlayers((currentPlayers) =>
        currentPlayers.map((player) =>
          player.id === result.playerId ? { ...player, result: null } : player
        )
      )
      setMessage('Player reinstated.')
    } else {
      setMessage('Player could not be reinstated. Try again.')
    }

    setPendingPlayerId(null)
  }

  const gaconPhaseDurationMs = gaconRunningState?.durationMs ??
    (gaconPausedState?.phase === 'REST'
      ? GACON_REST_MS
      : gaconPausedState?.phase === 'WORK'
        ? GACON_WORK_MS
        : GACON_COUNTDOWN_MS)
  const gaconPhaseRemainingMs =
    gaconRunningState?.remainingMs ?? gaconPausedState?.remainingMs ?? GACON_COUNTDOWN_MS
  const gaconCurrentTargetDistance = getGaconTargetDistance(gaconCurrentLevel)
  const gaconNextTargetDistance = getGaconTargetDistance(gaconCurrentLevel + 1)
  const canAdjustGaconStartingLevel = isGaconProtocol && gaconTimerDisplayStatus === 'READY'
  const canRecordLiveDropout =
    !isGaconProtocol || ['WORK', 'REST', 'PAUSED'].includes(gaconTimerDisplayStatus)
  const displayedDropoutLevel = isGaconProtocol ? formatLevel(gaconCurrentLevel) : currentLevel

  return (
    <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-6">
      {!isSessionCompleted && isGaconProtocol && (
        <section className="sticky top-16 z-20 rounded-xl border border-slate-300 bg-slate-950/95 p-3 text-white shadow-sm backdrop-blur sm:static sm:p-4 sm:shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {gaconTimerDisplayStatus === 'REST' ? (
                <>
                  <p className="text-sm font-black text-white">Level {formatLevel(gaconCurrentLevel)} complete</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-300">REST</p>
                  <p className="mt-1 truncate text-lg font-black text-white">
                    Next: Level {formatLevel(gaconCurrentLevel + 1)} · {formatGaconDistance(gaconNextTargetDistance)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Level</p>
                  <p className="text-3xl font-black tabular-nums text-white">
                    {formatLevel(gaconCurrentLevel)} · {formatGaconDistance(gaconCurrentTargetDistance)}
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {gaconTimerDisplayStatus === 'COUNTDOWN'
                      ? 'COUNTDOWN'
                      : gaconTimerDisplayStatus}
                  </p>
                </>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black tabular-nums text-white">
                {formatGaconPhaseTime(gaconPhaseRemainingMs)}
              </p>
              <p className="text-xs font-bold text-slate-300">
                / {formatGaconPhaseTime(gaconPhaseDurationMs)}
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-100">
            <span className="rounded-full bg-white/10 px-2.5 py-1">{activePlayers.length} active</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">{completedPlayers.length} out</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">45s work</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1">15s rest</span>
          </div>

          {gaconTimerDisplayStatus === 'READY' && (
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-300">
                Starting level
                <input
                  type="number"
                  step="any"
                  min={GACON_STARTING_LEVEL}
                  value={currentLevel}
                  onChange={(event) => updateCurrentLevel(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-white p-2.5 text-base font-bold text-slate-950 tabular-nums"
                  disabled={!canAdjustGaconStartingLevel}
                />
              </label>
              <button
                type="button"
                onClick={testSound}
                className="min-h-11 rounded-lg border border-white/30 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Test sound
              </button>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {!isSessionLive && (
              <button
                type="button"
                onClick={startFitnessTest}
                className="min-h-11 rounded-lg bg-green-500 px-4 py-2 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-32"
                disabled={isStarting}
              >
                {isStarting ? 'Starting...' : 'Start'}
              </button>
            )}

            {isSessionLive && gaconTimerDisplayStatus !== 'PAUSED' && (
              <button
                type="button"
                onClick={pauseGaconTimer}
                className="min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!gaconRunningState}
              >
                Pause
              </button>
            )}

            {isSessionLive && gaconTimerDisplayStatus === 'PAUSED' && (
              <button
                type="button"
                onClick={resumeGaconTimer}
                className="min-h-11 rounded-lg bg-green-500 px-4 py-2 text-sm font-black text-slate-950"
              >
                Resume
              </button>
            )}

            <button
              type="button"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              className="min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm font-black text-white"
            >
              Sound {soundEnabled ? 'on' : 'off'}
            </button>

            {isSessionLive && (
              <button
                type="button"
                onClick={endFitnessTest}
                className="col-span-2 min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
                disabled={isEnding}
              >
                {isEnding ? 'Ending...' : 'End test'}
              </button>
            )}
          </div>
        </section>
      )}

      {!isSessionCompleted && !isGaconProtocol && (
        <section className="sticky top-16 z-20 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur sm:static sm:p-4 sm:shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Current level</p>
              <p className="text-3xl font-black tabular-nums text-slate-950">{currentLevel || '-'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => changeCurrentLevel(-1)}
                className="min-h-11 rounded-lg border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!isSessionLive}
                aria-label="Previous level"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => changeCurrentLevel(1)}
                className="min-h-11 rounded-lg border px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!isSessionLive}
                aria-label="Next level"
              >
                +
              </button>
            </div>
          </div>
          {isSessionLive ? (
            <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800">
              LIVE{formattedStartedAt ? `: started ${formattedStartedAt}` : ''}
            </p>
          ) : (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              Start the fitness test before changing levels or recording dropouts.
            </p>
          )}

          {!isSessionLive && (
            <button
              type="button"
              onClick={startFitnessTest}
              className="mt-3 w-full rounded-lg bg-green-700 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isStarting}
            >
              {isStarting ? 'Starting...' : 'Start'}
            </button>
          )}

          {isSessionLive && (
            <button
              type="button"
              onClick={endFitnessTest}
              className="mt-3 w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isEnding}
          >
              {isEnding ? 'Ending...' : 'Finish test'}
            </button>
          )}

          <div className="mt-3">
            <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Set level manually
              <input
                type="number"
                step="any"
                value={currentLevel}
                onChange={(event) => updateCurrentLevel(event.target.value)}
                className="mt-1 w-full rounded-lg border p-2.5 text-base font-bold tabular-nums"
                placeholder="Level"
                disabled={!isSessionLive}
              />
            </label>
          </div>
        </section>
      )}

      {!isSessionCompleted && message && (
        <p className="min-h-10 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
          {message}
        </p>
      )}

      {!isSessionCompleted && isSessionLive && allPlayersFinished && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
          All active players have dropout results. Finish test to complete and lock this session.
        </p>
      )}

      {isSessionCompleted && (
        <FitnessTestCompleteSummary
          title="Test Complete"
          description="This session is closed. Results are read-only."
          testTypeName={testTypeName}
          teamName={teamName}
          dateLabel={dateLabel}
          sessionStatusLabel={isSessionCompleted ? 'Completed' : sessionStatusLabel}
          startedAtLabel={formattedStartedAt ?? 'Not started'}
          completedAtLabel={formattedCompletedAt ?? 'Not completed'}
          resultCount={completedPlayers.length}
          players={dropoutPlayers}
          resultUnit={resultUnit}
          higherIsBetter={higherIsBetter}
          targetScores={targetScores}
          statusLabel="Dropped out"
          rankingsHref={rankingsHref}
          progressHref={progressHref}
        />
      )}

      {!isSessionCompleted && (
        <section className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-green-200 bg-white">
            <div className="flex items-center justify-between bg-green-50 px-3 py-2">
              <h2 className="text-sm font-black uppercase tracking-wide text-green-900">Active players</h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-green-900">{activePlayers.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {activePlayers.length === 0 ? (
                <p className="px-3 py-3 text-sm font-semibold text-slate-600">No active players remaining.</p>
              ) : activePlayers.map((player) => (
                <div key={player.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-base font-black text-slate-950">{formatPlayerName(player)}</p>
                  <button
                    type="button"
                    onClick={() => recordDropout(player.id)}
                    className="min-h-11 shrink-0 rounded-lg bg-green-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSessionCompleted ||
                      !isSessionLive ||
                      !canRecordLiveDropout ||
                      pendingPlayerId === player.id
                    }
                    aria-label={`Record dropout for ${formatPlayerName(player)} at level ${displayedDropoutLevel || 'current level'}`}
                  >
                    {pendingPlayerId === player.id ? 'Saving...' : 'Out'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-slate-50">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-3 text-sm font-black text-slate-900">
              <span>Out</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs">{completedPlayers.length}</span>
            </summary>
            <div className="divide-y divide-slate-200 border-t border-slate-200 bg-white">
              {completedPlayers.length === 0 ? (
                <p className="px-3 py-3 text-sm font-semibold text-slate-600">No players out yet.</p>
              ) : completedPlayers.map((player) => (
                <div key={player.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">{formatPlayerName(player)}</p>
                    <p className="text-xs font-semibold text-slate-500">{formatResult(player.result)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => undoDropout(player.id)}
                    className="min-h-11 shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSessionCompleted || !isSessionLive || pendingPlayerId === player.id}
                    aria-label={`Undo dropout for ${formatPlayerName(player)}`}
                  >
                    {pendingPlayerId === player.id ? 'Saving...' : 'Undo'}
                  </button>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
