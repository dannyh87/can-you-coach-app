import { createHash } from 'crypto'
import type {
  ClubTrackingDefinitionKind,
  ClubTrackingDefinitionStatus,
  ClubTrackingMappingStatus,
  ClubTrackingStandardMappingRejectionCategory,
  ClubRole,
  EventDefinitionAgePhase,
  MatchTrackingScope,
  Prisma,
  TrackingFocusArea,
  TrackingTargetContext,
  TrackingTopicPhase,
} from '@prisma/client'

import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import { canManageMatchDay } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Db = typeof prisma | Prisma.TransactionClient
type Result<T = true> = { ok: true; value: T } | { ok: false; reason: string; fieldErrors?: Record<string, string[]> }
type StructuredResult<T = true> = { ok: true; value: T } | { ok: false; reason: string; code?: string; fieldErrors?: Record<string, string[]> }

export type ClubTrackingDefinitionInput = {
  clubId: string
  kind: ClubTrackingDefinitionKind
  name: string
  description?: string | null
  guidance?: string | null
  scopeType?: MatchTrackingScope | null
  targetContext?: TrackingTargetContext | null
  phase?: TrackingTopicPhase | null
  focusArea?: TrackingFocusArea | null
  agePhases?: EventDefinitionAgePhase[]
  requiresLocation?: boolean
  mappedEventDefinitionId?: string | null
  mappedPatternDefinitionId?: string | null
  mappingStatus?: ClubTrackingMappingStatus
  searchToken: string
  nearDuplicateAcknowledged?: boolean
  proposalType: 'EVENT' | 'PATTERN'
  patternConfigurationProvided?: boolean
  createAsDraft?: boolean
}

export type TrackingLibraryRole = Extract<ClubRole, 'OWNER' | 'COACH' | 'ASSISTANT_COACH'>

export type ClubTrackingReportingIdentity = {
  identityType: 'STANDARD' | 'CLUB_ALIAS' | 'CLUB_MAPPED' | 'CLUB_SPECIFIC'
  clubTrackingDefinitionId?: string
  standardEventDefinitionId?: string
  standardPatternDefinitionId?: string
  mappingStatus?: ClubTrackingMappingStatus
  mappingRevision?: number
  contributesToStandardReporting: boolean
  contributesToClubReporting: boolean
  benchmarkEligible: boolean
}

export type SelectedClubTrackingDefinitionInput = {
  clubTrackingDefinitionId: string
  expectedKind: ClubTrackingDefinitionKind
  expectedMappingRevision: number
  expectedMappingStatus: ClubTrackingMappingStatus
}

export type ClubTrackingSelectionSnapshot = {
  clubTrackingDefinitionId: string
  selectedKind: ClubTrackingDefinitionKind
  mappingRevisionAtSelection: number
  mappingStatusAtSelection: ClubTrackingMappingStatus
  standardEventDefinitionIdAtSelection: string | null
  standardPatternDefinitionIdAtSelection: string | null
  displayName: string
  requiresLocation: boolean
  contributesToStandardReporting: boolean
  benchmarkEligible: boolean
}

export type MatchTrackingSelectableItem =
  | { source: 'STANDARD_EVENT'; eventDefinitionId: string; displayName: string; requiresLocation: boolean; scopeCompatibility: MatchTrackingScope[] }
  | { source: 'STANDARD_PATTERN'; patternId: string; displayName: string; requiresLocation: boolean; scopeCompatibility: MatchTrackingScope[] }
  | (ClubTrackingSelectionSnapshot & { source: 'CLUB_DEFINITION'; kind: ClubTrackingDefinitionKind; identityType: 'Club alias' | 'Club mapped' | 'Club specific'; mappedStandardEventDefinitionId?: string; mappedStandardPatternDefinitionId?: string; mappingStatus: ClubTrackingMappingStatus; mappingRevision: number; scopeCompatibility: MatchTrackingScope[] })

const mappingKinds = new Set<ClubTrackingDefinitionKind>(['EVENT_ALIAS', 'EVENT_MAPPED', 'PATTERN_ALIAS', 'PATTERN_MAPPED'])
const reviewableMappingKinds = new Set<ClubTrackingDefinitionKind>(['EVENT_MAPPED', 'PATTERN_MAPPED'])
const eventKinds = new Set<ClubTrackingDefinitionKind>(['EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM'])
const patternKinds = new Set<ClubTrackingDefinitionKind>(['PATTERN_ALIAS', 'PATTERN_MAPPED'])
const selectableKinds = new Set<ClubTrackingDefinitionKind>(['EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM', 'PATTERN_ALIAS', 'PATTERN_MAPPED'])
const locallySelectableRejectionCategories = new Set<ClubTrackingStandardMappingRejectionCategory>(['NOT_EQUIVALENT', 'BETTER_STANDARD_EXISTS', 'BENCHMARK_INCOMPATIBLE', 'DUPLICATE_MAPPING', 'OTHER'])
const locallyBlockedRejectionCategories = new Set<ClubTrackingStandardMappingRejectionCategory>(['EVENT_PATTERN_MISMATCH', 'SCOPE_CONTEXT_MISMATCH', 'OUTCOME_MISMATCH', 'NEEDS_CLARIFICATION'])
const semanticFields = ['kind', 'scopeType', 'targetContext', 'phase', 'focusArea', 'requiresLocation', 'mappedEventDefinitionId', 'mappedPatternDefinitionId'] as const
const reviewableStandardMappingStatuses = new Set<ClubTrackingMappingStatus>(['CLUB_APPROVED'])

export function normalizeClubTrackingDefinitionName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\b(one)\s+v\s+(one)\b/g, '1v1')
    .split(/\s+/)
    .map((part) => part.trim().replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .map((part) => (part.length > 3 && part.endsWith('s') ? part.slice(0, -1) : part))
    .sort()
    .join(' ')
}

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tracking-definition'
const normalizeOptionalText = (value: string | null | undefined) => value?.trim() ? value.trim() : null
const unique = <T,>(values: T[]) => Array.from(new Set(values))
const isPresent = <T,>(value: T | null | false): value is T => Boolean(value)
const searchTokenFor = ({ clubId, query }: { clubId: string; query: string }) => createHash('sha256').update(`${clubId}:${normalizeClubTrackingDefinitionName(query)}`).digest('hex').slice(0, 24)

export function getClubDefinitionLocalSelectionEligibility(definition: { kind: ClubTrackingDefinitionKind; status: ClubTrackingDefinitionStatus; active: boolean; retiredAt: Date | null; mappingStatus: ClubTrackingMappingStatus; standardMappingRejectionCategory?: ClubTrackingStandardMappingRejectionCategory | null }) {
  if (!selectableKinds.has(definition.kind)) return { selectable: false, reason: 'This definition kind is not supported in Match Day setup.' }
  if (definition.status !== 'APPROVED') return { selectable: false, reason: 'Only approved club tracking definitions can be selected.' }
  if (!definition.active || definition.retiredAt) return { selectable: false, reason: 'Retired or inactive club tracking definitions cannot be selected.' }
  if (definition.kind === 'EVENT_CUSTOM') return { selectable: true, reason: null }
  if (definition.kind === 'EVENT_ALIAS' || definition.kind === 'PATTERN_ALIAS') return { selectable: true, reason: null }
  if (['PROPOSED', 'CLUB_APPROVED', 'STANDARD_APPROVED'].includes(definition.mappingStatus)) return { selectable: true, reason: null }
  if (definition.mappingStatus === 'REJECTED') {
    const category = definition.standardMappingRejectionCategory ?? null
    if (category && locallySelectableRejectionCategories.has(category)) return { selectable: true, reason: null }
    if (category && locallyBlockedRejectionCategories.has(category)) return { selectable: false, reason: 'This rejected standard mapping must be corrected before new Match Day selection.' }
    return { selectable: false, reason: 'This rejected standard mapping is not available for new Match Day selection.' }
  }
  return { selectable: false, reason: 'This club tracking definition is not locally selectable.' }
}

