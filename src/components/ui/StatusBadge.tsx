type StatusVariant = 'draft' | 'inProgress' | 'halfTime' | 'completed' | 'active' | 'archived' | 'neutral'

type StatusBadgeProps = {
  label: string
  variant?: StatusVariant
  className?: string
}

const variantClasses: Record<StatusVariant, string> = {
  draft: 'border-slate-200 bg-slate-100 text-slate-700',
  inProgress: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  halfTime: 'border-amber-200 bg-amber-100 text-amber-900',
  completed: 'border-green-200 bg-green-100 text-green-800',
  active: 'border-green-200 bg-green-100 text-green-800',
  archived: 'border-slate-200 bg-slate-100 text-slate-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
}

export default function StatusBadge({ label, variant = 'neutral', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${variantClasses[variant]} ${className}`}>
      {label}
    </span>
  )
}

export const getStatusBadgeVariant = (status: string): StatusVariant => {
  const normalizedStatus = status.trim().toUpperCase().replaceAll(' ', '_')

  if (normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'LIVE') return 'inProgress'
  if (normalizedStatus === 'HALF_TIME') return 'halfTime'
  if (normalizedStatus === 'COMPLETED') return 'completed'
  if (normalizedStatus === 'DRAFT' || normalizedStatus === 'CREATED') return 'draft'
  if (normalizedStatus === 'ACTIVE') return 'active'
  if (normalizedStatus === 'ARCHIVED') return 'archived'
  return 'neutral'
}
