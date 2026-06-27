import type { ReactNode } from 'react'

type SectionCardProps = {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  variant?: 'standard' | 'compact'
}

const variantClasses = {
  standard: 'rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_14px_35px_rgba(15,23,42,0.055)]',
  compact: 'rounded-xl border border-slate-200/80 bg-white/95 shadow-sm',
}

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = '',
  variant = 'standard',
}: SectionCardProps) {
  const hasHeader = title || description || actions

  return (
    <section className={`overflow-hidden ${variantClasses[variant]} ${className}`}>
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50/70 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            {title && <h2 className="text-xl font-bold text-slate-950">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
        </div>
      )}
      <div className={`${hasHeader ? 'p-4 sm:p-5' : 'p-4 sm:p-5'} ${bodyClassName}`}>{children}</div>
    </section>
  )
}
