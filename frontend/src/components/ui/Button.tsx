import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  glow?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, glow = false, fullWidth = false, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || isLoading;

    const baseStyles = [
      'relative inline-flex items-center justify-center gap-2 font-medium',
      'transition-all duration-200 ease-out',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      'select-none',
    ];

    const disabledStyles = 'opacity-40 cursor-not-allowed pointer-events-none';

    const variants = {
      primary: [
        'bg-white text-black font-semibold',
        'border border-transparent',
        !isDisabled && 'hover:bg-white/90 active:bg-white/80 active:scale-[0.98]',
      ],
      secondary: [
        'bg-white/[0.06] text-white',
        'border border-white/[0.08]',
        !isDisabled && 'hover:bg-white/[0.1] hover:border-white/[0.12] active:bg-white/[0.12] active:scale-[0.98]',
      ],
      outline: [
        'bg-transparent text-white',
        'border border-white/[0.1]',
        !isDisabled && 'hover:bg-white/[0.04] hover:border-white/[0.15] active:bg-white/[0.06] active:scale-[0.98]',
      ],
      ghost: [
        'bg-transparent text-white/80',
        'border border-transparent',
        !isDisabled && 'hover:text-white hover:bg-white/[0.04] active:bg-white/[0.06] active:scale-[0.98]',
      ],
      danger: [
        'bg-red-500/10 text-red-400',
        'border border-red-500/20',
        !isDisabled && 'hover:bg-red-500/15 hover:border-red-500/25 active:bg-red-500/20 active:scale-[0.98]',
      ],
    };

    const sizes = {
      sm: 'h-10 px-3.5 text-sm rounded-lg gap-1.5',
      md: 'h-10 px-4 text-sm rounded-xl gap-2',
      lg: 'h-12 px-6 text-sm rounded-xl gap-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          isDisabled && disabledStyles,
          glow && variant === 'primary' && !isDisabled && 'shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:shadow-[0_0_28px_rgba(255,255,255,0.16)]',
          fullWidth && 'w-full',
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
