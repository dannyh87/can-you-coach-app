type StatCardProps = {
  label: string
  value: string | number
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

const toneClasses = {
  default: 'text-slate-950',
  success: 'text-green-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
}

export default function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${toneClasses[tone]}`}>{value}</p>
    </div>
  )
}
