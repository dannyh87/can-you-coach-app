import type { ReactNode } from 'react'

import { errorTextClassName, helperTextClassName, labelClassName } from '@/components/ui/formStyles'

type FormFieldProps = {
  label: string
  children: ReactNode
  helperText?: string
  errorText?: string
  className?: string
}

export default function FormField({
  label,
  children,
  helperText,
  errorText,
  className = '',
}: FormFieldProps) {
  return (
    <label className={`${labelClassName} ${className}`}>
      {label}
      {children}
      {helperText && <span className={helperTextClassName}>{helperText}</span>}
      {errorText && <span className={errorTextClassName}>{errorText}</span>}
    </label>
  )
}
