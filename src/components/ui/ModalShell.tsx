import type { ReactNode } from 'react'
import Button from './Button'

type ModalShellProps = {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  isSubmitting?: boolean
  maxWidthClassName?: string
  mode?: 'create' | 'edit' | 'detail' | 'danger'
}

export default function ModalShell({
  title,
  description,
  children,
  onClose,
  isSubmitting = false,
  maxWidthClassName = 'max-w-2xl',
  mode = 'detail',
}: ModalShellProps) {
  const titleTone = mode === 'danger' ? 'text-red-950' : 'text-slate-950'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className={`max-h-[90vh] w-full ${maxWidthClassName} overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className={`text-2xl font-bold ${titleTone}`}>{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
