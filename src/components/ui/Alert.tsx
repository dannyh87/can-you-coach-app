import type { ReactNode } from 'react'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

type AlertProps = {
  children: ReactNode
  variant?: AlertVariant
  className?: string
}

const variantClasses: Record<AlertVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
}

export default function Alert({ children, variant = 'info', className = '' }: AlertProps) {
  return (
    <p className={`rounded-lg border p-3 text-sm font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </p>
  )
}
