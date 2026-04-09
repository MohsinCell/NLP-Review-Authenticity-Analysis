import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import Card from './Card';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  delay?: number;
}

export default function MetricCard({ title, value, subtitle, icon, trend, className }: MetricCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-white truncate">{value}</p>
          {subtitle && (
            <p
              className={cn(
                'text-sm flex items-center gap-1',
                trend === 'up' && 'text-emerald-400',
                trend === 'down' && 'text-red-400',
                !trend && 'text-neutral-500'
              )}
            >
              {trend === 'up' && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {trend === 'down' && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-white/[0.06] p-3 text-white/80 border border-white/10">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
