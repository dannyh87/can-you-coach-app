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
  positiveRate?: number | null
}

export default function TeamEventTrendChart({
  data,
  itemLabel = 'Observation',
}: {
  data: TeamEventTrendPoint[]
  itemLabel?: string
}) {
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
          <Tooltip formatter={(value, name) => [name === 'positiveRate' && typeof value === 'number' ? `${Math.round(value * 100)}%` : value, name === 'positiveRate' ? 'Positive rate' : `${itemLabel} count`]} />
          <Line
            type="monotone"
            dataKey="count"
            name={`${itemLabel} count`}
            stroke="#047857"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          {data.some((point) => point.positiveRate !== null && point.positiveRate !== undefined) && (
            <Line
              type="monotone"
              dataKey="positiveRate"
              name="positiveRate"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
