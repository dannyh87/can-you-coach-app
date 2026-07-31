import type { MatchTrackingScope, Prisma, TrackingTargetContext, TrackingTemplateVisibility } from '@prisma/client'

import { isMatchDayTrackingV2Enabled } from '@/lib/features'
import { getMatchDayEventCategoryFallback } from '@/lib/eventDefinitions'
import { canManageMatchDay, canManageTeamData, isOwnerForClub } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Db = typeof prisma | Prisma.TransactionClient
type Result<T = true> = { ok: true; value: T } | { ok: false; reason: string; fieldErrors?: Record<string, string[]> }

export type TemplateBlueprintInput = {
  scopeType: MatchTrackingScope
  targetContext?: TrackingTargetContext | null
  unitKey?: string | null
  unitLabel?: string | null
  topicId?: string | null
  title: string
  instructions?: string | null
  eventDefinitionIds: string[]
  patternIds: string[]
}

export type ApplyTemplateMapping = {
  templateTaskId: string
  playerIds?: string[]
  unitKey?: string | null
  unitLabel?: string | null
  skip?: boolean
  allowDuplicate?: boolean
}

const targetContexts = new Set<TrackingTargetContext>([
  'GOALKEEPER', 'CENTRE_BACK', 'FULL_BACK', 'WING_BACK', 'DEFENSIVE_MIDFIELDER', 'CENTRAL_MIDFIELDER', 'ATTACKING_MIDFIELDER', 'WIDE_PLAYER', 'CENTRE_FORWARD', 'GENERAL_OUTFIELD_PLAYER',
  'GOALKEEPER_UNIT', 'DEFENSIVE_UNIT', 'MIDFIELD_UNIT', 'ATTACKING_UNIT', 'LEFT_SIDE_UNIT', 'RIGHT_SIDE_UNIT', 'BUILD_UP_UNIT', 'PRESSING_UNIT', 'CUSTOM_UNIT', 'WHOLE_TEAM',
])

const normalizeOptionalText = (value: string | null | undefined) => value?.trim() ? value.trim() : null
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)))
const runTransaction = async <T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>) => {
  const transaction = (db as typeof prisma).$transaction
  return transaction ? transaction.call(db, fn) as Promise<T> : fn(db as Prisma.TransactionClient)
}

function accessibleTemplateWhere(userId: string, teamIds: string[], clubIds: string[], includeArchived = false): Prisma.TrackingSetupTemplateWhereInput {
  return {
    ...(includeArchived ? {} : { archivedAt: null, active: true }),
    OR: [
      { visibility: 'PERSONAL', ownerUserId: userId },
      { visibility: 'TEAM', teamId: { in: teamIds } },
      { visibility: 'CLUB', clubId: { in: clubIds } },
    ],
  }
}

async function getUserAccess(userId: string, db: Db = prisma) {
  const memberships = await db.clubMembership.findMany({ where: { userId }, include: { teamAssignments: true } })
  const teamIds = memberships.flatMap((membership) => membership.role === 'OWNER' ? [] : membership.teamAssignments.map((assignment) => assignment.teamId))
  const ownerClubIds = memberships.filter((membership) => membership.role === 'OWNER').map((membership) => membership.clubId)
  if (ownerClubIds.length > 0) {
    const ownerTeams = await db.team.findMany({ where: { clubId: { in: ownerClubIds } }, select: { id: true } })
    teamIds.push(...ownerTeams.map((team) => team.id))
  }
  return { teamIds: unique(teamIds), clubIds: memberships.map((membership) => membership.clubId), ownerClubIds }
}

async function canManageTemplateVisibility({ userId, visibility, teamId, clubId }: { userId: string; visibility: TrackingTemplateVisibility; teamId?: string | null; clubId: string }) {
  if (visibility === 'PERSONAL') return true
  if (visibility === 'TEAM') return Boolean(teamId && await canManageTeamData(userId, teamId))
  return isOwnerForClub(userId, clubId)
}

