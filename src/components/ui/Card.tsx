import type { ReactNode } from 'react'

type CardVariant = 'standard' | 'compact'

type CardProps = {
  children: ReactNode
  variant?: CardVariant
  className?: string
}

const variantClasses: Record<CardVariant, string> = {
  standard: 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5',
  compact: 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm',
}

export default function Card({ children, variant = 'standard', className = '' }: CardProps) {
  return <div className={`${variantClasses[variant]} ${className}`}>{children}</div>
}
