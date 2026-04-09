import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
  variant?: 'default' | 'glass' | 'solid';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, glow = false, variant = 'glass', padding = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white/[0.02] border-white/[0.06]',
      glass: 'bg-white/[0.03] backdrop-blur-xl border-white/[0.08]',
      solid: 'bg-[#0a0a0a] border-white/[0.08]',
    };

    const paddings = {
      none: '',
      sm: 'p-3 sm:p-4',
      md: 'p-4 sm:p-6',
      lg: 'p-6 sm:p-8',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-2xl border',
          variants[variant],
          paddings[padding],
          hover && 'hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300',
          glow && 'shadow-[0_0_30px_rgba(255,255,255,0.04)]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