function getTaskTargetContext(task: { scopeType: MatchTrackingScope; unitKey?: string | null; player?: { preferredPosition: string | null } | null }): TrackingTargetContext | null {
  if (task.scopeType === 'TEAM') return 'WHOLE_TEAM'
  if (task.scopeType === 'UNIT') return targetContexts.has(task.unitKey as TrackingTargetContext) ? task.unitKey as TrackingTargetContext : 'CUSTOM_UNIT'
  const normalized = task.player?.preferredPosition?.toUpperCase().replace(/[^A-Z0-9]+/g, '_') as TrackingTargetContext | undefined
  return normalized && targetContexts.has(normalized) ? normalized : 'GENERAL_OUTFIELD_PLAYER'
}

async function validateBlueprints({ db, clubId, tasks }: { db: Db; clubId: string; tasks: TemplateBlueprintInput[] }): Promise<Result> {
  if (tasks.length === 0) return { ok: false, reason: 'Choose at least one task for this template.' }
  const errors: Record<string, string[]> = {}
  const addError = (key: string, message: string) => { errors[key] = [...(errors[key] ?? []), message] }
  const eventIds = unique(tasks.flatMap((task) => task.eventDefinitionIds))
  const patternIds = unique(tasks.flatMap((task) => task.patternIds))
  const topicIds = unique(tasks.flatMap((task) => task.topicId ? [task.topicId] : []))
  const [events, patterns, topics] = await Promise.all([
    eventIds.length ? db.eventDefinition.findMany({ where: { id: { in: eventIds }, isActive: true, archivedAt: null, OR: [{ scope: 'GLOBAL' }, { scope: 'CLUB', clubId }] }, select: { id: true } }) : [],
    patternIds.length ? db.trackingPatternDefinition.findMany({ where: { id: { in: patternIds }, active: true, OR: [{ ownerScope: 'GLOBAL' }, { ownerScope: 'CLUB', clubId }] }, select: { id: true } }) : [],
    topicIds.length ? db.eventTopic.findMany({ where: { id: { in: topicIds }, isActive: true, archivedAt: null, OR: [{ ownerScope: 'GLOBAL' }, { ownerScope: 'CLUB', clubId }] }, select: { id: true } }) : [],
  ])
  const validEvents = new Set(events.map((event) => event.id))
  const validPatterns = new Set(patterns.map((pattern) => pattern.id))
  const validTopics = new Set(topics.map((topic) => topic.id))
  tasks.forEach((task, index) => {
    const key = `tasks.${index}`
    if (!task.title.trim()) addError(key, 'Task title is required.')
    if (task.eventDefinitionIds.length + task.patternIds.length === 0) addError(key, 'Each template task needs at least one event or pattern.')
    if (task.eventDefinitionIds.length !== unique(task.eventDefinitionIds).length) addError(key, 'Duplicate events are not allowed in one template task.')
    if (task.patternIds.length !== unique(task.patternIds).length) addError(key, 'Duplicate patterns are not allowed in one template task.')
    if (task.scopeType === 'PLAYER' && !task.targetContext) addError(key, 'Player template tasks require a target role.')
    if (task.scopeType === 'UNIT' && (!task.targetContext || !task.unitKey || !task.unitLabel)) addError(key, 'Unit template tasks require a unit context and label.')
    if (task.scopeType === 'TEAM' && (task.unitKey || task.unitLabel || task.targetContext !== 'WHOLE_TEAM')) addError(key, 'Team template tasks must target the whole team.')
    if (task.topicId && !validTopics.has(task.topicId)) addError(key, 'Topic is not active or accessible.')
    task.eventDefinitionIds.forEach((id) => { if (!validEvents.has(id)) addError(key, 'One or more events are not active or accessible.') })
    task.patternIds.forEach((id) => { if (!validPatterns.has(id)) addError(key, 'One or more tactical patterns are not active or accessible.') })
  })
  return Object.keys(errors).length ? { ok: false, reason: 'Template is invalid.', fieldErrors: errors } : { ok: true, value: true }
}

