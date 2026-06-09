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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </div>
  )
}
