type StatusVariant = 'draft' | 'inProgress' | 'halfTime' | 'completed' | 'active' | 'archived' | 'neutral'

type StatusBadgeProps = {
  label: string
  variant?: StatusVariant
  className?: string
}

const variantClasses: Record<StatusVariant, string> = {
  draft: 'bg-slate-100 text-slate-700',
  inProgress: 'bg-blue-100 text-blue-800',
  halfTime: 'bg-amber-100 text-amber-900',
  completed: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-slate-100 text-slate-700',
  neutral: 'bg-slate-100 text-slate-700',
}

export default function StatusBadge({ label, variant = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${variantClasses[variant]} ${className}`}>
      {label}
    </span>
  )
}

export const getStatusBadgeVariant = (status: string): StatusVariant => {
  if (status === 'IN_PROGRESS') return 'inProgress'
  if (status === 'HALF_TIME') return 'halfTime'
  if (status === 'COMPLETED') return 'completed'
  if (status === 'DRAFT') return 'draft'
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  return 'neutral'
}
