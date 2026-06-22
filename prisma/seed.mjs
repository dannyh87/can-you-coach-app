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
