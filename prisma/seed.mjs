import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const localUser = {
  email: 'local-coach@can-you-coach.local',
  passwordHash: 'local-mvp-user',
}

const demoClub = {
  name: 'Demo Club',
  location: 'Local development',
  notes: 'Seeded demo club for local MVP development.',
}

const demoTeam = {
  name: 'Brereton Social',
  ageGroup: 'Open Age',
  season: '2026',
  league: 'Demo League',
  footballPyramidStep: 'Grassroots',
}

const demoPlayers = [
  {
    firstName: 'Alex',
    surname: 'Taylor',
    squadNumber: 1,
    preferredPosition: 'Goalkeeper',
  },
  {
    firstName: 'Sam',
    surname: 'Jones',
    squadNumber: 4,
    preferredPosition: 'Centre Back',
  },
  {
    firstName: 'Charlie',
    surname: 'Morgan',
    squadNumber: 8,
    preferredPosition: 'Central Midfielder',
  },
  {
    firstName: 'Riley',
    surname: 'Smith',
    squadNumber: 10,
    preferredPosition: 'Striker',
  },
]

const fitnessTestTypes = [
  {
    name: 'Yo-Yo Test',
    description: 'Intermittent fitness test used to assess endurance and recovery ability.',
    resultUnit: 'Metres',
    higherIsBetter: true,
    allowedRecordingModes: 'MANUAL,LIVE_DROPOUT',
    preferredRecordingMode: 'LIVE_DROPOUT',
    isDefault: true,
  },
  {
    name: 'Gacon Test',
    description: 'Progressive running test used to assess aerobic fitness.',
    resultUnit: 'Metres',
    higherIsBetter: true,
    allowedRecordingModes: 'MANUAL,LIVE_DROPOUT',
    preferredRecordingMode: 'LIVE_DROPOUT',
    isDefault: true,
  },
  {
    name: 'Bleep Test',
    description: 'Multi-stage shuttle run test.',
    resultUnit: 'Level',
    higherIsBetter: true,
    allowedRecordingModes: 'MANUAL,LIVE_DROPOUT',
    preferredRecordingMode: 'LIVE_DROPOUT',
    isDefault: true,
  },
  {
    name: 'Bronco Test',
    description: 'Repeated shuttle run completed as quickly as possible.',
    resultUnit: 'Seconds',
    higherIsBetter: false,
    allowedRecordingModes: 'MANUAL,LIVE_TIMED_FINISH',
    preferredRecordingMode: 'LIVE_TIMED_FINISH',
    isDefault: true,
  },
]

const eventDefinitionSynonyms = {
  completed: 'complete',
  successful: 'complete',
  failed: 'incomplete',
  unsuccessful: 'incomplete',
  accurate: 'target',
  dribble: '1v1',
  dribbling: '1v1',
}

const normalizeEventDefinitionName = (name) =>
  name
    .toLowerCase()
    .replace(/one\s+v\s+one/g, '1v1')
    .replace(/1\s*v\s*1/g, '1v1')
    .replace(/on\s+target/g, 'target')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => eventDefinitionSynonyms[token] ?? token)
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token))
    .sort()
    .join(' ')

const createEventDefinitionSlug = (name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'event'
}

