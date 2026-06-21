import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
