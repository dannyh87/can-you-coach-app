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
    DRAFT: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
  }

  return classes[status]
}