const matchEventDefinitions = [
  {
    legacyEventType: 'GOAL',
    name: 'Goal',
    description: 'A goal scored by the player or team.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD'],
  },
  {
    legacyEventType: 'ASSIST',
    name: 'Assist',
    description: 'The final action that directly creates a goal.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TACTICAL',
    positionRelevance: ['ALL', 'MIDFIELDER', 'FORWARD', 'WIDE_PLAYER'],
  },
  {
    legacyEventType: 'SHOT_ON_TARGET',
    name: 'Shot on target',
    description: 'A shot that tests the goalkeeper or would enter the goal without intervention.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
  },
  {
    legacyEventType: 'SHOT_OFF_TARGET',
    name: 'Shot off target',
    description: 'A shot that misses the target.',
    matchPhase: 'IN_POSSESSION',
    category: 'SHOOTING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'MIDFIELDER'],
  },
  {
    legacyEventType: 'PASS_COMPLETE',
    name: 'Pass complete',
    description: 'A pass successfully received by a teammate.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
  },
  {
    legacyEventType: 'PASS_INCOMPLETE',
    name: 'Pass incomplete',
    description: 'A pass that does not reach a teammate.',
    matchPhase: 'IN_POSSESSION',
    category: 'PASSING',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
  },
  {
    legacyEventType: 'ONE_V_ONE_SUCCESS',
    name: '1v1 success',
    description: 'A successful attacking 1v1 or dribble action.',
    matchPhase: 'IN_POSSESSION',
    category: 'DRIBBLING_1V1',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'WIDE_PLAYER'],
  },
  {
    legacyEventType: 'ONE_V_ONE_UNSUCCESSFUL',
    name: '1v1 unsuccessful',
    description: 'An attacking 1v1 or dribble action that is not completed successfully.',
    matchPhase: 'IN_POSSESSION',
    category: 'DRIBBLING_1V1',
    agePhases: ['YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL', 'FORWARD', 'WIDE_PLAYER'],
  },
  {
    legacyEventType: 'TOUCH',
    name: 'Touch',
    description: 'A recorded player touch on the pitch.',
    matchPhase: 'IN_POSSESSION',
    category: 'RECEIVING',
    agePhases: ['FOUNDATION', 'YOUTH', 'ADULT'],
    fourCorner: 'TECHNICAL',
    positionRelevance: ['ALL'],
    requiresLocation: true,
  },
]

async function main() {
  const user = await prisma.user.upsert({
    where: { email: localUser.email },
    update: {},
    create: localUser,
  })

  let club = await prisma.club.findFirst({
    where: {
      userId: user.id,
      name: demoClub.name,
    },
  })

  if (club) {
    club = await prisma.club.update({
      where: { id: club.id },
      data: demoClub,
    })
  } else {
    club = await prisma.club.create({
      data: {
        ...demoClub,
        userId: user.id,
      },
    })
  }

  await prisma.clubMembership.upsert({
    where: {
      userId_clubId: {
        userId: user.id,
        clubId: club.id,
      },
    },
    update: {
      role: 'OWNER',
    },
    create: {
      userId: user.id,
      clubId: club.id,
      role: 'OWNER',
    },
  })

  let team = await prisma.team.findFirst({
    where: {
      clubId: club.id,
      name: demoTeam.name,
      season: demoTeam.season,
    },
  })

  if (team) {
    team = await prisma.team.update({
      where: { id: team.id },
      data: demoTeam,
    })
  } else {
    team = await prisma.team.create({
      data: {
        ...demoTeam,
        clubId: club.id,
      },
    })
  }

  for (const demoPlayer of demoPlayers) {
    const existingPlayer = await prisma.player.findFirst({
      where: {
        teamId: team.id,
        firstName: demoPlayer.firstName,
        surname: demoPlayer.surname,
      },
    })

    if (existingPlayer) {
      await prisma.player.update({
        where: { id: existingPlayer.id },
        data: {
          ...demoPlayer,
          isActive: true,
        },
      })
    } else {
      await prisma.player.create({
        data: {
          ...demoPlayer,
          teamId: team.id,
        },
      })
    }
  }

  for (const fitnessTestType of fitnessTestTypes) {
    const existingFitnessTestType = await prisma.fitnessTestType.findFirst({
      where: {
        userId: null,
        name: fitnessTestType.name,
        isDefault: true,
      },
    })

    if (existingFitnessTestType) {
      await prisma.fitnessTestType.update({
        where: { id: existingFitnessTestType.id },
        data: fitnessTestType,
      })
    } else {
      await prisma.fitnessTestType.create({
        data: fitnessTestType,
      })
    }
  }

  for (const eventDefinition of matchEventDefinitions) {
    const data = {
      ...eventDefinition,
      scope: 'GLOBAL',
      slug: createEventDefinitionSlug(eventDefinition.name),
      normalizedName: normalizeEventDefinitionName(eventDefinition.name),
      enabledByDefault: true,
      benchmarkable: true,
      requiresLocation: eventDefinition.requiresLocation ?? false,
      isActive: true,
      archivedAt: null,
    }

    await prisma.eventDefinition.upsert({
      where: { legacyEventType: eventDefinition.legacyEventType },
      update: data,
      create: data,
    })
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
