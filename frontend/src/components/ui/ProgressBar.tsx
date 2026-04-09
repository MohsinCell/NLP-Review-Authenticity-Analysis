import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;

}

export default function ProgressBar({
  value,
  max = 100,
  color = 'primary',
  showLabel = false,
  className,
  size = 'md',
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const colors = {
    primary: 'bg-white',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn(
        'w-full overflow-hidden rounded-full bg-white/10 border border-white/5',
        sizes[size]
      )}>
        <motion.div
          className={cn('h-full rounded-full', colors[color])}
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={animated ? {
            duration: 0.6,
            ease: [0.4, 0, 0.2, 1],
          } : { duration: 0 }}
        />
      </div>
      {showLabel && (
        <p className="mt-1.5 text-xs text-neutral-400 font-medium">
          {percentage.toFixed(0)}%
        </p>
      )}
    </div>
  );
}
