'use client'

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type TeamEventTrendPoint = {
  label: string
  count: number
}

export default function TeamEventTrendChart({ data }: { data: TeamEventTrendPoint[] }) {
  if (data.length === 0) return null

  return (
    <div className="h-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 18, bottom: 24, left: 0 }}>
          <XAxis
            dataKey="label"
            interval={0}
            tick={{ fontSize: 12 }}
            angle={-20}
            textAnchor="end"
            height={64}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [value, 'Events']} />
          <Line
            type="monotone"
            dataKey="count"
            name="Event count"
            stroke="#047857"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
