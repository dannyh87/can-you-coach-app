import type { ReactNode } from 'react'

type WizardShellProps = {
  title: string
  description?: string
  currentStep: number
  totalSteps: number
  children: ReactNode
}

type WizardActionsProps = {
  children: ReactNode
}

export function WizardShell({
  title,
  description,
  currentStep,
  totalSteps,
  children,
}: WizardShellProps) {
  const progress = Math.round((currentStep / totalSteps) * 100)

  return (
    <section className="mx-auto w-full max-w-3xl pb-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Step {currentStep} of {totalSteps}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-800" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </section>
  )
}

export function WizardActions({ children }: WizardActionsProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mt-5 sm:rounded-xl sm:border sm:p-4 sm:shadow-none">
      <div className="mx-auto flex max-w-3xl flex-wrap justify-between gap-2">
        {children}
      </div>
    </div>
  )
}

export function WizardOptionCard({
  title,
  description,
  meta,
  selected,
  onClick,
}: {
  title: string
  description?: string
  meta?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-100'
          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
          {selected ? 'Selected' : 'Choose'}
        </span>
      </div>
      {meta && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{meta}</p>}
    </button>
  )
}
