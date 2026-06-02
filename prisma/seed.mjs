import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const fitnessTestTypes = [
  {
    name: 'Yo-Yo Test',
    description: 'Intermittent fitness test used to assess endurance and recovery ability.',
    resultUnit: 'Metres',
    higherIsBetter: true,
    isDefault: true,
  },
  {
    name: 'Gacon Test',
    description: 'Progressive running test used to assess aerobic fitness.',
    resultUnit: 'Metres',
    higherIsBetter: true,
    isDefault: true,
  },
  {
    name: 'Bleep Test',
    description: 'Multi-stage shuttle run test.',
    resultUnit: 'Level',
    higherIsBetter: true,
    isDefault: true,
  },
  {
    name: 'Bronco Test',
    description: 'Repeated shuttle run completed as quickly as possible.',
    resultUnit: 'Seconds',
    higherIsBetter: false,
    isDefault: true,
  },
]

async function main() {
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