function getDefinitionScopeCompatibility(definition: { scopeType: MatchTrackingScope | null }) {
  return definition.scopeType ? [definition.scopeType] : (['PLAYER', 'UNIT', 'TEAM'] as MatchTrackingScope[])
}

export function clubDefinitionMatchesTrackingContext(definition: { scopeType: MatchTrackingScope | null; targetContext: TrackingTargetContext | null; phase: TrackingTopicPhase | null; focusArea: TrackingFocusArea | null }, context: { scope?: MatchTrackingScope | null; targetContext?: TrackingTargetContext | null; phase?: TrackingTopicPhase | null; focusArea?: TrackingFocusArea | null }) {
  if (definition.scopeType && context.scope && definition.scopeType !== context.scope) return false
  if (definition.targetContext && context.targetContext && definition.targetContext !== context.targetContext) return false
  if (definition.phase && context.phase && definition.phase !== context.phase) return false
  if (definition.focusArea && context.focusArea && definition.focusArea !== context.focusArea) return false
  return true
}

function formatClubIdentityType(kind: ClubTrackingDefinitionKind): 'Club alias' | 'Club mapped' | 'Club specific' {
  if (kind === 'EVENT_ALIAS' || kind === 'PATTERN_ALIAS') return 'Club alias'
  if (kind === 'EVENT_MAPPED' || kind === 'PATTERN_MAPPED') return 'Club mapped'
  return 'Club specific'
}

function buildClubSelectionSnapshot(definition: { id: string; kind: ClubTrackingDefinitionKind; name: string; requiresLocation: boolean; mappingStatus: ClubTrackingMappingStatus; mappingRevision: number; mappedEventDefinitionId: string | null; mappedPatternDefinitionId: string | null; mappedEventDefinition?: { benchmarkable: boolean } | null }): ClubTrackingSelectionSnapshot {
  const isAlias = definition.kind === 'EVENT_ALIAS' || definition.kind === 'PATTERN_ALIAS'
  const isMapped = definition.kind === 'EVENT_MAPPED' || definition.kind === 'PATTERN_MAPPED'
  const standardApproved = definition.mappingStatus === 'STANDARD_APPROVED'
  const contributesToStandardReporting = isAlias || (isMapped && standardApproved)
  return { clubTrackingDefinitionId: definition.id, selectedKind: definition.kind, mappingRevisionAtSelection: definition.mappingRevision, mappingStatusAtSelection: definition.mappingStatus, standardEventDefinitionIdAtSelection: definition.mappedEventDefinitionId, standardPatternDefinitionIdAtSelection: definition.mappedPatternDefinitionId, displayName: definition.name, requiresLocation: definition.requiresLocation, contributesToStandardReporting, benchmarkEligible: contributesToStandardReporting && Boolean(definition.mappedEventDefinition?.benchmarkable) }
}

async function getMatchClubForSelection(db: Db, actorUserId: string, matchDayId: string) {
  if (db === prisma && !(await canManageMatchDay(actorUserId, matchDayId))) return null
  return db.matchDay.findUnique({ where: { id: matchDayId }, select: { id: true, team: { select: { clubId: true } } } })
}

async function getMembership(userId: string, clubId: string, db: Db) {
  return db.clubMembership.findUnique({ where: { userId_clubId: { userId, clubId } }, include: { teamAssignments: true } })
}

async function canCreateDraft(userId: string, clubId: string, db: Db) {
  const membership = await getMembership(userId, clubId, db)
  return membership?.role === 'OWNER' || membership?.role === 'COACH'
}

async function canManageClubDefinitions(userId: string, clubId: string, db: Db) {
  const membership = await getMembership(userId, clubId, db)
  return membership?.role === 'OWNER'
}

async function canViewClubDefinitions(userId: string, clubId: string, db: Db) {
  return Boolean(await getMembership(userId, clubId, db))
}

export async function getSelectableClubTrackingDefinitionsForMatch({ db = prisma, actorUserId, matchDayId, context = {}, topicId, recommendedOnly = false }: { db?: Db; actorUserId: string; matchDayId: string; context?: { scope?: MatchTrackingScope | null; targetContext?: TrackingTargetContext | null; phase?: TrackingTopicPhase | null; focusArea?: TrackingFocusArea | null }; topicId?: string | null; recommendedOnly?: boolean }): Promise<StructuredResult<MatchTrackingSelectableItem[]>> {
  const match = await getMatchClubForSelection(db, actorUserId, matchDayId)
  if (!match) return { ok: false, reason: 'You cannot manage this Match Day setup.' }
  const definitions = await db.clubTrackingDefinition.findMany({ where: { clubId: match.team.clubId, kind: { in: Array.from(selectableKinds) }, status: 'APPROVED', active: true, retiredAt: null, ...(topicId ? { topicLinks: { some: { topicId, ...(recommendedOnly ? { recommended: true } : {}) } } } : {}) }, include: { mappedEventDefinition: true, mappedPatternDefinition: true, topicLinks: topicId ? { where: { topicId } } : true }, orderBy: [{ kind: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }] })
  const items = definitions.flatMap((definition): MatchTrackingSelectableItem[] => {
    const eligibility = getClubDefinitionLocalSelectionEligibility(definition)
    if (!eligibility.selectable || !clubDefinitionMatchesTrackingContext(definition, context)) return []
    const snapshot = buildClubSelectionSnapshot(definition)
    return [{ ...snapshot, source: 'CLUB_DEFINITION', kind: definition.kind, identityType: formatClubIdentityType(definition.kind), mappedStandardEventDefinitionId: definition.mappedEventDefinitionId ?? undefined, mappedStandardPatternDefinitionId: definition.mappedPatternDefinitionId ?? undefined, mappingStatus: definition.mappingStatus, mappingRevision: definition.mappingRevision, scopeCompatibility: getDefinitionScopeCompatibility(definition) }]
  })
  return { ok: true, value: items }
}

export async function getValidatedClubTrackingSelectionSnapshots({ db = prisma, actorUserId, matchDayId, selections, context = {} }: { db?: Db; actorUserId: string; matchDayId: string; selections: SelectedClubTrackingDefinitionInput[]; context?: { scope?: MatchTrackingScope | null; targetContext?: TrackingTargetContext | null; phase?: TrackingTopicPhase | null; focusArea?: TrackingFocusArea | null } }): Promise<StructuredResult<ClubTrackingSelectionSnapshot[]>> {
  const match = await getMatchClubForSelection(db, actorUserId, matchDayId)
  if (!match) return { ok: false, reason: 'You cannot manage this Match Day setup.' }
  const requested = selections.filter((selection) => selection.clubTrackingDefinitionId)
  const ids = unique(requested.map((selection) => selection.clubTrackingDefinitionId))
  if (ids.length !== requested.length) return { ok: false, reason: 'Duplicate club tracking definitions are not allowed.', fieldErrors: { clubTrackingDefinitionIds: ids } }
  if (ids.length === 0) return { ok: true, value: [] }
  const definitions = await db.clubTrackingDefinition.findMany({ where: { id: { in: ids }, clubId: match.team.clubId }, include: { mappedEventDefinition: true, mappedPatternDefinition: true } })
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const errors: string[] = []
  const snapshots: ClubTrackingSelectionSnapshot[] = []
  for (const selection of requested) {
    const definition = byId.get(selection.clubTrackingDefinitionId)
    if (!definition) { errors.push(`${selection.clubTrackingDefinitionId}: definition is not available for this club.`); continue }
    const eligibility = getClubDefinitionLocalSelectionEligibility(definition)
    if (!eligibility.selectable) { errors.push(`${definition.name}: ${eligibility.reason}`); continue }
    if (definition.kind !== selection.expectedKind) { errors.push(`${definition.name}: selection kind is stale.`); continue }
    if (definition.mappingRevision !== selection.expectedMappingRevision || definition.mappingStatus !== selection.expectedMappingStatus) { errors.push(`${definition.name}: selection mapping status changed. Refresh and select again.`); continue }
    if (!clubDefinitionMatchesTrackingContext(definition, context)) { errors.push(`${definition.name}: definition is not compatible with this tracking context.`); continue }
    snapshots.push(buildClubSelectionSnapshot(definition))
  }
  return errors.length ? { ok: false, reason: 'One or more club tracking selections are invalid.', fieldErrors: { clubTrackingDefinitionIds: errors } } : { ok: true, value: snapshots }
}

