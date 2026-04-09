import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SentimentPieChartProps {
  positive: number;
  negative: number;
  neutral: number;
}

const COLORS = ['#ffffff', '#737373', '#3f3f3f'];

const RADIAN = Math.PI / 180;

function renderCustomLabel(props: any) {
  const { cx, cy, midAngle, outerRadius, name, value, index } = props;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);

  const verticalPush = midAngle > 0 && midAngle < 180 ? -8 : 8;
  const y = cy + radius * Math.sin(-midAngle * RADIAN) + verticalPush;
  const anchor = x > cx ? 'start' : 'end';

  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fill={COLORS[index % COLORS.length]}
      fontSize={14}
      fontWeight={500}
    >
      {name}: {value.toFixed(1)}%
    </text>
  );
}

export default function SentimentPieChart({ positive, negative, neutral }: SentimentPieChartProps) {
  const data = [
    { name: 'Positive', value: positive },
    { name: 'Negative', value: negative },
    { name: 'Neutral', value: neutral },
  ].filter(d => d.value > 0);

  return (
    <div className="relative w-full">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="28%"
            outerRadius="42%"
            paddingAngle={3}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={{ strokeWidth: 1, stroke: 'rgba(255,255,255,0.15)' }}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={2}
            animationBegin={200}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(1)}%`}
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
          />
          <Legend
            wrapperStyle={{
              color: '#a1a1a1',
              fontSize: '12px',
              paddingTop: '10px'
            }}
            formatter={(value) => <span style={{ color: '#a1a1a1' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
