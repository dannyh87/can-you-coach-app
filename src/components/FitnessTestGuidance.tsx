type FitnessTestGuidanceData = {
  setupInstructions?: string | null
  equipmentNeeded?: string | null
  scoringNotes?: string | null
  spaceRequired?: string | null
  coachNotes?: string | null
  videoUrl?: string | null
  targetScores?: string | null
}

type FitnessTestGuidanceProps = {
  guidance: FitnessTestGuidanceData
  title?: string
  description?: string
  compact?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
  showSetup?: boolean
  showTargets?: boolean
  className?: string
}

const hasText = (value: string | null | undefined) => Boolean(value?.trim())

export function hasFitnessTestGuidance(guidance: FitnessTestGuidanceData) {
  return Boolean(
    hasText(guidance.setupInstructions) ||
      hasText(guidance.equipmentNeeded) ||
      hasText(guidance.spaceRequired) ||
      hasText(guidance.scoringNotes) ||
      hasText(guidance.coachNotes) ||
      hasText(guidance.videoUrl) ||
      hasText(guidance.targetScores)
  )
}

export function hasFitnessTargetGuidance(guidance: FitnessTestGuidanceData) {
  return hasText(guidance.targetScores)
}

export default function FitnessTestGuidance({
  guidance,
  title = 'Test setup',
  description,
  compact = false,
  collapsible = false,
  defaultOpen = false,
  showSetup = true,
  showTargets = true,
  className = '',
}: FitnessTestGuidanceProps) {
  const sections = [
    showSetup && hasText(guidance.spaceRequired)
      ? { label: 'Space required', value: guidance.spaceRequired }
      : null,
    showSetup && hasText(guidance.equipmentNeeded)
      ? { label: 'Equipment needed', value: guidance.equipmentNeeded }
      : null,
    showSetup && hasText(guidance.setupInstructions)
      ? { label: 'How to set it up', value: guidance.setupInstructions }
      : null,
    showSetup && hasText(guidance.scoringNotes)
      ? { label: 'Scoring notes', value: guidance.scoringNotes }
      : null,
    showTargets && hasText(guidance.targetScores)
      ? { label: 'Target guidance', value: guidance.targetScores }
      : null,
    showSetup && hasText(guidance.coachNotes)
      ? { label: 'Coach notes', value: guidance.coachNotes }
      : null,
  ].filter((section): section is { label: string; value: string } => Boolean(section))
  const videoUrl = showSetup && hasText(guidance.videoUrl) ? guidance.videoUrl?.trim() : null

  if (sections.length === 0 && !videoUrl) return null

  const body = (
    <div className={compact ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}>
      {description && <p className="text-sm leading-6 text-slate-600">{description}</p>}
      <div className={compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
        {sections.map((section) => (
          <div key={section.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-bold text-slate-900">{section.label}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
              {section.value}
            </p>
          </div>
        ))}
      </div>
      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Watch setup video
        </a>
      )}
    </div>
  )

  const wrapperClassName = `${compact ? 'rounded-xl' : 'rounded-2xl'} border border-blue-100 bg-blue-50/70 p-4 ${className}`

  if (collapsible) {
    return (
      <details className={wrapperClassName} open={defaultOpen}>
        <summary className="cursor-pointer text-sm font-bold text-blue-950">
          {title}
        </summary>
        {body}
      </details>
    )
  }

  return (
    <section className={wrapperClassName}>
      <h2 className={compact ? 'text-base font-bold text-blue-950' : 'text-lg font-bold text-blue-950'}>
        {title}
      </h2>
      {body}
    </section>
  )
}
