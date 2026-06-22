import Link from 'next/link'
import type { ReactNode } from 'react'

type ActionLinkVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ActionLinkSize = 'sm' | 'md' | 'lg'

type ActionLinkProps = {
  href: string
  children: ReactNode
  variant?: ActionLinkVariant
  size?: ActionLinkSize
  fullWidth?: boolean
  className?: string
}

const variantClasses: Record<ActionLinkVariant, string> = {
  primary: 'bg-blue-800 text-white hover:bg-blue-900 focus-visible:ring-blue-700',
  secondary: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-blue-700',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700',
  ghost: 'text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-700',
}

const sizeClasses: Record<ActionLinkSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-4 text-base',
}

export default function ActionLink({
  href,
  children,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '',
}: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children}
    </Link>
  )
}