export async function createTrackingSetupTemplate({ db = prisma, userId, clubId, teamId, visibility, name, description, tasks }: { db?: Db; userId: string; clubId: string; teamId?: string | null; visibility: TrackingTemplateVisibility; name: string; description?: string | null; tasks: TemplateBlueprintInput[] }): Promise<Result<{ id: string }>> {
  if (!isMatchDayTrackingV2Enabled()) return { ok: false, reason: 'Match Day tracking templates are not available.' }
  const templateName = name.trim()
  if (!templateName) return { ok: false, reason: 'Template name is required.', fieldErrors: { name: ['Template name is required.'] } }
  if (!(await canManageTemplateVisibility({ userId, visibility, teamId, clubId }))) return { ok: false, reason: 'You cannot manage templates with this visibility.' }
  const valid = await validateBlueprints({ db, clubId, tasks })
  if (!valid.ok) return valid
  const created = await runTransaction(db, async (tx) => {
    const template = await tx.trackingSetupTemplate.create({ data: { name: templateName, description: normalizeOptionalText(description), visibility, clubId, teamId: visibility === 'TEAM' ? teamId ?? null : null, ownerUserId: userId, createdByUserId: userId }, select: { id: true } })
    for (const [index, task] of tasks.entries()) {
      const createdTask = await tx.trackingSetupTemplateTask.create({ data: { templateId: template.id, scopeType: task.scopeType, targetContext: task.targetContext ?? null, unitKey: normalizeOptionalText(task.unitKey), unitLabel: normalizeOptionalText(task.unitLabel), topicId: task.topicId ?? null, title: task.title.trim(), instructions: normalizeOptionalText(task.instructions), displayOrder: index }, select: { id: true } })
      if (task.eventDefinitionIds.length) await tx.trackingSetupTemplateTaskEvent.createMany({ data: task.eventDefinitionIds.map((eventDefinitionId, displayOrder) => ({ templateTaskId: createdTask.id, eventDefinitionId, displayOrder })) })
      if (task.patternIds.length) await tx.trackingSetupTemplateTaskPattern.createMany({ data: task.patternIds.map((patternId, displayOrder) => ({ templateTaskId: createdTask.id, patternId, displayOrder })) })
    }
    return template
  })
  return { ok: true, value: created }
}

export async function createTemplateFromMatchTasks({ db = prisma, userId, matchDayId, taskIds, name, description, visibility }: { db?: Db; userId: string; matchDayId: string; taskIds: string[]; name: string; description?: string | null; visibility: TrackingTemplateVisibility }): Promise<Result<{ id: string }>> {
  if (!(await canManageMatchDay(userId, matchDayId))) return { ok: false, reason: 'You cannot manage templates for this match.' }
  const match = await db.matchDay.findUnique({ where: { id: matchDayId }, select: { teamId: true, team: { select: { clubId: true } } } })
  if (!match) return { ok: false, reason: 'Match was not found.' }
  const tasks = await db.matchTrackingTask.findMany({ where: { id: { in: unique(taskIds) }, matchDayId, status: { not: 'ARCHIVED' } }, include: { player: { select: { preferredPosition: true } }, events: { include: { matchDayEventType: true }, orderBy: { displayOrder: 'asc' } }, patterns: { orderBy: { displayOrder: 'asc' } } }, orderBy: { createdAt: 'asc' } })
  const blueprints = tasks.map((task): TemplateBlueprintInput => ({ scopeType: task.scopeType, targetContext: getTaskTargetContext(task), unitKey: task.scopeType === 'UNIT' ? task.unitKey : null, unitLabel: task.scopeType === 'UNIT' ? task.unitLabel : null, topicId: task.topicId, title: task.title, instructions: task.instructions, eventDefinitionIds: task.events.flatMap((event) => event.matchDayEventType.eventDefinitionId ? [event.matchDayEventType.eventDefinitionId] : []), patternIds: task.patterns.map((pattern) => pattern.patternId) }))
  return createTrackingSetupTemplate({ db, userId, clubId: match.team.clubId, teamId: match.teamId, visibility, name, description, tasks: blueprints })
}

export const createTemplateFromSingleTask = (input: Omit<Parameters<typeof createTemplateFromMatchTasks>[0], 'taskIds'> & { taskId: string }) => createTemplateFromMatchTasks({ ...input, taskIds: [input.taskId] })

