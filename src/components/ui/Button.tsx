import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  isPending?: boolean
  pendingText?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 focus-visible:ring-emerald-700',
  secondary: 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-emerald-700',
  danger: 'bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700',
  ghost: 'text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-700',
  success: 'bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-4 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type = 'button',
  disabled,
  isPending = false,
  pendingText,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isPending

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isPending && (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      )}
      {isPending && pendingText ? pendingText : children}
    </button>
  )
}
