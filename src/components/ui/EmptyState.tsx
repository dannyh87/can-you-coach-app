import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  eyebrow?: string
}

export default function EmptyState({
  title,
  description,
  action,
  className = '',
  eyebrow,
}: EmptyStateProps) {
  return (
    <div className={`rounded-3xl border border-dashed border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.05)] sm:p-6 ${className}`}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
          {eyebrow}
        </p>
      )}
      <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