export async function getAccessibleTrackingTemplates({ db = prisma, userId, teamId, includeArchived = false, query }: { db?: Db; userId: string; teamId?: string; includeArchived?: boolean; query?: string }) {
  const access = await getUserAccess(userId, db)
  const teamIds = teamId ? access.teamIds.filter((id) => id === teamId) : access.teamIds
  const search = normalizeOptionalText(query)?.toLowerCase()
  const templates = await db.trackingSetupTemplate.findMany({ where: { AND: [accessibleTemplateWhere(userId, teamIds, access.clubIds, includeArchived), ...(teamId ? [{ OR: [{ visibility: 'PERSONAL' as const }, { teamId }, { visibility: 'CLUB' as const }] }] : [])] }, include: { team: { select: { name: true } }, tasks: { include: { topic: true, events: { include: { eventDefinition: true } }, patterns: { include: { pattern: { include: { aliases: true } } } } }, orderBy: { displayOrder: 'asc' } }, applications: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } })
  return templates.filter((template) => !search || `${template.name} ${template.description ?? ''} ${template.tasks.map((task) => `${task.title} ${task.topic?.name ?? ''} ${task.events.map((event) => event.eventDefinition.name).join(' ')} ${task.patterns.map((pattern) => `${pattern.pattern.name} ${pattern.pattern.aliases.map((alias) => alias.alias).join(' ')}`).join(' ')}`).join(' ')}`.toLowerCase().includes(search)).map(formatTemplateSummary)
}

export async function getTrackingTemplate({ db = prisma, userId, templateId, includeArchived = false }: { db?: Db; userId: string; templateId: string; includeArchived?: boolean }) {
  const access = await getUserAccess(userId, db)
  const template = await db.trackingSetupTemplate.findFirst({ where: { id: templateId, ...accessibleTemplateWhere(userId, access.teamIds, access.clubIds, includeArchived) }, include: templateInclude() })
  return template ? formatTemplateDetail(template) : null
}

export const getTrackingTemplatePreview = getTrackingTemplate

