import type { FitnessTestSessionStatus } from '@prisma/client'

export const formatFitnessSessionStatus = (status: FitnessTestSessionStatus) => {
  const labels: Record<FitnessTestSessionStatus, string> = {
    DRAFT: 'Created',
    IN_PROGRESS: 'Live',
    COMPLETED: 'Completed',
  }

  return labels[status]
}

export const getFitnessSessionStatusClasses = (
  status: FitnessTestSessionStatus
) => {
  const classes: Record<FitnessTestSessionStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-green-100 text-green-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
  }

  return classes[status]
}
