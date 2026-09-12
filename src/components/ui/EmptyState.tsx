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
    <div className={`rounded-3xl border border-dashed border-[rgba(6,186,169,0.32)] bg-gradient-to-br from-white to-[rgba(230,248,246,0.55)] p-5 shadow-[0_14px_35px_rgba(7,42,72,0.05)] sm:p-6 ${className}`}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--brand-teal-dark)]">
          {eyebrow}
        </p>
      )}
      <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