export async function updateTrackingTemplate({ db = prisma, userId, templateId, name, description }: { db?: Db; userId: string; templateId: string; name: string; description?: string | null }): Promise<Result> {
  const template = await db.trackingSetupTemplate.findUnique({ where: { id: templateId }, select: { clubId: true, teamId: true, visibility: true } })
  if (!template) return { ok: false, reason: 'Template was not found.' }
  if (!(await canManageTemplateVisibility({ userId, visibility: template.visibility, teamId: template.teamId, clubId: template.clubId }))) return { ok: false, reason: 'You cannot edit this template.' }
  await db.trackingSetupTemplate.update({ where: { id: templateId }, data: { name: name.trim(), description: normalizeOptionalText(description), revision: { increment: 1 }, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function archiveTrackingTemplate({ db = prisma, userId, templateId }: { db?: Db; userId: string; templateId: string }): Promise<Result> {
  const template = await db.trackingSetupTemplate.findUnique({ where: { id: templateId }, select: { clubId: true, teamId: true, visibility: true } })
  if (!template) return { ok: false, reason: 'Template was not found.' }
  if (!(await canManageTemplateVisibility({ userId, visibility: template.visibility, teamId: template.teamId, clubId: template.clubId }))) return { ok: false, reason: 'You cannot archive this template.' }
  await db.trackingSetupTemplate.update({ where: { id: templateId }, data: { active: false, archivedAt: new Date(), updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function restoreTrackingTemplate({ db = prisma, userId, templateId }: { db?: Db; userId: string; templateId: string }): Promise<Result> {
  const template = await db.trackingSetupTemplate.findUnique({ where: { id: templateId }, select: { clubId: true, teamId: true, visibility: true } })
  if (!template) return { ok: false, reason: 'Template was not found.' }
  if (!(await canManageTemplateVisibility({ userId, visibility: template.visibility, teamId: template.teamId, clubId: template.clubId }))) return { ok: false, reason: 'You cannot restore this template.' }
  await db.trackingSetupTemplate.update({ where: { id: templateId }, data: { active: true, archivedAt: null, updatedByUserId: userId } })
  return { ok: true, value: true }
}

export async function duplicateTrackingTemplate({ db = prisma, userId, templateId, name }: { db?: Db; userId: string; templateId: string; name?: string }): Promise<Result<{ id: string }>> {
  const source = await getTrackingTemplate({ db, userId, templateId, includeArchived: true })
  if (!source) return { ok: false, reason: 'Template was not found.' }
  return createTrackingSetupTemplate({ db, userId, clubId: source.clubId, teamId: source.teamId, visibility: source.visibility, name: name ?? `${source.name} - Copy`, description: source.description, tasks: source.tasks.map((task) => ({ scopeType: task.scopeType, targetContext: task.targetContext, unitKey: task.unitKey, unitLabel: task.unitLabel, topicId: task.topicId, title: task.title, instructions: task.instructions, eventDefinitionIds: task.events.map((event) => event.eventDefinitionId), patternIds: task.patterns.map((pattern) => pattern.patternId) })) })
}

export const validateTrackingTemplate = validateBlueprints

export async function applyTrackingTemplateToMatch({ db = prisma, userId, templateId, matchDayId, idempotencyKey, mappings }: { db?: Db; userId: string; templateId: string; matchDayId: string; idempotencyKey: string; mappings: ApplyTemplateMapping[] }): Promise<Result<{ applicationId: string; taskIds: string[]; warnings: string[] }>> {
  if (!isMatchDayTrackingV2Enabled()) return { ok: false, reason: 'Match Day tracking templates are not available.' }
  if (!idempotencyKey || idempotencyKey.length < 16) return { ok: false, reason: 'Application key is invalid.' }
  const existing = await db.trackingSetupTemplateApplication.findUnique({ where: { idempotencyKey }, include: { createdTasks: { select: { id: true } } } })
  if (existing) {
    if (existing.templateId !== templateId || existing.matchDayId !== matchDayId || existing.appliedByUserId !== userId) return { ok: false, reason: 'Application key was already used for a different template application.' }
    return { ok: true, value: { applicationId: existing.id, taskIds: existing.createdTasks.map((task) => task.id), warnings: [] } }
  }
  if (!(await canManageMatchDay(userId, matchDayId))) return { ok: false, reason: 'You cannot manage this match.' }
  const [template, match] = await Promise.all([getTrackingTemplate({ db, userId, templateId }), db.matchDay.findUnique({ where: { id: matchDayId }, select: { id: true, status: true, teamId: true, team: { select: { clubId: true } } } })])
  if (!template) return { ok: false, reason: 'Template was not found or is archived.' }
  if (!match) return { ok: false, reason: 'Match was not found.' }
  if (match.status !== 'DRAFT') return { ok: false, reason: 'Templates can only be applied to draft matches.' }
  const validation = await validateApplication({ db, template, matchDayId, clubId: match.team.clubId, mappings })
  if (!validation.ok) return validation
  const eventIds = unique(validation.value.tasks.flatMap((task) => task.eventDefinitionIds))
  const created = await runTransaction(db, async (tx) => {
    const eventRows = new Map<string, string>()
    if (eventIds.length > 0) {
      const definitions = await tx.eventDefinition.findMany({ where: { id: { in: eventIds } } })
      for (const definition of definitions) {
        const row = await tx.matchDayEventType.upsert({ where: { matchDayId_eventDefinitionId: { matchDayId, eventDefinitionId: definition.id } }, update: { eventType: definition.legacyEventType ?? null, category: getMatchDayEventCategoryFallback(definition) }, create: { matchDayId, eventDefinitionId: definition.id, eventType: definition.legacyEventType ?? null, category: getMatchDayEventCategoryFallback(definition) }, select: { id: true } })
        eventRows.set(definition.id, row.id)
      }
    }
    const application = await tx.trackingSetupTemplateApplication.create({ data: { templateId, templateRevision: template.revision, matchDayId, appliedByUserId: userId, idempotencyKey }, select: { id: true } })
    const taskIds: string[] = []
    for (const task of validation.value.tasks) {
      const createdTask = await tx.matchTrackingTask.create({ data: { matchDayId, createdByUserId: userId, topicId: task.topicId, scopeType: task.scopeType, playerId: task.playerId, unitKey: task.unitKey, unitLabel: task.unitLabel, title: task.title, instructions: task.instructions, status: 'READY', templateApplicationId: application.id, sourceTemplateTaskId: task.templateTaskId }, select: { id: true } })
      taskIds.push(createdTask.id)
      if (task.eventDefinitionIds.length) await tx.matchTrackingTaskEvent.createMany({ data: task.eventDefinitionIds.map((eventDefinitionId, displayOrder) => ({ trackingTaskId: createdTask.id, matchDayEventTypeId: eventRows.get(eventDefinitionId)!, displayOrder })) })
      if (task.patternIds.length) await tx.matchTrackingTaskPattern.createMany({ data: task.patternIds.map((patternId, displayOrder) => ({ trackingTaskId: createdTask.id, patternId, displayOrder })) })
    }
    return { applicationId: application.id, taskIds }
  })
  return { ok: true, value: { ...created, warnings: validation.value.warnings } }
}

export async function getTemplateApplication({ db = prisma, userId, applicationId }: { db?: Db; userId: string; applicationId: string }) {
  return db.trackingSetupTemplateApplication.findFirst({ where: { id: applicationId, appliedByUserId: userId }, include: { createdTasks: { select: { id: true, title: true } }, template: { select: { id: true, name: true } } } })
}

export async function getTemplateUsageSummary({ db = prisma, templateId }: { db?: Db; templateId: string }) {
  const [count, latest] = await Promise.all([db.trackingSetupTemplateApplication.count({ where: { templateId } }), db.trackingSetupTemplateApplication.findFirst({ where: { templateId }, orderBy: { createdAt: 'desc' }, include: { matchDay: { select: { id: true, opposition: true, kickoffAt: true } } } })])
  return { applicationCount: count, lastAppliedAt: latest?.createdAt ?? null, lastMatch: latest?.matchDay ?? null }
}

function templateInclude() {
  return { team: { select: { name: true } }, tasks: { include: { topic: true, events: { include: { eventDefinition: true }, orderBy: { displayOrder: 'asc' as const } }, patterns: { include: { pattern: { include: { aliases: true } } }, orderBy: { displayOrder: 'asc' as const } } }, orderBy: { displayOrder: 'asc' as const } }, applications: { orderBy: { createdAt: 'desc' as const }, take: 1 } }
}

function formatTemplateSummary(template: Prisma.TrackingSetupTemplateGetPayload<{ include: ReturnType<typeof templateInclude> }>) {
  return { id: template.id, name: template.name, description: template.description, visibility: template.visibility, clubId: template.clubId, teamId: template.teamId, teamName: template.team?.name ?? null, active: template.active, archivedAt: template.archivedAt, revision: template.revision, taskCount: template.tasks.length, eventCount: template.tasks.reduce((total, task) => total + task.events.length, 0), patternCount: template.tasks.reduce((total, task) => total + task.patterns.length, 0), scopeSummary: Array.from(new Set(template.tasks.map((task) => task.scopeType))).join(', '), updatedAt: template.updatedAt, lastUsedAt: template.applications[0]?.createdAt ?? null }
}

function formatTemplateDetail(template: Prisma.TrackingSetupTemplateGetPayload<{ include: ReturnType<typeof templateInclude> }>) {
  return { ...formatTemplateSummary(template), tasks: template.tasks.map((task) => ({ id: task.id, scopeType: task.scopeType, targetContext: task.targetContext, unitKey: task.unitKey, unitLabel: task.unitLabel, topicId: task.topicId, topicName: task.topic?.name ?? null, title: task.title, instructions: task.instructions, displayOrder: task.displayOrder, events: task.events.map((event) => ({ eventDefinitionId: event.eventDefinitionId, name: event.eventDefinition.name, displayOrder: event.displayOrder, active: event.eventDefinition.isActive && !event.eventDefinition.archivedAt })), patterns: task.patterns.map((pattern) => ({ patternId: pattern.patternId, name: pattern.pattern.name, displayOrder: pattern.displayOrder, active: pattern.pattern.active, aliases: pattern.pattern.aliases.map((alias) => alias.alias) })) })) }
}

async function validateApplication({ db, template, matchDayId, clubId, mappings }: { db: Db; template: NonNullable<Awaited<ReturnType<typeof getTrackingTemplate>>>; matchDayId: string; clubId: string; mappings: ApplyTemplateMapping[] }): Promise<Result<{ tasks: Array<TemplateBlueprintInput & { templateTaskId: string; playerId: string | null }>; warnings: string[] }>> {
  const errors: Record<string, string[]> = {}
  const addError = (key: string, message: string) => { errors[key] = [...(errors[key] ?? []), message] }
  const mappingByTask = new Map(mappings.map((mapping) => [mapping.templateTaskId, mapping]))
  const squad = await db.matchDayPlayer.findMany({ where: { matchDayId, squadStatus: { not: 'NOT_INVOLVED' } }, select: { playerId: true } })
  const squadIds = new Set(squad.map((player) => player.playerId))
  const tasks: Array<TemplateBlueprintInput & { templateTaskId: string; playerId: string | null }> = []
  for (const [index, task] of template.tasks.entries()) {
    const mapping = mappingByTask.get(task.id)
    if (mapping?.skip) continue
    if (task.events.length + task.patterns.length === 0) addError(`tasks.${index}`, 'Template task has no tracking items.')
    if (task.events.some((event) => !event.active)) addError(`tasks.${index}`, 'Template task contains an inactive event.')
    if (task.patterns.some((pattern) => !pattern.active)) addError(`tasks.${index}`, 'Template task contains an inactive tactical pattern.')
    const base = { templateTaskId: task.id, scopeType: task.scopeType, targetContext: task.targetContext, topicId: task.topicId, title: task.title, instructions: task.instructions, eventDefinitionIds: task.events.map((event) => event.eventDefinitionId), patternIds: task.patterns.map((pattern) => pattern.patternId) }
    if (task.scopeType === 'PLAYER') {
      const playerIds = unique(mapping?.playerIds ?? [])
      if (playerIds.length === 0) addError(`tasks.${index}`, 'Choose at least one destination player.')
      if ((mapping?.playerIds ?? []).length !== playerIds.length) addError(`tasks.${index}`, 'Duplicate player mappings are not allowed.')
      playerIds.forEach((playerId) => { if (!squadIds.has(playerId)) addError(`tasks.${index}`, 'Mapped player is not in the match squad.') })
      playerIds.forEach((playerId) => tasks.push({ ...base, unitKey: null, unitLabel: null, playerId }))
    } else if (task.scopeType === 'UNIT') {
      tasks.push({ ...base, unitKey: normalizeOptionalText(mapping?.unitKey) ?? task.unitKey, unitLabel: normalizeOptionalText(mapping?.unitLabel) ?? task.unitLabel, playerId: null })
    } else {
      tasks.push({ ...base, targetContext: 'WHOLE_TEAM', unitKey: null, unitLabel: null, playerId: null })
    }
  }
  const valid = await validateBlueprints({ db, clubId, tasks })
  if (!valid.ok) return valid
  const warnings = await getDuplicateWarnings({ db, matchDayId, tasks })
  if (warnings.length && !mappings.some((mapping) => mapping.allowDuplicate)) return { ok: false, reason: 'Template would create duplicate tracking tasks.', fieldErrors: { duplicates: warnings } }
  return Object.keys(errors).length ? { ok: false, reason: 'Template application is invalid.', fieldErrors: errors } : { ok: true, value: { tasks, warnings } }
}

async function getDuplicateWarnings({ db, matchDayId, tasks }: { db: Db; matchDayId: string; tasks: Array<TemplateBlueprintInput & { playerId: string | null }> }) {
  const existing = await db.matchTrackingTask.findMany({ where: { matchDayId, status: { not: 'ARCHIVED' } }, include: { events: { include: { matchDayEventType: true } }, patterns: true } })
  return tasks.flatMap((task) => existing.some((candidate) => candidate.scopeType === task.scopeType && candidate.playerId === task.playerId && candidate.unitKey === (task.unitKey ?? null) && candidate.topicId === (task.topicId ?? null) && sameSet(candidate.events.flatMap((event) => event.matchDayEventType.eventDefinitionId ? [event.matchDayEventType.eventDefinitionId] : []), task.eventDefinitionIds) && sameSet(candidate.patterns.map((pattern) => pattern.patternId), task.patternIds)) ? [`A similar task already exists for ${task.title}.`] : [])
}

const sameSet = (first: string[], second: string[]) => first.length === second.length && unique(first).every((id) => unique(second).includes(id))