export async function upsertClubTrackingDefinitionTopic({ db = prisma, userId, definitionId, topicId, recommended = false, displayOrder = 0, observerLoadWeight = 1, guidance }: { db?: Db; userId: string; definitionId: string; topicId: string; recommended?: boolean; displayOrder?: number; observerLoadWeight?: number; guidance?: string | null }): Promise<Result<{ id: string }>> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, status: true, active: true, retiredAt: true, scopeType: true, targetContext: true, phase: true, focusArea: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can manage guided topic links.' }
  if (definition.status !== 'APPROVED' || !definition.active || definition.retiredAt) return { ok: false, reason: 'Only active approved definitions can be linked to guided topics.' }
  const topic = await db.eventTopic.findFirst({ where: { id: topicId, isActive: true, archivedAt: null, OR: [{ ownerScope: 'GLOBAL' }, { ownerScope: 'CLUB', clubId: definition.clubId }] }, select: { id: true, phase: true, focusArea: true } })
  if (!topic) return { ok: false, reason: 'Topic was not found or is not available to this club.' }
  if (!clubDefinitionMatchesTrackingContext(definition, { phase: topic.phase, focusArea: topic.focusArea })) return { ok: false, reason: 'Definition is not compatible with this topic.' }
  const link = await db.clubTrackingDefinitionTopic.upsert({ where: { clubTrackingDefinitionId_topicId: { clubTrackingDefinitionId: definition.id, topicId: topic.id } }, update: { recommended, displayOrder, observerLoadWeight, guidance: normalizeOptionalText(guidance) }, create: { clubTrackingDefinitionId: definition.id, topicId: topic.id, recommended, displayOrder, observerLoadWeight, guidance: normalizeOptionalText(guidance) }, select: { id: true } })
  return { ok: true, value: link }
}

