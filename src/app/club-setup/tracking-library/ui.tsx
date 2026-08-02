import Link from 'next/link'
import type { ClubTrackingDefinitionKind, ClubTrackingDefinitionStatus, ClubTrackingMappingStatus } from '@prisma/client'

import Button from '@/components/ui/Button'

export type TrackingLibraryActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string; warnings?: string[] }
  | { ok: false; reason: string; fieldErrors?: Record<string, string>; warnings?: string[] }

export const proposalOptions = [
  { value: 'EVENT', label: 'One observable event' },
  { value: 'PATTERN', label: 'A tactical pattern or sequence' },
] as const

export const scopeOptions = [
  { value: '', label: 'Not specified' },
  { value: 'PLAYER', label: 'Player' },
  { value: 'UNIT', label: 'Unit' },
  { value: 'TEAM', label: 'Team' },
] as const

export const targetOptions = [
  { value: '', label: 'Not specified' },
  { value: 'GOALKEEPER', label: 'Goalkeeper' },
  { value: 'DEFENSIVE_UNIT', label: 'Defensive unit' },
  { value: 'MIDFIELD_UNIT', label: 'Midfield unit' },
  { value: 'ATTACKING_UNIT', label: 'Attacking unit' },
  { value: 'WING_BACK', label: 'Wing back' },
  { value: 'DEFENSIVE_MIDFIELDER', label: 'Defensive midfielder' },
  { value: 'ATTACKING_MIDFIELDER', label: 'Attacking midfielder' },
  { value: 'FULL_BACK', label: 'Full back' },
  { value: 'CENTRE_BACK', label: 'Centre back' },
  { value: 'CENTRAL_MIDFIELDER', label: 'Central midfielder' },
  { value: 'WIDE_PLAYER', label: 'Wide player' },
  { value: 'CENTRE_FORWARD', label: 'Centre forward' },
  { value: 'GENERAL_OUTFIELD_PLAYER', label: 'General outfield player' },
  { value: 'GOALKEEPER_UNIT', label: 'Goalkeeper unit' },
  { value: 'LEFT_SIDE_UNIT', label: 'Left side unit' },
  { value: 'RIGHT_SIDE_UNIT', label: 'Right side unit' },
  { value: 'BUILD_UP_UNIT', label: 'Build-up unit' },
  { value: 'PRESSING_UNIT', label: 'Pressing unit' },
  { value: 'CUSTOM_UNIT', label: 'Custom unit' },
  { value: 'WHOLE_TEAM', label: 'Whole team' },
] as const

export const phaseOptions = [
  { value: '', label: 'Not specified' },
  { value: 'IN_POSSESSION', label: 'In possession' },
  { value: 'OUT_OF_POSSESSION', label: 'Out of possession' },
  { value: 'ATTACKING_TRANSITION', label: 'Attacking transition' },
  { value: 'DEFENSIVE_TRANSITION', label: 'Defensive transition' },
  { value: 'ATTACKING_SET_PIECES', label: 'Attacking set pieces' },
  { value: 'DEFENSIVE_SET_PIECES', label: 'Defensive set pieces' },
  { value: 'GOALKEEPING', label: 'Goalkeeping' },
] as const

