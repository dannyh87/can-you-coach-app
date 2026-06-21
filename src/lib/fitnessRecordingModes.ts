type FitnessTestTypeLike = {
  allowedRecordingModes?: string | null
  preferredRecordingMode?: string | null
}

export type FitnessRecordingMode =
  | 'MANUAL'
  | 'LIVE_DROPOUT'
  | 'LIVE_TIMED_FINISH'

export type FitnessRecordingModes = {
  manualEntry: boolean
  liveDropout: boolean
  liveTimedFinish: boolean
  allowedModes: FitnessRecordingMode[]
  preferredMode: FitnessRecordingMode
  label: string
}

export const fitnessRecordingModeOptions: {
  value: FitnessRecordingMode
  label: string
}[] = [
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'LIVE_DROPOUT', label: 'Live Dropout Mode' },
  { value: 'LIVE_TIMED_FINISH', label: 'Live Timed Finish Mode' },
]

const validRecordingModes = new Set<FitnessRecordingMode>([
  'MANUAL',
  'LIVE_DROPOUT',
  'LIVE_TIMED_FINISH',
])

export function isFitnessRecordingMode(value: string): value is FitnessRecordingMode {
  return validRecordingModes.has(value as FitnessRecordingMode)
}

const recordingModeLabels = Object.fromEntries(
  fitnessRecordingModeOptions.map((option) => [option.value, option.label])
) as Record<FitnessRecordingMode, string>

export function formatFitnessRecordingMode(mode: FitnessRecordingMode) {
  return recordingModeLabels[mode]
}

export function parseAllowedRecordingModes(
  value: string | null | undefined
): FitnessRecordingMode[] {
  const modes = (value ?? '')
    .split(',')
    .map((mode) => mode.trim())
    .filter(isFitnessRecordingMode)

  return modes.length > 0 ? Array.from(new Set(modes)) : ['MANUAL']
}

export function parsePreferredRecordingMode(
  value: string | null | undefined,
  allowedModes: FitnessRecordingMode[]
): FitnessRecordingMode {
  return allowedModes.includes(value as FitnessRecordingMode)
    ? (value as FitnessRecordingMode)
    : allowedModes[0]
}

export function serializeAllowedRecordingModes(modes: FitnessRecordingMode[]) {
  return modes.filter((mode, index) => modes.indexOf(mode) === index).join(',')
}

export function canUseManualEntry(fitnessTestType: FitnessTestTypeLike) {
  return parseAllowedRecordingModes(fitnessTestType.allowedRecordingModes).includes('MANUAL')
}

export function canUseLiveDropout(fitnessTestType: FitnessTestTypeLike) {
  return parseAllowedRecordingModes(fitnessTestType.allowedRecordingModes).includes('LIVE_DROPOUT')
}

export function canUseLiveTimedFinish(fitnessTestType: FitnessTestTypeLike) {
  return parseAllowedRecordingModes(fitnessTestType.allowedRecordingModes).includes(
    'LIVE_TIMED_FINISH'
  )
}

export function getFitnessRecordingModes(
  fitnessTestType: FitnessTestTypeLike
): FitnessRecordingModes {
  const allowedModes = parseAllowedRecordingModes(
    fitnessTestType.allowedRecordingModes
  )
  const preferredMode = parsePreferredRecordingMode(
    fitnessTestType.preferredRecordingMode,
    allowedModes
  )
  const sortedModes = [
    preferredMode,
    ...allowedModes.filter((mode) => mode !== preferredMode),
  ]

  return {
    manualEntry: allowedModes.includes('MANUAL'),
    liveDropout: allowedModes.includes('LIVE_DROPOUT'),
    liveTimedFinish: allowedModes.includes('LIVE_TIMED_FINISH'),
    allowedModes,
    preferredMode,
    label: sortedModes.map((mode) => recordingModeLabels[mode]).join(', '),
  }
}
