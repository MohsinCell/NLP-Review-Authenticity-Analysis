import { forwardRef, type TextareaHTMLAttributes, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, name, disabled, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

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
        <textarea
          ref={ref}
          id={id}
          name={name}
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

            'block w-full min-h-[120px] rounded-xl border bg-white/[0.03]',
            'px-4 py-3 text-sm text-white',
            'transition-all duration-200',
            'placeholder:text-white/30',
            'focus:outline-none focus:ring-2 focus:ring-white/10 focus:ring-offset-0',
            'resize-y',

            error
              ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10'
              : 'border-white/[0.08] focus:border-white/[0.20] focus:bg-white/[0.05]',

            disabled && 'opacity-50 cursor-not-allowed bg-white/[0.02] resize-none',
            className
          )}
          {...props}
        />

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
            className="text-xs text-white/40"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
export default Textarea;
