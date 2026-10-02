import 'dotenv/config'
import { Prisma, PrismaClient } from '@prisma/client'
import { parseArgs } from 'node:util'

import { makePlan, counts, PREFIX, CLUB_ID, OWNER_ID, assertNoForeignReferences } from './demo-data.mjs'

const DEFAULT_EMAIL = 'dannyh87@hotmail.co.uk'
const LIVE_CONFIRMATION = 'LIVE_DEMO_DATA'
const PARENT_ID = `${PREFIX}parent`
const DEMO_USER_IDS = [PARENT_ID]

const mask = value => value ? `${value.slice(0, 6)}...${value.slice(-4)}` : null
const normalizeEmail = value => value.trim().toLowerCase()

function requireLiveConfirmation() {
  if (process.env[LIVE_CONFIRMATION] !== 'true') {
    throw new Error(`Refusing live demo seed. Set ${LIVE_CONFIRMATION}=true for this explicit live-only command.`)
  }
}

function databaseTargetSummary(url) {
  const target = new URL(url)
  return {
    protocol: target.protocol,
    host: target.hostname,
    port: target.port || (target.protocol === 'postgres:' || target.protocol === 'postgresql:' ? '5432' : ''),
    database: target.pathname.slice(1),
    schema: target.searchParams.get('schema') ?? null,
    sslmode: target.searchParams.get('sslmode') ?? null,
  }
}

function makeLivePlan(options, ownerUserId) {
  const plan = makePlan(options)
  const liveMarker = JSON.stringify({ ...JSON.parse(plan.marker), live: true, ownerEmail: options.email })

  plan.marker = liveMarker
  plan.rows.user = (plan.rows.user ?? []).filter(row => row.id !== OWNER_ID)

  for (const row of Object.values(plan.rows).flat()) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && value === OWNER_ID && (key === 'userId' || key.endsWith('UserId') || key === 'acceptedByUserId')) {
        row[key] = ownerUserId
      }
    }
  }

  const club = plan.rows.club.find(row => row.id === CLUB_ID)
  club.userId = ownerUserId
  club.notes = liveMarker

  const membership = plan.rows.clubMembership.find(row => row.id === `${PREFIX}membership`)
  membership.userId = ownerUserId
  membership.role = 'OWNER'

  return plan
}

function liveCounts(plan) {
  return counts(plan)
}

async function upsertCatalogue(tx, plan) {
  const replacements = new Map()
  const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const normalized = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

  for (const definition of plan.definitions) {
    const found = definition.legacyEventType
      ? await tx.eventDefinition.findUnique({ where: { legacyEventType: definition.legacyEventType } })
      : await tx.eventDefinition.findFirst({ where: { scope: 'GLOBAL', clubId: null, normalizedName: normalized(definition.name) } })
    if (found && (!found.isActive || found.archivedAt)) throw new Error(`Required definition is inactive: ${definition.name}`)
    const data = Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'stableId'))
    const saved = found ?? await tx.eventDefinition.create({ data: { ...data, id: `cyc_catalogue_${slug(data.name)}`, scope: 'GLOBAL', slug: slug(data.name), normalizedName: normalized(data.name), enabledByDefault: data.enabledByDefault ?? true, benchmarkable: data.benchmarkable ?? true, requiresLocation: data.requiresLocation ?? false, isActive: data.isActive ?? true, archivedAt: data.archivedAt ?? null } })
    replacements.set(`catalogue_${slug(data.name)}`, saved.id)
  }

  const fitness = await tx.fitnessTestType.findFirst({ where: { userId: null, name: 'Yo-Yo Test', isDefault: true } }) ?? await tx.fitnessTestType.create({ data: { ...plan.fitnessDefinition, id: 'cyc_catalogue_yoyo' } })
  replacements.set('fitness_yoyo', fitness.id)

  return replacements
}

async function assertExistingDataset(tx, plan) {
  const expected = liveCounts(plan)
  for (const [model, count] of Object.entries(expected)) {
    const actual = await tx[model].count({ where: { id: { startsWith: PREFIX } } })
    if (actual !== count) throw new Error(`Demo ${model} count has changed; cleanup explicitly rather than silently repairing user edits.`)
  }
  return expected
}

