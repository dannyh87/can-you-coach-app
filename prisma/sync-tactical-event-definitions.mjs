import { PrismaClient } from '@prisma/client'
import {
  getCanonicalTacticalEventDefinition,
  tacticalPresets,
  teamTacticalEventDefinitions,
} from '../src/lib/teamTacticalCatalogue.mjs'
import { printTacticalPresetDependencyReport, verifyTacticalPresetDependencies } from './verify-tactical-presets.mjs'

const prisma = new PrismaClient()
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const dryRun = !apply

if (args.has('--help')) {
  console.log('Usage: node prisma/sync-tactical-event-definitions.mjs [--dry-run] [--apply]')
  console.log('Defaults to --dry-run. --apply is required to write changes.')
  process.exit(0)
}

if (apply && args.has('--dry-run')) {
  console.error('Use either --dry-run or --apply, not both.')
  process.exit(1)
}

const comparableFields = [
  'name',
  'description',
  'slug',
  'matchPhase',
  'category',
  'subcategory',
  'matchDayGroup',
  'agePhases',
  'fourCorner',
  'positionRelevance',
  'enabledByDefault',
  'benchmarkable',
  'requiresLocation',
  'isActive',
  'archivedAt',
]

const meaningFields = [
  'name',
  'description',
  'matchPhase',
  'category',
  'subcategory',
  'matchDayGroup',
  'agePhases',
  'fourCorner',
  'positionRelevance',
  'benchmarkable',
]

function normalizeForCompare(value) {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return [...value].sort()
  return value ?? null
}

function valuesEqual(first, second) {
  return JSON.stringify(normalizeForCompare(first)) === JSON.stringify(normalizeForCompare(second))
}

function getChangedFields(existing, desired, fields = comparableFields) {
  return fields.filter((field) => !valuesEqual(existing[field], desired[field]))
}

function isKnownTacticalRow(existing, desired, definition) {
  if (existing.id === definition.stableId) return true
  return existing.scope === 'GLOBAL'
    && existing.clubId === null
    && existing.legacyEventType === null
    && existing.slug === desired.slug
    && typeof existing.subcategory === 'string'
    && existing.subcategory.startsWith('Team tactical - ')
    && existing.benchmarkable === false
}

function validateCatalogue() {
  const conflicts = []
  for (const field of ['stableId', 'name']) {
    const seen = new Set()
    for (const definition of teamTacticalEventDefinitions) {
      const value = definition[field]
      if (seen.has(value)) conflicts.push(`Duplicate tactical ${field}: ${value}`)
      seen.add(value)
    }
  }

  const definitionNames = new Set(teamTacticalEventDefinitions.map((definition) => definition.name))
  for (const preset of tacticalPresets) {
    if (preset.eventNames.length === 0) conflicts.push(`Preset ${preset.key} has no events.`)
    const presetNames = new Set()
    for (const eventName of preset.eventNames) {
      if (presetNames.has(eventName)) conflicts.push(`Preset ${preset.key} duplicates ${eventName}.`)
      presetNames.add(eventName)
      if (!definitionNames.has(eventName) && eventName !== 'Ball recovery') {
        conflicts.push(`Preset ${preset.key} references missing tactical definition ${eventName}.`)
      }
    }
  }
  return conflicts
}