export async function removeClubTrackingDefinitionTopic({ db = prisma, userId, definitionId, topicId }: { db?: Db; userId: string; definitionId: string; topicId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can manage guided topic links.' }
  await db.clubTrackingDefinitionTopic.deleteMany({ where: { clubTrackingDefinitionId: definition.id, topicId } })
  return { ok: true, value: true }
}

async function getTrackingLibraryMembership(userId: string, clubId: string, db: Db) {
  const membership = await getMembership(userId, clubId, db)
  if (!membership || !['OWNER', 'COACH', 'ASSISTANT_COACH'].includes(membership.role)) return null
  return membership as typeof membership & { role: TrackingLibraryRole }
}

async function createUniqueSlug(db: Db, clubId: string, name: string, excludeId?: string) {
  const base = slugify(name)
  let candidate = base
  let suffix = 2
  while (true) {
    const existing = await db.clubTrackingDefinition.findFirst({ where: { clubId, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })
    if (!existing) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

export async function searchExistingTrackingDefinitions({ db = prisma, userId, clubId, query }: { db?: Db; userId: string; clubId: string; query: string }) {
  if (!(await canCreateDraft(userId, clubId, db)) && !(await canViewClubDefinitions(userId, clubId, db))) return { ok: false as const, reason: 'You cannot search tracking definitions for this club.' }
  const normalized = normalizeClubTrackingDefinitionName(query)
  if (!normalized) return { ok: false as const, reason: 'Enter a search term before creating a definition.' }
  const [events, patterns, clubDefinitions] = await Promise.all([
    db.eventDefinition.findMany({ where: { scope: 'GLOBAL', OR: [{ normalizedName: { contains: normalized, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] }, select: { id: true, name: true, normalizedName: true, description: true, benchmarkable: true }, take: 10 }),
    db.trackingPatternDefinition.findMany({ where: { ownerScope: 'GLOBAL', OR: [{ normalizedName: { contains: normalized, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }, { aliases: { some: { normalizedAlias: { contains: normalized, mode: 'insensitive' } } } }] }, include: { aliases: true }, take: 10 }),
    db.clubTrackingDefinition.findMany({ where: { clubId, OR: [{ normalizedName: { contains: normalized, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] }, select: { id: true, kind: true, name: true, normalizedName: true, status: true, mappedEventDefinitionId: true, mappedPatternDefinitionId: true }, take: 10 }),
  ])
  return {
    ok: true as const,
    value: {
      searchToken: searchTokenFor({ clubId, query }),
      exactMatches: [...events.filter((item) => item.normalizedName === normalized).map((item) => ({ source: 'STANDARD_EVENT' as const, id: item.id, name: item.name })), ...patterns.filter((item) => item.normalizedName === normalized || item.aliases.some((alias) => alias.normalizedAlias === normalized)).map((item) => ({ source: 'STANDARD_PATTERN' as const, id: item.id, name: item.name })), ...clubDefinitions.filter((item) => item.normalizedName === normalized).map((item) => ({ source: 'CLUB_DEFINITION' as const, id: item.id, name: item.name }))],
      standardCandidates: [...events.map((item) => ({ itemType: 'EVENT' as const, id: item.id, name: item.name, description: item.description, benchmarkable: item.benchmarkable })), ...patterns.map((item) => ({ itemType: 'PATTERN' as const, id: item.id, name: item.name, description: item.description, aliases: item.aliases.map((alias) => alias.alias) }))],
      clubCandidates: clubDefinitions,
      warnings: buildNearDuplicateWarnings(normalized, [...events, ...patterns, ...clubDefinitions]),
      allowedCreationChoices: ['EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM', 'PATTERN_ALIAS', 'PATTERN_MAPPED'] as ClubTrackingDefinitionKind[],
    },
  }
}

export async function findClubTrackingDefinitionDuplicates({ db = prisma, clubId, name, mappedEventDefinitionId, mappedPatternDefinitionId }: { db?: Db; clubId: string; name: string; mappedEventDefinitionId?: string | null; mappedPatternDefinitionId?: string | null }) {
  const normalized = normalizeClubTrackingDefinitionName(name)
  const [globalEvent, globalPattern, clubDefinition, sameMapping] = await Promise.all([
    db.eventDefinition.findFirst({ where: { scope: 'GLOBAL', normalizedName: normalized }, select: { id: true, name: true } }),
    db.trackingPatternDefinition.findFirst({ where: { ownerScope: 'GLOBAL', OR: [{ normalizedName: normalized }, { aliases: { some: { normalizedAlias: normalized } } }] }, select: { id: true, name: true } }),
    db.clubTrackingDefinition.findFirst({ where: { clubId, normalizedName: normalized }, select: { id: true, name: true, kind: true } }),
    mappedEventDefinitionId || mappedPatternDefinitionId ? db.clubTrackingDefinition.findFirst({ where: { clubId, normalizedName: normalized, mappedEventDefinitionId: mappedEventDefinitionId ?? null, mappedPatternDefinitionId: mappedPatternDefinitionId ?? null }, select: { id: true, name: true } }) : null,
  ])
  return { normalized, exact: [globalEvent && { source: 'STANDARD_EVENT', ...globalEvent }, globalPattern && { source: 'STANDARD_PATTERN', ...globalPattern }, clubDefinition && { source: 'CLUB_DEFINITION', ...clubDefinition }, sameMapping && { source: 'SAME_MAPPING', ...sameMapping }].filter(isPresent) }
}

export async function createClubTrackingDefinitionDraft({ db = prisma, userId, input }: { db?: Db; userId: string; input: ClubTrackingDefinitionInput }): Promise<Result<{ id: string; status: ClubTrackingDefinitionStatus; warnings: string[] }>> {
  if (!(await canCreateDraft(userId, input.clubId, db))) return { ok: false, reason: 'You cannot create tracking definitions for this club.' }
  const owner = await canManageClubDefinitions(userId, input.clubId, db)
  const validation = await validateClubTrackingDefinition({ db, input })
  if (!validation.ok) return validation
  if (input.searchToken !== searchTokenFor({ clubId: input.clubId, query: input.name })) return { ok: false, reason: 'Search existing tracking definitions before creating this definition.' }
  const duplicates = await findClubTrackingDefinitionDuplicates({ db, clubId: input.clubId, name: input.name, mappedEventDefinitionId: input.mappedEventDefinitionId, mappedPatternDefinitionId: input.mappedPatternDefinitionId })
  if (duplicates.exact.length > 0) return { ok: false, reason: 'This matches an existing tracking definition.', fieldErrors: { name: duplicates.exact.map((item) => `${item.source}: ${item.name}`) } }
  const warnings = buildPatternLikeWarnings(input)
  if (warnings.length && !input.nearDuplicateAcknowledged) return { ok: false, reason: 'Review warnings before creating this definition.', fieldErrors: { warnings } }
  const status: ClubTrackingDefinitionStatus = owner && !input.createAsDraft ? 'APPROVED' : 'DRAFT'
  const mappingStatus = input.mappingStatus ?? (input.kind === 'EVENT_CUSTOM' ? 'NONE' : owner ? 'CLUB_APPROVED' : 'PROPOSED')
  const created = await db.clubTrackingDefinition.create({ data: { clubId: input.clubId, kind: input.kind, status, name: input.name.trim(), normalizedName: duplicates.normalized, slug: await createUniqueSlug(db, input.clubId, input.name), description: normalizeOptionalText(input.description), guidance: normalizeOptionalText(input.guidance), scopeType: input.scopeType ?? null, targetContext: input.targetContext ?? null, phase: input.phase ?? null, focusArea: input.focusArea ?? null, agePhases: input.agePhases ?? [], requiresLocation: Boolean(input.requiresLocation), mappedEventDefinitionId: input.mappedEventDefinitionId ?? null, mappedPatternDefinitionId: input.mappedPatternDefinitionId ?? null, mappingStatus, createdByUserId: userId, approvedByUserId: status === 'APPROVED' ? userId : null, approvedAt: status === 'APPROVED' ? new Date() : null }, select: { id: true } })
  return { ok: true, value: { id: created.id, status, warnings } }
}

export async function submitClubTrackingDefinitionForReview({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, createdByUserId: true, status: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (definition.createdByUserId !== userId && !(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'You cannot submit this definition for review.' }
  if (!['DRAFT', 'REJECTED'].includes(definition.status)) return { ok: false, reason: 'Only draft or rejected definitions can be submitted for review.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'PENDING_REVIEW', submittedAt: new Date(), rejectedByUserId: null, rejectedAt: null, rejectionReason: null, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function approveClubTrackingDefinition({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, status: true, kind: true, mappingStatus: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can approve tracking definitions.' }
  if (!['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(definition.status)) return { ok: false, reason: 'This definition cannot be approved.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'APPROVED', active: true, retiredAt: null, mappingStatus: definition.kind === 'EVENT_CUSTOM' ? 'NONE' : definition.mappingStatus === 'NONE' ? 'CLUB_APPROVED' : definition.mappingStatus, approvedByUserId: userId, approvedAt: new Date(), rejectedByUserId: null, rejectedAt: null, rejectionReason: null, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function rejectClubTrackingDefinition({ db = prisma, userId, definitionId, reason }: { db?: Db; userId: string; definitionId: string; reason?: string | null }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can reject tracking definitions.' }
  const rejectionReason = normalizeOptionalText(reason)
  if (!rejectionReason) return { ok: false, reason: 'Rejection feedback is required.', fieldErrors: { rejectionReason: ['Rejection feedback is required.'] } }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'REJECTED', rejectedByUserId: userId, rejectedAt: new Date(), rejectionReason, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function updateClubTrackingDefinition({ db = prisma, userId, definitionId, updates }: { db?: Db; userId: string; definitionId: string; updates: Partial<Omit<ClubTrackingDefinitionInput, 'clubId' | 'searchToken' | 'proposalType'>> }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  const owner = await canManageClubDefinitions(userId, definition.clubId, db)
  const ownEditableDraft = definition.createdByUserId === userId && ['DRAFT', 'REJECTED'].includes(definition.status)
  if (!owner && !ownEditableDraft) return { ok: false, reason: 'You cannot edit this tracking definition.' }
  const usage = await getClubTrackingDefinitionUsage({ db, userId, definitionId, enforceAccess: false })
  const hasUsage = usage.ok && usage.value.totalReferences > 0
  if (hasUsage && semanticFields.some((field) => field in updates && updates[field] !== undefined && updates[field] !== definition[field])) return { ok: false, reason: 'This definition has usage. Create a new definition for semantic changes and retire this one.' }
  const semanticChanged = semanticFields.some((field) => field in updates && updates[field] !== undefined && updates[field] !== definition[field])
  const resetStandardReview = semanticChanged && reviewableMappingKinds.has(definition.kind)
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { name: updates.name?.trim() ?? undefined, normalizedName: updates.name ? normalizeClubTrackingDefinitionName(updates.name) : undefined, slug: updates.name ? await createUniqueSlug(db, definition.clubId, updates.name, definition.id) : undefined, description: updates.description === undefined ? undefined : normalizeOptionalText(updates.description), guidance: updates.guidance === undefined ? undefined : normalizeOptionalText(updates.guidance), scopeType: updates.scopeType === undefined ? undefined : updates.scopeType, targetContext: updates.targetContext === undefined ? undefined : updates.targetContext, phase: updates.phase === undefined ? undefined : updates.phase, focusArea: updates.focusArea === undefined ? undefined : updates.focusArea, agePhases: updates.agePhases ?? undefined, requiresLocation: updates.requiresLocation ?? undefined, mappedEventDefinitionId: updates.mappedEventDefinitionId === undefined ? undefined : updates.mappedEventDefinitionId, mappedPatternDefinitionId: updates.mappedPatternDefinitionId === undefined ? undefined : updates.mappedPatternDefinitionId, mappingStatus: resetStandardReview && definition.status === 'APPROVED' ? 'CLUB_APPROVED' : undefined, mappingRevision: resetStandardReview ? { increment: 1 } : undefined, standardMappingReviewedByUserId: resetStandardReview ? null : undefined, standardMappingReviewedAt: resetStandardReview ? null : undefined, standardMappingRejectionReason: resetStandardReview ? null : undefined, standardMappingRejectionCategory: resetStandardReview ? null : undefined, rejectedByUserId: definition.status === 'REJECTED' ? null : undefined, rejectedAt: definition.status === 'REJECTED' ? null : undefined, rejectionReason: definition.status === 'REJECTED' ? null : undefined, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function getTrackingLibraryForUser({ db = prisma, userId, clubId, includeRetired = false, query }: { db?: Db; userId: string; clubId: string; includeRetired?: boolean; query?: string }) {
  const membership = await getTrackingLibraryMembership(userId, clubId, db)
  if (!membership) return { ok: false as const, reason: 'You cannot access the tracking library for this club.' }
  const normalizedQuery = query ? normalizeClubTrackingDefinitionName(query) : ''
  const textWhere = normalizedQuery ? { OR: [{ normalizedName: { contains: normalizedQuery, mode: 'insensitive' as const } }, { name: { contains: query, mode: 'insensitive' as const } }, { description: { contains: query, mode: 'insensitive' as const } }, { guidance: { contains: query, mode: 'insensitive' as const } }, { mappedEventDefinition: { name: { contains: query, mode: 'insensitive' as const } } }, { mappedPatternDefinition: { name: { contains: query, mode: 'insensitive' as const } } }, { createdBy: { email: { contains: query, mode: 'insensitive' as const } } }] } : {}
  const visibilityWhere = membership.role === 'OWNER'
    ? {}
    : membership.role === 'COACH'
      ? { OR: [{ status: 'APPROVED' as const, active: true }, { createdByUserId: userId, status: { in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] as ClubTrackingDefinitionStatus[] } }, ...(includeRetired ? [{ createdByUserId: userId, status: 'RETIRED' as const }] : [])] }
      : { status: 'APPROVED' as const, active: true }
  const definitions = await db.clubTrackingDefinition.findMany({
    where: { AND: [{ clubId }, includeRetired ? {} : { status: { not: 'RETIRED' as const } }, visibilityWhere, textWhere] },
    include: { club: { select: { id: true, name: true } }, createdBy: { select: { id: true, email: true } }, approvedBy: { select: { id: true, email: true } }, rejectedBy: { select: { id: true, email: true } }, mappedEventDefinition: true, mappedPatternDefinition: { include: { steps: { orderBy: { stepOrder: 'asc' }, include: { eventDefinition: true } }, outcomes: { orderBy: { displayOrder: 'asc' } } } } },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }, { name: 'asc' }],
  })
  return { ok: true as const, value: { role: membership.role, definitions } }
}

export async function getTrackingLibraryClubsForUser({ db = prisma, userId }: { db?: Db; userId: string }) {
  const memberships = await db.clubMembership.findMany({ where: { userId, role: { in: ['OWNER', 'COACH', 'ASSISTANT_COACH'] } }, include: { club: true }, orderBy: { createdAt: 'asc' } })
  return memberships.map((membership) => ({ id: membership.club.id, name: membership.club.name, role: membership.role as TrackingLibraryRole }))
}

export async function getProductionClubTrackingDefinition({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }) {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, include: { club: true, createdBy: { select: { id: true, email: true } }, approvedBy: { select: { id: true, email: true } }, rejectedBy: { select: { id: true, email: true } }, mappedEventDefinition: true, mappedPatternDefinition: { include: { steps: { orderBy: { stepOrder: 'asc' }, include: { eventDefinition: true } }, outcomes: { orderBy: { displayOrder: 'asc' } } } } } })
  if (!definition) return null
  const membership = await getTrackingLibraryMembership(userId, definition.clubId, db)
  if (!membership) return null
  if (membership.role === 'OWNER') return { role: membership.role, definition }
  if (membership.role === 'COACH' && (definition.status === 'APPROVED' && definition.active || definition.createdByUserId === userId && ['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(definition.status))) return { role: membership.role, definition }
  if (membership.role === 'ASSISTANT_COACH' && definition.status === 'APPROVED' && definition.active) return { role: membership.role, definition }
  return null
}

export async function proposeClubTrackingDefinitionMapping({ db = prisma, userId, definitionId, mappedEventDefinitionId, mappedPatternDefinitionId }: { db?: Db; userId: string; definitionId: string; mappedEventDefinitionId?: string | null; mappedPatternDefinitionId?: string | null }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, kind: true, mappingRevision: true, mappedEventDefinitionId: true, mappedPatternDefinitionId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can propose standard mappings.' }
  if (definition.kind === 'EVENT_CUSTOM') return { ok: false, reason: 'Custom event definitions cannot have a standard mapping.' }
  const next = { ...definition, mappedEventDefinitionId: mappedEventDefinitionId ?? null, mappedPatternDefinitionId: mappedPatternDefinitionId ?? null }
  const valid = await validateMappingTarget(db, next.kind, next.mappedEventDefinitionId, next.mappedPatternDefinitionId)
  if (!valid.ok) return valid
  const changed = definition.mappedEventDefinitionId !== next.mappedEventDefinitionId || definition.mappedPatternDefinitionId !== next.mappedPatternDefinitionId
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { mappedEventDefinitionId: next.mappedEventDefinitionId, mappedPatternDefinitionId: next.mappedPatternDefinitionId, mappingStatus: 'CLUB_APPROVED', mappingRevision: changed ? { increment: 1 } : undefined, standardMappingReviewedByUserId: changed ? null : undefined, standardMappingReviewedAt: changed ? null : undefined, standardMappingRejectionReason: changed ? null : undefined, standardMappingRejectionCategory: changed ? null : undefined, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export type StandardMappingReviewFilters = {
  status?: 'AWAITING' | 'STANDARD_APPROVED' | 'REJECTED' | 'ALL'
  type?: 'ALL' | 'EVENTS' | 'PATTERNS'
  clubQuery?: string
  risk?: 'ALL' | 'NO_USAGE' | 'USED' | 'BENCHMARKABLE' | 'REVISION_CHANGED' | 'SIMILAR_STANDARDS'
  sort?: 'NEWEST' | 'OLDEST' | 'LONGEST_WAITING'
}

export async function getStandardMappingReviewQueue({ db = prisma, filters = {} }: { db?: Db; filters?: StandardMappingReviewFilters } = {}) {
  const status = filters.status ?? 'AWAITING'
  const mappingStatus = status === 'AWAITING' ? ['CLUB_APPROVED' as const] : status === 'ALL' ? ['PROPOSED' as const, 'CLUB_APPROVED' as const, 'STANDARD_APPROVED' as const, 'REJECTED' as const] : [status]
  const kind = filters.type === 'EVENTS' ? ['EVENT_MAPPED' as const] : filters.type === 'PATTERNS' ? ['PATTERN_MAPPED' as const] : ['EVENT_MAPPED' as const, 'PATTERN_MAPPED' as const]
  const rows = await db.clubTrackingDefinition.findMany({
    where: { kind: { in: kind }, mappingStatus: { in: mappingStatus }, ...(status === 'AWAITING' ? { status: 'APPROVED' as const, active: true } : {}), ...(filters.clubQuery ? { club: { name: { contains: filters.clubQuery, mode: 'insensitive' as const } } } : {}) },
    include: { club: true, createdBy: { select: { email: true } }, approvedBy: { select: { email: true } }, mappedEventDefinition: true, mappedPatternDefinition: { include: { outcomes: true } }, submittedMatchEvents: { select: { id: true } }, officialMatchEvents: { select: { id: true } }, submittedPatternObservations: { select: { id: true } }, officialPatternObservations: { select: { id: true } } },
    orderBy: filters.sort === 'OLDEST' || filters.sort === 'LONGEST_WAITING' ? [{ updatedAt: 'asc' }] : [{ updatedAt: 'desc' }],
  })
  return rows.map((definition) => {
    const usageCount = definition.submittedMatchEvents.length + definition.officialMatchEvents.length + definition.submittedPatternObservations.length + definition.officialPatternObservations.length
    const benchmarkable = Boolean(definition.mappedEventDefinition?.benchmarkable)
    return { definition, usageCount, benchmarkable, warnings: buildMappingReviewWarnings(definition, usageCount) }
  }).filter((row) => {
    if (!filters.risk || filters.risk === 'ALL') return true
    if (filters.risk === 'NO_USAGE') return row.usageCount === 0
    if (filters.risk === 'USED') return row.usageCount > 0
    if (filters.risk === 'BENCHMARKABLE') return row.benchmarkable
    if (filters.risk === 'REVISION_CHANGED') return Boolean(row.definition.standardMappingReviewedAt && row.definition.mappingStatus === 'CLUB_APPROVED')
    if (filters.risk === 'SIMILAR_STANDARDS') return row.warnings.some((warning) => warning.includes('Similar'))
    return true
  })
}

export async function getStandardMappingReviewDetail({ db = prisma, definitionId }: { db?: Db; definitionId: string }) {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, include: { club: true, createdBy: { select: { email: true } }, approvedBy: { select: { email: true } }, mappedEventDefinition: true, mappedPatternDefinition: { include: { contexts: true, aliases: true, steps: { orderBy: { stepOrder: 'asc' }, include: { eventDefinition: true } }, outcomes: { orderBy: { displayOrder: 'asc' } } } }, submittedMatchEvents: { select: { id: true, createdAt: true } }, officialMatchEvents: { select: { id: true, createdAt: true } }, submittedPatternObservations: { select: { id: true, createdAt: true } }, officialPatternObservations: { select: { id: true, createdAt: true } } } })
  if (!definition || !reviewableMappingKinds.has(definition.kind)) return null
  const usageCount = definition.submittedMatchEvents.length + definition.officialMatchEvents.length + definition.submittedPatternObservations.length + definition.officialPatternObservations.length
  const standardAliases = definition.mappedEventDefinitionId ? await db.eventTopicAlias.findMany({ where: { topic: { events: { some: { eventDefinitionId: definition.mappedEventDefinitionId } } } }, take: 20 }) : []
  const similarStandards = await getSimilarStandardCandidates(db, definition)
  const similarClubMappings = await db.clubTrackingDefinition.findMany({ where: { id: { not: definition.id }, kind: definition.kind, OR: [{ mappedEventDefinitionId: definition.mappedEventDefinitionId ?? undefined }, { mappedPatternDefinitionId: definition.mappedPatternDefinitionId ?? undefined }, { normalizedName: { contains: definition.normalizedName.split(' ')[0] ?? '', mode: 'insensitive' } }] }, include: { club: { select: { name: true } }, mappedEventDefinition: true, mappedPatternDefinition: true }, take: 12 })
  return { definition, usageCount, standardAliases, similarStandards, similarClubMappings, checks: buildCompatibilityChecks(definition), eligibility: getStandardMappingReviewEligibility(definition) }
}

export async function approveClubTrackingStandardMapping({ db = prisma, actorEmail, actorUserId, definitionId, expectedMappingRevision, expectedMappingStatus }: { db?: Db; actorEmail: string; actorUserId: string; definitionId: string; expectedMappingRevision: number; expectedMappingStatus: ClubTrackingMappingStatus }): Promise<StructuredResult<ClubTrackingReportingIdentity>> {
  if (!canManageGlobalEventLibrary({ email: actorEmail })) return { ok: false, reason: 'Only super admins can approve standard mappings.', code: 'forbidden' }
  return runTransaction(db, async (tx) => {
    const validation = await validateStandardMappingReviewState(tx, definitionId, expectedMappingRevision, expectedMappingStatus)
    if (!validation.ok) return validation
    await tx.clubTrackingDefinition.update({ where: { id: definitionId }, data: { mappingStatus: 'STANDARD_APPROVED', standardMappingReviewedByUserId: actorUserId, standardMappingReviewedAt: new Date(), standardMappingRejectionReason: null, standardMappingRejectionCategory: null } })
    const identity = await getClubTrackingReportingIdentity({ db: tx, clubTrackingDefinitionId: definitionId })
    return identity.ok ? { ok: true as const, value: identity.value } : identity
  })
}

export async function rejectClubTrackingStandardMapping({ db = prisma, actorEmail, actorUserId, definitionId, expectedMappingRevision, expectedMappingStatus, category, reason }: { db?: Db; actorEmail: string; actorUserId: string; definitionId: string; expectedMappingRevision: number; expectedMappingStatus: ClubTrackingMappingStatus; category?: ClubTrackingStandardMappingRejectionCategory | null; reason?: string | null }): Promise<StructuredResult> {
  if (!canManageGlobalEventLibrary({ email: actorEmail })) return { ok: false, reason: 'Only super admins can reject standard mappings.', code: 'forbidden' }
  if (!category) return { ok: false, reason: 'Select a rejection category.', code: 'categoryRequired', fieldErrors: { category: ['Select a rejection category.'] } }
  const rejectionReason = normalizeOptionalText(reason)
  if (!rejectionReason) return { ok: false, reason: 'Rejection feedback is required.', code: 'reasonRequired', fieldErrors: { reason: ['Rejection feedback is required.'] } }
  return runTransaction(db, async (tx) => {
    const validation = await validateStandardMappingReviewState(tx, definitionId, expectedMappingRevision, expectedMappingStatus)
    if (!validation.ok) return validation
    await tx.clubTrackingDefinition.update({ where: { id: definitionId }, data: { mappingStatus: 'REJECTED', standardMappingReviewedByUserId: actorUserId, standardMappingReviewedAt: new Date(), standardMappingRejectionCategory: category, standardMappingRejectionReason: rejectionReason } })
    return { ok: true as const, value: true }
  })
}

async function runTransaction<T>(db: Db, callback: (tx: Db) => Promise<T>) {
  if ('$transaction' in db && typeof db.$transaction === 'function') return db.$transaction((tx) => callback(tx))
  return callback(db)
}

async function validateStandardMappingReviewState(db: Db, definitionId: string, expectedMappingRevision: number, expectedMappingStatus: ClubTrackingMappingStatus): Promise<StructuredResult> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, include: { mappedEventDefinition: true, mappedPatternDefinition: { include: { outcomes: true } } } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.', code: 'notFound' }
  if (!reviewableMappingKinds.has(definition.kind)) return { ok: false, reason: 'Only mapped event and mapped pattern definitions can be reviewed.', code: 'notReviewable' }
  if (definition.status !== 'APPROVED') return { ok: false, reason: 'Club definition must be approved before standard mapping review.', code: 'clubLifecycleNotApproved' }
  if (!definition.active || definition.retiredAt) return { ok: false, reason: 'Retired or inactive definitions cannot be standard approved.', code: 'definitionRetired' }
  if (definition.mappingRevision !== expectedMappingRevision) return { ok: false, reason: 'Mapping revision changed. Reload before reviewing.', code: 'staleRevision' }
  if (definition.mappingStatus !== expectedMappingStatus) return { ok: false, reason: 'Mapping status changed. Reload before reviewing.', code: 'notReviewable' }
  if (!reviewableStandardMappingStatuses.has(definition.mappingStatus)) return { ok: false, reason: 'This mapping is not awaiting standard review.', code: 'notReviewable' }
  const target = await validateMappingTarget(db, definition.kind, definition.mappedEventDefinitionId, definition.mappedPatternDefinitionId)
  if (!target.ok) return { ok: false, reason: target.reason, code: target.reason.includes('pattern') ? 'patternOutcomesMissing' : 'standardInactive' }
  const checks = buildCompatibilityChecks(definition)
  const blocking = checks.find((check) => check.level === 'BLOCKING')
  if (blocking) return { ok: false, reason: blocking.message, code: blocking.code }
  return { ok: true, value: true }
}

function buildCompatibilityChecks(definition: { kind: ClubTrackingDefinitionKind; scopeType: MatchTrackingScope | null; targetContext: TrackingTargetContext | null; phase: TrackingTopicPhase | null; focusArea: TrackingFocusArea | null; requiresLocation: boolean; guidance: string | null; description: string | null; mappedEventDefinitionId: string | null; mappedPatternDefinitionId: string | null; mappedEventDefinition?: { isActive: boolean; scope: string; requiresLocation: boolean; benchmarkable: boolean } | null; mappedPatternDefinition?: { active: boolean; requiresLocation: boolean; outcomes: Array<unknown> } | null }) {
  const isEvent = definition.kind === 'EVENT_MAPPED'
  const text = `${definition.description ?? ''} ${definition.guidance ?? ''}`.toLowerCase()
  const impliesCustomOutcome = ['custom outcome', 'score as', 'outcome:', 'successful if', 'unsuccessful if'].some((word) => text.includes(word))
  const impliesSequenceForEvent = isEvent && [' then ', 'combination', 'third player', 'set and spin', 'trigger'].some((word) => text.includes(word))
  return [
    { label: 'Matching item type', level: isEvent && definition.mappedEventDefinitionId || !isEvent && definition.mappedPatternDefinitionId ? 'COMPATIBLE' as const : 'BLOCKING' as const, code: 'typeMismatch', message: 'Club definition and mapped standard type do not match.' },
    { label: 'Standard active state', level: definition.mappedEventDefinition?.isActive === false || definition.mappedPatternDefinition?.active === false ? 'BLOCKING' as const : 'COMPATIBLE' as const, code: 'standardInactive', message: 'Mapped standard is inactive.' },
    { label: 'Club lifecycle state', level: 'COMPATIBLE' as const, code: 'ok', message: 'Club lifecycle is checked before mutation.' },
    { label: 'Scope compatibility', level: definition.scopeType ? 'COMPATIBLE' as const : 'REVIEW' as const, code: 'mappingIncompatible', message: 'Scope is not specified; confirm standard comparability.' },
    { label: 'Target-context compatibility', level: definition.targetContext ? 'COMPATIBLE' as const : 'REVIEW' as const, code: 'mappingIncompatible', message: 'Target context is not specified; confirm standard comparability.' },
    { label: 'Phase compatibility', level: definition.phase ? 'COMPATIBLE' as const : 'REVIEW' as const, code: 'mappingIncompatible', message: 'Phase is not specified; confirm standard comparability.' },
    { label: 'Focus compatibility', level: definition.focusArea ? 'COMPATIBLE' as const : 'REVIEW' as const, code: 'mappingIncompatible', message: 'Focus area is not specified; confirm standard comparability.' },
    { label: 'Location compatibility', level: definition.requiresLocation === Boolean(definition.mappedEventDefinition?.requiresLocation ?? definition.mappedPatternDefinition?.requiresLocation ?? definition.requiresLocation) ? 'COMPATIBLE' as const : 'REVIEW' as const, code: 'mappingIncompatible', message: 'Location requirement differs from the mapped standard.' },
    { label: 'Pattern outcome compatibility', level: !isEvent && definition.mappedPatternDefinition?.outcomes.length === 0 ? 'BLOCKING' as const : impliesCustomOutcome ? 'BLOCKING' as const : 'COMPATIBLE' as const, code: 'patternOutcomesMissing', message: impliesCustomOutcome ? 'Club wording implies unsupported custom outcomes.' : 'Mapped pattern must have standard outcomes.' },
    { label: 'Observable event check', level: impliesSequenceForEvent ? 'REVIEW' as const : 'COMPATIBLE' as const, code: 'mappingIncompatible', message: 'Club event wording may imply a sequence or tactical pattern.' },
    { label: 'Benchmark implication', level: definition.mappedEventDefinition?.benchmarkable ? 'REVIEW' as const : 'COMPATIBLE' as const, code: 'mappingIncompatible', message: 'Mapped standard is benchmarkable; confirm equivalence before approving.' },
  ]
}

function getStandardMappingReviewEligibility(definition: Parameters<typeof buildCompatibilityChecks>[0] & { status: ClubTrackingDefinitionStatus; active: boolean; retiredAt: Date | null; mappingStatus: ClubTrackingMappingStatus; mappingRevision: number }) {
  const checks = buildCompatibilityChecks(definition)
  const blocking = checks.filter((check) => check.level === 'BLOCKING')
  return { canApprove: definition.status === 'APPROVED' && definition.active && !definition.retiredAt && definition.mappingStatus === 'CLUB_APPROVED' && blocking.length === 0, blocking }
}

function buildMappingReviewWarnings(definition: { mappingStatus: ClubTrackingMappingStatus; standardMappingReviewedAt: Date | null; mappedEventDefinition?: { benchmarkable: boolean } | null; mappedPatternDefinition?: { outcomes: Array<unknown> } | null }, usageCount: number) {
  return [usageCount > 0 ? 'Used locally' : null, definition.mappedEventDefinition?.benchmarkable ? 'Benchmarkable standard' : null, definition.mappingStatus === 'CLUB_APPROVED' && definition.standardMappingReviewedAt ? 'Revision changed after previous review' : null, definition.mappedPatternDefinition && definition.mappedPatternDefinition.outcomes.length === 0 ? 'Pattern has no standard outcomes' : null].filter((warning): warning is string => Boolean(warning))
}

async function getSimilarStandardCandidates(db: Db, definition: { kind: ClubTrackingDefinitionKind; normalizedName: string; mappedEventDefinitionId: string | null; mappedPatternDefinitionId: string | null }) {
  const token = definition.normalizedName.split(' ')[0] ?? ''
  if (!token) return []
  if (definition.kind === 'EVENT_MAPPED') return db.eventDefinition.findMany({ where: { scope: 'GLOBAL', id: { not: definition.mappedEventDefinitionId ?? undefined }, OR: [{ normalizedName: { contains: token, mode: 'insensitive' } }, { name: { contains: token, mode: 'insensitive' } }] }, take: 8 })
  return db.trackingPatternDefinition.findMany({ where: { ownerScope: 'GLOBAL', id: { not: definition.mappedPatternDefinitionId ?? undefined }, OR: [{ normalizedName: { contains: token, mode: 'insensitive' } }, { name: { contains: token, mode: 'insensitive' } }, { aliases: { some: { normalizedAlias: { contains: token, mode: 'insensitive' } } } }] }, take: 8 })
}

export async function approveStandardMapping({ db = prisma, actorEmail, definitionId }: { db?: Db; actorEmail: string; definitionId: string }): Promise<Result> {
  if (!canManageGlobalEventLibrary({ email: actorEmail })) return { ok: false, reason: 'Only super admins can approve standard mappings.' }
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, kind: true, mappedEventDefinitionId: true, mappedPatternDefinitionId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!mappingKinds.has(definition.kind)) return { ok: false, reason: 'Custom definitions cannot be standard approved.' }
  const valid = await validateMappingTarget(db, definition.kind, definition.mappedEventDefinitionId, definition.mappedPatternDefinitionId)
  if (!valid.ok) return valid
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { mappingStatus: 'STANDARD_APPROVED', mappingRevision: { increment: 1 }, standardMappingReviewedAt: new Date(), standardMappingRejectionReason: null, standardMappingRejectionCategory: null } })
  return { ok: true, value: true }
}

export async function rejectStandardMapping({ db = prisma, actorEmail, definitionId }: { db?: Db; actorEmail: string; definitionId: string }): Promise<Result> {
  if (!canManageGlobalEventLibrary({ email: actorEmail })) return { ok: false, reason: 'Only super admins can reject standard mappings.' }
  await db.clubTrackingDefinition.update({ where: { id: definitionId }, data: { mappingStatus: 'REJECTED', mappingRevision: { increment: 1 }, standardMappingReviewedAt: new Date(), standardMappingRejectionCategory: 'OTHER', standardMappingRejectionReason: 'Rejected in the development explorer.' } })
  return { ok: true, value: true }
}

export async function retireClubTrackingDefinition({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can retire tracking definitions.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'RETIRED', active: false, retiredAt: new Date(), updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function restoreClubTrackingDefinition({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, normalizedName: true, kind: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can restore tracking definitions.' }
  const duplicate = await db.clubTrackingDefinition.findFirst({ where: { clubId: definition.clubId, kind: definition.kind, normalizedName: definition.normalizedName, active: true, id: { not: definition.id } }, select: { id: true } })
  if (duplicate) return { ok: false, reason: 'An active duplicate exists. Rename or retire the duplicate before restoring this definition.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'APPROVED', active: true, retiredAt: null, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function getAccessibleClubTrackingDefinitions({ db = prisma, userId, clubId, includeRetired = false }: { db?: Db; userId: string; clubId: string; includeRetired?: boolean }) {
  if (!(await canViewClubDefinitions(userId, clubId, db))) return []
  return db.clubTrackingDefinition.findMany({ where: { clubId, ...(includeRetired ? {} : { active: true, status: 'APPROVED' }) }, orderBy: [{ kind: 'asc' }, { name: 'asc' }] })
}

export async function getClubTrackingDefinition({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }) {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, include: { mappedEventDefinition: true, mappedPatternDefinition: { include: { outcomes: true } } } })
  if (!definition || !(await canViewClubDefinitions(userId, definition.clubId, db))) return null
  return definition
}

export async function getClubTrackingDefinitionUsage({ db = prisma, userId, definitionId, enforceAccess = true }: { db?: Db; userId: string; definitionId: string; enforceAccess?: boolean }): Promise<Result<{ submittedEventObservations: number; officialEventObservations: number; submittedPatternObservations: number; officialPatternObservations: number; templateLinks: number; trackingTaskLinks: number; totalReferences: number; lastUsedAt: Date | null; teamIds: string[] }>> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (enforceAccess && !(await canViewClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'You cannot view this definition usage.' }
  const [submittedEvents, officialEvents, submittedPatterns, officialPatterns] = await Promise.all([
    db.submittedMatchEvent.findMany({ where: { clubTrackingDefinitionId: definition.id }, select: { createdAt: true, matchDay: { select: { teamId: true } } } }),
    db.matchEvent.findMany({ where: { clubTrackingDefinitionId: definition.id }, select: { createdAt: true, matchDay: { select: { teamId: true } } } }),
    db.submittedTrackingPatternObservation.findMany({ where: { clubTrackingDefinitionId: definition.id }, select: { createdAt: true, matchDay: { select: { teamId: true } } } }),
    db.matchTrackingPatternObservation.findMany({ where: { clubTrackingDefinitionId: definition.id }, select: { createdAt: true, matchDay: { select: { teamId: true } } } }),
  ])
  const rows = [...submittedEvents, ...officialEvents, ...submittedPatterns, ...officialPatterns]
  return { ok: true, value: { submittedEventObservations: submittedEvents.length, officialEventObservations: officialEvents.length, submittedPatternObservations: submittedPatterns.length, officialPatternObservations: officialPatterns.length, templateLinks: 0, trackingTaskLinks: 0, totalReferences: rows.length, lastUsedAt: rows.map((row) => row.createdAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null, teamIds: unique(rows.map((row) => row.matchDay.teamId)) } }
}

export async function validateClubTrackingDefinition({ db = prisma, input }: { db?: Db; input: ClubTrackingDefinitionInput }): Promise<Result> {
  if (!input.name.trim()) return { ok: false, reason: 'Definition name is required.', fieldErrors: { name: ['Definition name is required.'] } }
  if (input.kind.startsWith('EVENT') && input.proposalType !== 'EVENT') return { ok: false, reason: 'Event definitions must be proposed as one observable event.' }
  if (input.kind.startsWith('PATTERN') && input.proposalType !== 'PATTERN') return { ok: false, reason: 'Pattern definitions must be proposed as tactical patterns or sequences.' }
  if (input.kind === 'EVENT_CUSTOM' && (input.mappedEventDefinitionId || input.mappedPatternDefinitionId || input.mappingStatus && input.mappingStatus !== 'NONE')) return { ok: false, reason: 'Custom club events cannot have a standard mapping.' }
  if (input.kind.startsWith('EVENT') && input.patternConfigurationProvided) return { ok: false, reason: 'Event definitions cannot include tactical pattern configuration.' }
  if (input.kind.startsWith('PATTERN') && input.requiresLocation && input.kind === 'PATTERN_ALIAS') return { ok: false, reason: 'Pattern aliases inherit location requirements from the standard pattern.' }
  return validateMappingTarget(db, input.kind, input.mappedEventDefinitionId ?? null, input.mappedPatternDefinitionId ?? null)
}

export async function getClubTrackingReportingIdentity({ db = prisma, clubTrackingDefinitionId, eventDefinitionId, patternDefinitionId }: { db?: Db; clubTrackingDefinitionId?: string | null; eventDefinitionId?: string | null; patternDefinitionId?: string | null }): Promise<Result<ClubTrackingReportingIdentity>> {
  if (!clubTrackingDefinitionId) {
    const benchmarkable = eventDefinitionId ? (await db.eventDefinition.findUnique({ where: { id: eventDefinitionId }, select: { benchmarkable: true } }))?.benchmarkable ?? false : false
    return { ok: true, value: { identityType: 'STANDARD', standardEventDefinitionId: eventDefinitionId ?? undefined, standardPatternDefinitionId: patternDefinitionId ?? undefined, contributesToStandardReporting: Boolean(eventDefinitionId || patternDefinitionId), contributesToClubReporting: false, benchmarkEligible: benchmarkable } }
  }
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: clubTrackingDefinitionId }, include: { mappedEventDefinition: true, mappedPatternDefinition: true } })
  if (!definition) return { ok: false, reason: 'Club tracking definition was not found.' }
  const isAlias = definition.kind === 'EVENT_ALIAS' || definition.kind === 'PATTERN_ALIAS'
  const isMapped = definition.kind === 'EVENT_MAPPED' || definition.kind === 'PATTERN_MAPPED'
  const standardApproved = definition.mappingStatus === 'STANDARD_APPROVED'
  const standardEventDefinitionId = definition.mappedEventDefinitionId ?? eventDefinitionId ?? undefined
  const standardPatternDefinitionId = definition.mappedPatternDefinitionId ?? patternDefinitionId ?? undefined
  const mappedBenchmarkable = definition.mappedEventDefinition?.benchmarkable ?? false
  return { ok: true, value: { identityType: isAlias ? 'CLUB_ALIAS' : isMapped ? 'CLUB_MAPPED' : 'CLUB_SPECIFIC', clubTrackingDefinitionId: definition.id, standardEventDefinitionId, standardPatternDefinitionId, mappingStatus: definition.mappingStatus, mappingRevision: definition.mappingRevision, contributesToStandardReporting: isAlias || (isMapped && standardApproved), contributesToClubReporting: true, benchmarkEligible: (isAlias || (isMapped && standardApproved)) && mappedBenchmarkable } }
}

export async function deleteUnusedClubTrackingDefinitionDraft({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, status: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db)) && definition.status !== 'DRAFT') return { ok: false, reason: 'Only unused drafts can be deleted.' }
  const usage = await getClubTrackingDefinitionUsage({ db, userId, definitionId, enforceAccess: false })
  if (!usage.ok) return usage
  if (usage.value.totalReferences > 0) return { ok: false, reason: 'Referenced definitions cannot be deleted. Retire them instead.' }
  if (definition.status !== 'DRAFT') return { ok: false, reason: 'Only drafts can be deleted.' }
  await db.clubTrackingDefinition.delete({ where: { id: definition.id } })
  return { ok: true, value: true }
}

async function validateMappingTarget(db: Db, kind: ClubTrackingDefinitionKind, mappedEventDefinitionId?: string | null, mappedPatternDefinitionId?: string | null): Promise<Result> {
  if (eventKinds.has(kind) && mappedPatternDefinitionId) return { ok: false, reason: 'Event definitions cannot map to tactical patterns.' }
  if (patternKinds.has(kind) && mappedEventDefinitionId) return { ok: false, reason: 'Pattern definitions cannot map to events.' }
  if (kind === 'EVENT_CUSTOM') return mappedEventDefinitionId ? { ok: false, reason: 'Custom events cannot map to standard events.' } : { ok: true, value: true }
  if (eventKinds.has(kind)) {
    if (!mappedEventDefinitionId) return { ok: false, reason: 'Event aliases and mapped events require a standard event.' }
    const standard = await db.eventDefinition.findFirst({ where: { id: mappedEventDefinitionId, scope: 'GLOBAL', isActive: true, archivedAt: null }, select: { id: true } })
    return standard ? { ok: true, value: true } : { ok: false, reason: 'Mapped standard event is not active or global.' }
  }
  if (!mappedPatternDefinitionId) return { ok: false, reason: 'Pattern aliases and mapped patterns require a standard pattern.' }
  const pattern = await db.trackingPatternDefinition.findFirst({ where: { id: mappedPatternDefinitionId, ownerScope: 'GLOBAL', active: true }, include: { outcomes: true } })
  if (!pattern) return { ok: false, reason: 'Mapped standard pattern is not active or global.' }
  if (pattern.outcomes.length === 0) return { ok: false, reason: 'Mapped standard pattern must have standard outcomes.' }
  return { ok: true, value: true }
}

function buildNearDuplicateWarnings(normalized: string, candidates: Array<{ normalizedName: string; name: string }>) {
  const tokens = new Set(normalized.split(' ').filter(Boolean))
  return candidates.filter((candidate) => candidate.normalizedName !== normalized).flatMap((candidate) => {
    const candidateTokens = candidate.normalizedName.split(' ').filter(Boolean)
    const overlap = candidateTokens.filter((token) => tokens.has(token)).length
    return overlap >= Math.max(2, Math.min(tokens.size, candidateTokens.length) - 1) ? [`Similar existing definition: ${candidate.name}`] : []
  })
}

function buildPatternLikeWarnings(input: ClubTrackingDefinitionInput) {
  if (!input.kind.startsWith('EVENT')) return []
  const text = `${input.name} ${input.description ?? ''} ${input.guidance ?? ''}`.toLowerCase()
  const patternWords = [' then ', 'sequence', 'trigger', 'combination', 'third player', 'third-player', 'regain and', 'set and']
  return patternWords.some((word) => text.includes(word)) ? ['This sounds like a tactical pattern or sequence. Confirm it is one observable event or create a pattern definition instead.'] : []
}
