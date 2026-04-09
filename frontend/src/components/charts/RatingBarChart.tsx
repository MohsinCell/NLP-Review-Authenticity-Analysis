import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RatingBarChartProps {
  data: { name: string; value: number }[];
  color?: string;
  yAxisLabel?: string;
}

export default function RatingBarChart({ data, color = '#ffffff', yAxisLabel }: RatingBarChartProps) {
  return (
    <div className="relative w-full">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#737373' }}
            stroke="rgba(255,255,255,0.1)"
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#737373' }}
            stroke="rgba(255,255,255,0.1)"
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            label={yAxisLabel ? {
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              fill: '#525252',
              style: { textAnchor: 'middle' }
            } : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(23, 23, 23, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              fontSize: '13px',
              color: '#fafafa',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              padding: '10px 14px',
            }}
            itemStyle={{ color: '#d4d4d4' }}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
          />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            animationBegin={200}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill="url(#barGradient)"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
