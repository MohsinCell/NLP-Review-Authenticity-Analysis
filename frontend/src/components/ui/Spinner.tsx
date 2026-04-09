import { cn } from '../../lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  };

  const borderSizes = {
    sm: 'border-2',
    md: 'border-2',
    lg: 'border-3',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'rounded-full border-white/20 border-t-white animate-spin',
          sizes[size],
          borderSizes[size]
        )}
      />
    </div>
  );
}
