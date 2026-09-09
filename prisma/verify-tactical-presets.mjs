import { PrismaClient } from '@prisma/client'
import { tacticalPresets } from '../src/lib/teamTacticalCatalogue.mjs'

const prisma = new PrismaClient()
const maxPresetDefinitions = 6

export async function verifyTacticalPresetDependencies(client = prisma) {
  const dependencyNames = Array.from(new Set(tacticalPresets.flatMap((preset) => preset.eventNames)))
  const definitions = await client.eventDefinition.findMany({
    where: {
      scope: 'GLOBAL',
      clubId: null,
      name: { in: dependencyNames },
    },
    select: { id: true, name: true, isActive: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  const byName = new Map()
  for (const definition of definitions) byName.set(definition.name, [...(byName.get(definition.name) ?? []), definition])

  return tacticalPresets.map((preset) => {
    const missing = []
    const inactive = []
    const duplicates = []
    for (const eventName of preset.eventNames) {
      const matches = byName.get(eventName) ?? []
      const activeMatches = matches.filter((definition) => definition.isActive)
      if (matches.length === 0) missing.push(eventName)
      else if (activeMatches.length === 0) inactive.push(eventName)
      else if (activeMatches.length > 1) duplicates.push(eventName)
    }
    const overLimit = preset.eventNames.length > maxPresetDefinitions
    return {
      key: preset.key,
      dependencyCount: preset.eventNames.length,
      ok: missing.length === 0 && inactive.length === 0 && duplicates.length === 0 && !overLimit,
      missing,
      inactive,
      duplicates,
      overLimit,
    }
  })
}

export function printTacticalPresetDependencyReport(results) {
  let failures = 0
  for (const result of results) {
    if (!result.ok) failures += 1
    console.log(`${result.ok ? 'PRESET OK' : 'PRESET FAIL'} ${result.key}: ${result.dependencyCount} dependencies${result.missing.length ? ` missing=${result.missing.join('|')}` : ''}${result.inactive.length ? ` inactive=${result.inactive.join('|')}` : ''}${result.duplicates.length ? ` duplicate=${result.duplicates.join('|')}` : ''}${result.overLimit ? ' over-limit' : ''}`)
  }
  return failures
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyTacticalPresetDependencies()
    .then((results) => {
      const failures = printTacticalPresetDependencyReport(results)
      if (failures > 0) process.exitCode = 1
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
