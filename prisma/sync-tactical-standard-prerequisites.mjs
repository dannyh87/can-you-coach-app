import { PrismaClient } from '@prisma/client'
import {
  getCanonicalStandardPrerequisiteEventDefinition,
  tacticalPresetStandardPrerequisiteDefinitions,
} from '../src/lib/teamTacticalCatalogue.mjs'
import { printTacticalPresetDependencyReport, verifyTacticalPresetDependencies } from './verify-tactical-presets.mjs'

const prisma = new PrismaClient()
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const dryRun = !apply

if (args.has('--help')) {
  console.log('Usage: node prisma/sync-tactical-standard-prerequisites.mjs [--dry-run] [--apply]')
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

function validatePrerequisites() {
  const conflicts = []
  for (const field of ['stableId', 'name']) {
    const seen = new Set()
    for (const definition of tacticalPresetStandardPrerequisiteDefinitions) {
      const value = definition[field]
      if (seen.has(value)) conflicts.push(`Duplicate prerequisite ${field}: ${value}`)
      seen.add(value)
    }
  }
  return conflicts
}

async function main() {
  const desiredDefinitions = tacticalPresetStandardPrerequisiteDefinitions.map((definition) => ({
    definition,
    data: getCanonicalStandardPrerequisiteEventDefinition(definition),
  }))
  const desiredIds = desiredDefinitions.map(({ definition }) => definition.stableId)
  const desiredNormalizedNames = desiredDefinitions.map(({ data }) => data.normalizedName)
  const desiredSlugs = desiredDefinitions.map(({ data }) => data.slug)

  const existingDefinitions = await prisma.eventDefinition.findMany({
    where: {
      OR: [
        { id: { in: desiredIds } },
        { scope: 'GLOBAL', clubId: null, normalizedName: { in: desiredNormalizedNames } },
        { scope: 'GLOBAL', clubId: null, slug: { in: desiredSlugs } },
        { legacyEventType: { not: null }, normalizedName: { in: desiredNormalizedNames } },
      ],
    },
    orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
  })

  const byId = new Map(existingDefinitions.map((definition) => [definition.id, definition]))
  const additions = []
  const updates = []
  const unchanged = []
  const conflicts = validatePrerequisites()

  for (const { definition, data } of desiredDefinitions) {
    const candidates = existingDefinitions.filter((existing) =>
      existing.id === definition.stableId
      || (existing.scope === 'GLOBAL' && existing.clubId === null && (existing.normalizedName === data.normalizedName || existing.slug === data.slug))
      || (existing.legacyEventType !== null && existing.normalizedName === data.normalizedName)
    )
    const uniqueCandidates = Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values())

    if (uniqueCandidates.length > 1) {
      conflicts.push(`${data.name}: multiple existing candidates (${uniqueCandidates.map((candidate) => `${candidate.id}/${candidate.name}`).join(', ')}).`)
      continue
    }

    const existing = uniqueCandidates[0] ?? byId.get(definition.stableId)
    if (!existing) {
      additions.push({ id: definition.stableId, data })
      continue
    }

    if (existing.scope !== 'GLOBAL' || existing.clubId !== null || existing.legacyEventType !== null) {
      conflicts.push(`${data.name}: existing candidate ${existing.id} is not a standalone global standard definition; no update authorised.`)
      continue
    }

    const meaningChanges = getChangedFields(existing, data, meaningFields)
    if (meaningChanges.length > 0) {
      conflicts.push(`${data.name}: existing row ${existing.id} differs on meaning fields (${meaningChanges.join(', ')}); no update authorised.`)
      continue
    }

    const changedFields = getChangedFields(existing, data)
    if (changedFields.length === 0) unchanged.push({ id: existing.id, name: data.name })
    else updates.push({ id: existing.id, data, changedFields })
  }

  console.log(`Tactical standard prerequisite sync (${dryRun ? 'dry-run' : 'apply'})`)
  console.log(`Intended prerequisite definitions checked: ${desiredDefinitions.length}`)
  console.log(`Proposed additions: ${additions.length}`)
  console.log(`Proposed updates: ${updates.length}`)
  console.log(`Unchanged intended prerequisites: ${unchanged.length}`)
  console.log(`Conflicts: ${conflicts.length}`)

  for (const addition of additions) console.log(`ADD ${addition.id} ${addition.data.name}`)
  for (const update of updates) console.log(`UPDATE ${update.id} ${update.data.name}: ${update.changedFields.join(', ')}`)
  for (const conflict of conflicts) console.log(`CONFLICT ${conflict}`)

  const presetDependencyFailures = printTacticalPresetDependencyReport(await verifyTacticalPresetDependencies(prisma))

  if (conflicts.length > 0 || (dryRun && additions.length === 0 && presetDependencyFailures > 0)) {
    console.log('No changes applied because conflicts or unresolved preset dependencies were found.')
    process.exitCode = 1
    return
  }

  if (dryRun) {
    console.log('Dry-run only. Re-run with --apply to write these prerequisite definitions.')
    return
  }

  for (const addition of additions) await prisma.eventDefinition.create({ data: { id: addition.id, ...addition.data } })
  for (const update of updates) await prisma.eventDefinition.update({ where: { id: update.id }, data: update.data })
  console.log('Applied tactical standard prerequisite sync.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
