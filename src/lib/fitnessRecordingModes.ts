type FitnessTestTypeLike = {
  name: string
}

export type FitnessRecordingModes = {
  manualEntry: boolean
  liveDropout: boolean
  liveTimedFinish: boolean
  label: string
}

const normalizeTestName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function getFitnessRecordingModes(
  fitnessTestType: FitnessTestTypeLike
): FitnessRecordingModes {
  const name = normalizeTestName(fitnessTestType.name)

  if (['bleep test', 'gacon test', 'yo yo test'].includes(name)) {
    return {
      manualEntry: false,
      liveDropout: true,
      liveTimedFinish: false,
      label: 'Live Dropout Mode',
    }
  }

  if (name === 'bronco test' || name === '12 minute run') {
    return {
      manualEntry: false,
      liveDropout: false,
      liveTimedFinish: true,
      label: 'Live Timed Finish Mode',
    }
  }

  if (
    name.includes('sprint') ||
    name.includes('agility') ||
    name.includes('speed') ||
    name.includes('shuttle')
  ) {
    return {
      manualEntry: true,
      liveDropout: false,
      liveTimedFinish: false,
      label: 'Manual Entry',
    }
  }

  return {
    manualEntry: true,
    liveDropout: false,
    liveTimedFinish: false,
    label: 'Manual Entry',
  }
}