async function applyLivePlan(db, plan, { dryRun = false, cleanup = false } = {}) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(76391427)::text`

    const existing = await tx.club.findUnique({ where: { id: CLUB_ID } })
    if (existing && existing.notes !== plan.marker) throw new Error('Existing demo club marker differs. Refusing to modify or clean up an unknown dataset.')

    if (cleanup) {
      if (!existing) return { action: 'absent', counts: {} }
      await assertNoForeignReferences(tx)
      const expected = await assertExistingDataset(tx, plan)
      if (!dryRun) {
        await tx.club.delete({ where: { id: CLUB_ID } })
        await tx.user.deleteMany({ where: { id: { in: DEMO_USER_IDS } } })
      }
      return { action: dryRun ? 'would-cleanup' : 'cleanup', counts: expected }
    }

    if (existing) {
      const expected = await assertExistingDataset(tx, plan)
      return { action: 'already-exists', counts: expected }
    }

    if (dryRun) return { action: 'would-create', counts: liveCounts(plan) }

    const replacements = await upsertCatalogue(tx, plan)
    for (const model of ['user', 'club', 'clubMembership', 'team', 'player', 'spectatorAccess', 'matchDay', 'matchDayPlayer', 'matchPlayerStint', 'matchDayEventType', 'tacticalSequence', 'submittedMatchEvent', 'matchEvent', 'fitnessTestSession', 'fitnessTestResult']) {
      const data = (plan.rows[model] ?? []).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' && key.endsWith('Id') ? replacements.get(value) ?? value : value])))
      for (let start = 0; start < data.length; start += 200) await tx[model].createMany({ data: data.slice(start, start + 200) })
    }

    return { action: 'created', counts: liveCounts(plan) }
  }, { timeout: 180000, maxWait: 10000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

async function verifyLiveDataset(db, plan, owner) {
  const [club, membership, teams, players, matches, fitnessSessions, parent, demoUserCount] = await Promise.all([
    db.club.findUnique({ where: { id: CLUB_ID }, select: { id: true, name: true, userId: true, notes: true } }),
    db.clubMembership.findUnique({ where: { userId_clubId: { userId: owner.id, clubId: CLUB_ID } }, select: { id: true, role: true, userId: true, clubId: true } }),
    db.team.count({ where: { id: { startsWith: PREFIX }, clubId: CLUB_ID } }),
    db.player.count({ where: { id: { startsWith: PREFIX }, team: { clubId: CLUB_ID } } }),
    db.matchDay.count({ where: { id: { startsWith: PREFIX }, team: { clubId: CLUB_ID } } }),
    db.fitnessTestSession.count({ where: { id: { startsWith: PREFIX }, team: { clubId: CLUB_ID } } }),
    db.user.findUnique({ where: { id: PARENT_ID }, select: { id: true, email: true } }),
    db.user.count({ where: { id: { startsWith: PREFIX } } }),
  ])

  if (!club) throw new Error('Demo club was not found after seeding.')
  if (club.userId !== owner.id) throw new Error('Demo club owner userId does not match target account.')
  if (club.notes !== plan.marker) throw new Error('Demo club marker does not match the live plan.')
  if (!membership || membership.role !== 'OWNER') throw new Error('OWNER membership was not found for the target account.')
  if (!parent) throw new Error('Demo parent fixture was not found.')

  return {
    club: { id: club.id, name: club.name, ownerUserId: mask(club.userId) },
    membership: { id: membership.id, role: membership.role, userId: mask(membership.userId), clubId: membership.clubId },
    relatedCounts: { teams, players, matches, fitnessSessions, demoUsers: demoUserCount },
  }
}

async function main() {
  requireLiveConfirmation()
  const { values } = parseArgs({ options: { email: { type: 'string', default: DEFAULT_EMAIL }, seed: { type: 'string', default: '2026' }, 'as-of': { type: 'string' }, 'dry-run': { type: 'boolean' }, cleanup: { type: 'boolean' } } })
  const email = normalizeEmail(values.email)
  const db = new PrismaClient()

  try {
    const owner = await db.user.findUnique({ where: { email }, select: { id: true, email: true, clerkUserId: true } })
    if (!owner) throw new Error(`Target account was not found: ${email}`)

    const plan = makeLivePlan({ seed: values.seed, asOf: values['as-of'], tactical: process.env.MATCH_DAY_CUSTOM_OBSERVATIONS === 'true', email }, owner.id)
    const [identity] = await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, inet_server_addr()::text AS address, version() AS version`
    const result = await applyLivePlan(db, plan, { dryRun: values['dry-run'], cleanup: values.cleanup })
    const verification = values['dry-run'] || (values.cleanup && result.action !== 'absent') ? null : await verifyLiveDataset(db, plan, owner)

    console.log(JSON.stringify({
      target: databaseTargetSummary(process.env.DATABASE_URL),
      identity: { database: identity.database, schema: identity.schema, address: identity.address, version: String(identity.version).split(' ')[0] },
      owner: { id: mask(owner.id), email: owner.email, clerkUserId: mask(owner.clerkUserId) },
      options: { seed: plan.seed, asOf: plan.asOf, tactical: plan.tactical, cleanup: Boolean(values.cleanup), dryRun: Boolean(values['dry-run']) },
      ...result,
      verification,
    }, null, 2))
  } finally {
    await db.$disconnect()
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1 })