export const focusOptions = [
  { value: '', label: 'Not specified' },
  { value: 'BUILD_UP', label: 'Build up' },
  { value: 'PLAYING_OUT', label: 'Playing out' },
  { value: 'RECEIVING', label: 'Receiving' },
  { value: 'PASSING', label: 'Passing' },
  { value: 'CARRYING', label: 'Carrying' },
  { value: 'MOVEMENT', label: 'Movement' },
  { value: 'PROGRESSION', label: 'Progression' },
  { value: 'CREATING_CHANCES', label: 'Creating chances' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'PRESSING', label: 'Pressing' },
  { value: 'DEFENDING', label: 'Defending' },
  { value: 'AERIAL_PLAY', label: 'Aerial play' },
  { value: 'BALL_RETENTION', label: 'Ball retention' },
  { value: 'SHAPE_AND_COMPACTNESS', label: 'Shape and compactness' },
  { value: 'COVER_AND_BALANCE', label: 'Cover and balance' },
  { value: 'PROTECTING_SPACE_BEHIND', label: 'Protecting space behind' },
  { value: 'DEFENDING_WIDE_AREAS', label: 'Defending wide areas' },
  { value: 'DEFENDING_CROSSES', label: 'Defending crosses' },
  { value: 'COMBINATION_PLAY', label: 'Combination play' },
  { value: 'SUPPORTING_THE_BALL', label: 'Supporting the ball' },
  { value: 'POSSESSION', label: 'Possession' },
  { value: 'TERRITORY', label: 'Territory' },
  { value: 'ATTACKING_TRANSITION', label: 'Attacking transition' },
  { value: 'DEFENSIVE_TRANSITION', label: 'Defensive transition' },
  { value: 'SET_PIECES', label: 'Set pieces' },
  { value: 'REST_DEFENCE', label: 'Rest defence' },
  { value: 'GOALKEEPER_DISTRIBUTION', label: 'Goalkeeper distribution' },
  { value: 'LINK_PLAY', label: 'Link play' },
] as const

export const ageOptions = [
  { value: 'FOUNDATION', label: 'Foundation U6-U11' },
  { value: 'YOUTH', label: 'Youth U12-U18' },
  { value: 'ADULT', label: 'Adult / Open Age' },
] as const

export function formatKind(kind: ClubTrackingDefinitionKind) {
  const labels: Record<ClubTrackingDefinitionKind, string> = {
    EVENT_ALIAS: 'Club alias',
    EVENT_MAPPED: 'Club mapped event',
    EVENT_CUSTOM: 'Club-specific event',
    PATTERN_ALIAS: 'Club pattern alias',
    PATTERN_MAPPED: 'Club mapped pattern',
  }
  return labels[kind]
}

export function formatStatus(status: ClubTrackingDefinitionStatus) {
  const labels: Record<ClubTrackingDefinitionStatus, string> = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending review',
    APPROVED: 'Approved for club use',
    REJECTED: 'Rejected',
    RETIRED: 'Retired',
  }
  return labels[status]
}

export function formatMappingStatus(status: ClubTrackingMappingStatus) {
  const labels: Record<ClubTrackingMappingStatus, string> = {
    NONE: 'No standard mapping',
    PROPOSED: 'Proposed',
    CLUB_APPROVED: 'Awaiting standard review',
    STANDARD_APPROVED: 'Standard approved',
    REJECTED: 'Mapping rejected',
  }
  return labels[status]
}

export function isPatternKind(kind: ClubTrackingDefinitionKind) {
  return kind === 'PATTERN_ALIAS' || kind === 'PATTERN_MAPPED'
}

export function isAliasKind(kind: ClubTrackingDefinitionKind) {
  return kind === 'EVENT_ALIAS' || kind === 'PATTERN_ALIAS'
}

export function standardName(definition: { mappedEventDefinition?: { name: string } | null; mappedPatternDefinition?: { name: string } | null }) {
  return definition.mappedEventDefinition?.name ?? definition.mappedPatternDefinition?.name ?? null
}

export function displayDate(value: Date | string | null | undefined) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
}

export function StatusPill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' }) {
  const classes = {
    slate: 'bg-slate-100 text-slate-800',
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-800',
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${classes[tone]}`}>{children}</span>
}

export function BackToLibrary({ clubId }: { clubId?: string }) {
  const href = clubId ? `/club-setup/tracking-library?clubId=${clubId}` : '/club-setup/tracking-library'
  return <Link href={href} className="text-sm font-semibold text-blue-800 hover:underline">Back to Tracking Library</Link>
}

export function SubmitButton({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' }) {
  return <Button type="submit" variant={variant === 'primary' ? 'primary' : 'secondary'}>{children}</Button>
}
