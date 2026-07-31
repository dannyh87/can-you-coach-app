import { createHash } from 'crypto'
import type {
  ClubTrackingDefinitionKind,
  ClubTrackingDefinitionStatus,
  ClubTrackingMappingStatus,
  EventDefinitionAgePhase,
  MatchTrackingScope,
  Prisma,
  TrackingFocusArea,
  TrackingTargetContext,
  TrackingTopicPhase,
} from '@prisma/client'

import { canManageGlobalEventLibrary } from '@/lib/superAdmin'
import { prisma } from '@/lib/prisma'

type Db = typeof prisma | Prisma.TransactionClient
type Result<T = true> = { ok: true; value: T } | { ok: false; reason: string; fieldErrors?: Record<string, string[]> }

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
}

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

const mappingKinds = new Set<ClubTrackingDefinitionKind>(['EVENT_ALIAS', 'EVENT_MAPPED', 'PATTERN_ALIAS', 'PATTERN_MAPPED'])
const eventKinds = new Set<ClubTrackingDefinitionKind>(['EVENT_ALIAS', 'EVENT_MAPPED', 'EVENT_CUSTOM'])
const patternKinds = new Set<ClubTrackingDefinitionKind>(['PATTERN_ALIAS', 'PATTERN_MAPPED'])
const semanticFields = ['kind', 'scopeType', 'targetContext', 'phase', 'focusArea', 'requiresLocation', 'mappedEventDefinitionId', 'mappedPatternDefinitionId'] as const

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
  const status: ClubTrackingDefinitionStatus = owner ? 'APPROVED' : 'DRAFT'
  const mappingStatus = input.mappingStatus ?? (input.kind === 'EVENT_CUSTOM' ? 'NONE' : owner ? 'CLUB_APPROVED' : 'PROPOSED')
  const created = await db.clubTrackingDefinition.create({ data: { clubId: input.clubId, kind: input.kind, status, name: input.name.trim(), normalizedName: duplicates.normalized, slug: await createUniqueSlug(db, input.clubId, input.name), description: normalizeOptionalText(input.description), guidance: normalizeOptionalText(input.guidance), scopeType: input.scopeType ?? null, targetContext: input.targetContext ?? null, phase: input.phase ?? null, focusArea: input.focusArea ?? null, agePhases: input.agePhases ?? [], requiresLocation: Boolean(input.requiresLocation), mappedEventDefinitionId: input.mappedEventDefinitionId ?? null, mappedPatternDefinitionId: input.mappedPatternDefinitionId ?? null, mappingStatus, createdByUserId: userId, approvedByUserId: status === 'APPROVED' ? userId : null, approvedAt: status === 'APPROVED' ? new Date() : null }, select: { id: true } })
  return { ok: true, value: { id: created.id, status, warnings } }
}

export async function submitClubTrackingDefinitionForReview({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, createdByUserId: true, status: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (definition.createdByUserId !== userId && !(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'You cannot submit this definition for review.' }
  if (definition.status !== 'DRAFT') return { ok: false, reason: 'Only draft definitions can be submitted for review.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'PENDING_REVIEW', updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function approveClubTrackingDefinition({ db = prisma, userId, definitionId }: { db?: Db; userId: string; definitionId: string }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true, status: true, kind: true, mappingStatus: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can approve tracking definitions.' }
  if (!['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(definition.status)) return { ok: false, reason: 'This definition cannot be approved.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'APPROVED', active: true, retiredAt: null, mappingStatus: definition.kind === 'EVENT_CUSTOM' ? 'NONE' : definition.mappingStatus === 'NONE' ? 'CLUB_APPROVED' : definition.mappingStatus, approvedByUserId: userId, approvedAt: new Date(), updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function rejectClubTrackingDefinition({ db = prisma, userId, definitionId, reason }: { db?: Db; userId: string; definitionId: string; reason?: string | null }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, clubId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can reject tracking definitions.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { status: 'REJECTED', guidance: normalizeOptionalText(reason) ?? undefined, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function updateClubTrackingDefinition({ db = prisma, userId, definitionId, updates }: { db?: Db; userId: string; definitionId: string; updates: Partial<Omit<ClubTrackingDefinitionInput, 'clubId' | 'searchToken' | 'proposalType'>> }): Promise<Result> {
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!(await canManageClubDefinitions(userId, definition.clubId, db))) return { ok: false, reason: 'Only club owners can edit tracking definitions.' }
  const usage = await getClubTrackingDefinitionUsage({ db, userId, definitionId, enforceAccess: false })
  const hasUsage = usage.ok && usage.value.totalReferences > 0
  if (hasUsage && semanticFields.some((field) => field in updates && updates[field] !== undefined && updates[field] !== definition[field])) return { ok: false, reason: 'This definition has usage. Create a new definition for semantic changes and retire this one.' }
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { name: updates.name?.trim() ?? undefined, normalizedName: updates.name ? normalizeClubTrackingDefinitionName(updates.name) : undefined, slug: updates.name ? await createUniqueSlug(db, definition.clubId, updates.name, definition.id) : undefined, description: updates.description === undefined ? undefined : normalizeOptionalText(updates.description), guidance: updates.guidance === undefined ? undefined : normalizeOptionalText(updates.guidance), requiresLocation: updates.requiresLocation ?? undefined, updatedByUserId: userId } })
  return { ok: true, value: true }
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
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { mappedEventDefinitionId: next.mappedEventDefinitionId, mappedPatternDefinitionId: next.mappedPatternDefinitionId, mappingStatus: 'CLUB_APPROVED', mappingRevision: changed ? { increment: 1 } : undefined, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function approveStandardMapping({ db = prisma, actorEmail, definitionId }: { db?: Db; actorEmail: string; definitionId: string }): Promise<Result> {
  if (!canManageGlobalEventLibrary({ email: actorEmail })) return { ok: false, reason: 'Only super admins can approve standard mappings.' }
  const definition = await db.clubTrackingDefinition.findUnique({ where: { id: definitionId }, select: { id: true, kind: true, mappedEventDefinitionId: true, mappedPatternDefinitionId: true } })
  if (!definition) return { ok: false, reason: 'Tracking definition was not found.' }
  if (!mappingKinds.has(definition.kind)) return { ok: false, reason: 'Custom definitions cannot be standard approved.' }
  const valid = await validateMappingTarget(db, definition.kind, definition.mappedEventDefinitionId, definition.mappedPatternDefinitionId)
  if (!valid.ok) return valid
  await db.clubTrackingDefinition.update({ where: { id: definition.id }, data: { mappingStatus: 'STANDARD_APPROVED', mappingRevision: { increment: 1 } } })
  return { ok: true, value: true }
}

export async function rejectStandardMapping({ db = prisma, actorEmail, definitionId }: { db?: Db; actorEmail: string; definitionId: string }): Promise<Result> {
  if (!canManageGlobalEventLibrary({ email: actorEmail })) return { ok: false, reason: 'Only super admins can reject standard mappings.' }
  await db.clubTrackingDefinition.update({ where: { id: definitionId }, data: { mappingStatus: 'REJECTED', mappingRevision: { increment: 1 } } })
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
