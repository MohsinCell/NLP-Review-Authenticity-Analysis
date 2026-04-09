import { motion, useMotionValue, animate } from 'framer-motion';
import { useEffect, useState } from 'react';

interface GaugeChartProps {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
}

export default function GaugeChart({ value, max = 100, label, color, size = 160 }: GaugeChartProps) {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const r = size * 0.375;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - percentage * 0.75);
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = Math.max(size * 0.06, 6);
  const count = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState('0.0');

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (latest: number) => setDisplayValue(latest.toFixed(1))
    });
    return controls.stop;
  }, [value, count]);

  const getColor = () => {
    if (color) return color;
    if (percentage >= 0.7) return '#ffffff';
    if (percentage >= 0.4) return '#a1a1a1';
    return '#525252';
  };

  const valueFontSize = Math.max(size * 0.175, 18);
  const subFontSize = Math.max(size * 0.075, 10);

  return (
    <div className="flex flex-col items-center w-full max-w-[200px] mx-auto">
      <div className="relative w-full" style={{ maxWidth: size }}>
        <svg
          width="100%"
          viewBox={`0 0 ${size} ${size * 0.85}`}
          preserveAspectRatio="xMidYMid meet"
        >

          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            transform={`rotate(135 ${cx} ${cy})`}
          />

          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference * 0.75 }}
            animate={{ strokeDashoffset: strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
            transform={`rotate(135 ${cx} ${cy})`}
          />

          <text
            x={cx}
            y={cy - 5}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={valueFontSize}
            fontWeight="700"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {displayValue}
          </text>
          <text
            x={cx}
            y={cy + valueFontSize * 0.7}
            textAnchor="middle"
            fill="rgba(255,255,255,0.4)"
            fontSize={subFontSize}
            fontWeight="500"
          >
            / {max}
          </text>
        </svg>
      </div>

      <p className="mt-2 text-sm font-medium text-neutral-400">{label}</p>
    </div>
  );
}