async function main() {
  const catalogueConflicts = validateCatalogue()
  const desiredDefinitions = teamTacticalEventDefinitions.map((definition) => ({
    definition,
    data: getCanonicalTacticalEventDefinition(definition),
  }))
  const desiredNormalizedNames = desiredDefinitions.map(({ data }) => data.normalizedName)
  const desiredSlugs = desiredDefinitions.map(({ data }) => data.slug)
  const desiredIds = desiredDefinitions.map(({ definition }) => definition.stableId)

  const existingDefinitions = await prisma.eventDefinition.findMany({
    where: {
      OR: [
        { id: { in: desiredIds } },
        { scope: 'GLOBAL', clubId: null, normalizedName: { in: desiredNormalizedNames } },
        { scope: 'GLOBAL', clubId: null, slug: { in: desiredSlugs } },
      ],
    },
    orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
  })

  const byId = new Map(existingDefinitions.map((definition) => [definition.id, definition]))
  const byNormalizedName = new Map()
  const bySlug = new Map()
  for (const existing of existingDefinitions) {
    if (existing.scope === 'GLOBAL' && existing.clubId === null) {
      byNormalizedName.set(existing.normalizedName, [...(byNormalizedName.get(existing.normalizedName) ?? []), existing])
      bySlug.set(existing.slug, [...(bySlug.get(existing.slug) ?? []), existing])
    }
  }

  const additions = []
  const updates = []
  const unchanged = []
  const conflicts = [...catalogueConflicts]

  for (const { definition, data } of desiredDefinitions) {
    const idMatch = byId.get(definition.stableId)
    const nameMatches = byNormalizedName.get(data.normalizedName) ?? []
    const slugMatches = bySlug.get(data.slug) ?? []
    const candidates = Array.from(new Map([idMatch, ...nameMatches, ...slugMatches].filter(Boolean).map((candidate) => [candidate.id, candidate])).values())

    if (candidates.length > 1) {
      conflicts.push(`${data.name}: multiple existing global candidates (${candidates.map((candidate) => `${candidate.id}/${candidate.name}`).join(', ')}).`)
      continue
    }

    const existing = candidates[0]
    if (!existing) {
      additions.push({ id: definition.stableId, data })
      continue
    }

    if (!isKnownTacticalRow(existing, data, definition)) {
      conflicts.push(`${data.name}: existing row ${existing.id} is not safely identifiable as an app-owned tactical definition; no update authorised.`)
      continue
    }

    const meaningChanges = getChangedFields(existing, data, meaningFields)
    if (existing.id !== definition.stableId && meaningChanges.length > 0) {
      conflicts.push(`${data.name}: existing row ${existing.id} differs on meaning fields (${meaningChanges.join(', ')}); no update authorised.`)
      continue
    }

    const changedFields = getChangedFields(existing, data)
    if (changedFields.length === 0) unchanged.push({ id: existing.id, name: data.name })
    else updates.push({ id: existing.id, data, changedFields })
  }

  console.log(`Tactical definition sync (${dryRun ? 'dry-run' : 'apply'})`)
  console.log(`Intended definitions checked: ${desiredDefinitions.length}`)
  console.log(`Presets checked: ${tacticalPresets.length}`)
  console.log(`Proposed additions: ${additions.length}`)
  console.log(`Proposed updates: ${updates.length}`)
  console.log(`Unchanged intended definitions: ${unchanged.length}`)
  console.log(`Conflicts: ${conflicts.length}`)

  for (const addition of additions) {
    console.log(`ADD ${addition.id} ${addition.data.name}`)
  }
  for (const update of updates) {
    console.log(`UPDATE ${update.id} ${update.data.name}: ${update.changedFields.join(', ')}`)
  }
  for (const conflict of conflicts) {
    console.log(`CONFLICT ${conflict}`)
  }

  const presetDependencyFailures = printTacticalPresetDependencyReport(await verifyTacticalPresetDependencies(prisma))

  if (conflicts.length > 0 || presetDependencyFailures > 0) {
    console.log('No changes applied because conflicts or unresolved preset dependencies were found.')
    process.exitCode = 1
    return
  }

  if (dryRun) {
    console.log('Dry-run only. Re-run with --apply to write these intended tactical definitions.')
    return
  }

  for (const addition of additions) {
    await prisma.eventDefinition.create({ data: { id: addition.id, ...addition.data } })
  }
  for (const update of updates) {
    await prisma.eventDefinition.update({ where: { id: update.id }, data: update.data })
  }
  console.log('Applied tactical definition sync.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
