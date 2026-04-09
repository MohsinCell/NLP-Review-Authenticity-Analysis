import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, name, type, leftIcon, rightElement, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "block text-sm font-medium transition-colors duration-200",
              disabled
                ? "text-white/40"
                : isFocused
                  ? "text-white"
                  : "text-white/60"
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span
              className={cn(
                "absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200",
                disabled
                  ? "text-neutral-600"
                  : isFocused
                    ? "text-white/70"
                    : "text-neutral-500"
              )}
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            name={name}
            type={isPassword && showPassword ? 'text' : type}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(

              'block w-full h-11 rounded-xl border bg-white/[0.03]',
              'px-4 text-sm text-white',
              'transition-all duration-200',
              'placeholder:text-white/50',
              'focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-0',

              error
                ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10'
                : 'border-white/[0.08] focus:border-white/[0.20] focus:bg-white/[0.05]',

              disabled && 'opacity-50 cursor-not-allowed bg-white/[0.02]',

              leftIcon && 'pl-10',
              (isPassword || rightElement) && 'pr-12',
              className
            )}
            {...props}
          />

          {isPassword && !rightElement && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={disabled}
              className={cn(
                "absolute right-3.5 top-1/2 -translate-y-1/2",
                "text-white/40 hover:text-white/70 focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span
                className={cn(
                  "block transition-transform duration-300 ease-in-out",
                  showPassword ? "rotate-180" : "rotate-0"
                )}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 transition-opacity duration-300" />
                ) : (
                  <Eye className="h-4 w-4 transition-opacity duration-300" />
                )}
              </span>
            </button>
          )}

          {rightElement && !isPassword && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {rightElement}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-xs text-red-400 flex items-center gap-1.5 animate-fade-in"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </p>
        )}

        {hint && !error && (
          <p
            id={`${id}-hint`}
            className="text-xs text-white/60"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
