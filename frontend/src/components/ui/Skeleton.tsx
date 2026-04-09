import { cn } from '../../lib/utils';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-white/[0.08]';

  const variantStyles = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={{
        width: width,
        height: height,
      }}
      role="status"
      aria-label="Loading..."
    />
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] overflow-hidden"
      role="status"
      aria-label="Loading table..."
    >
      <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" className="flex-1 h-3" />
        ))}
      </div>

      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 py-3 flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                variant="text"
                className={cn(
                  'flex-1',
                  colIdx === 0 ? 'w-20' : '',
                  colIdx === columns - 1 ? 'w-16' : ''
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function SkeletonMetricCards({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="Loading metrics..."
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" width={16} height={16} />
            <Skeleton variant="text" className="w-20 h-3" />
          </div>
          <Skeleton variant="text" className="w-16 h-8" />
          <Skeleton variant="text" className="w-24 h-3" />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
