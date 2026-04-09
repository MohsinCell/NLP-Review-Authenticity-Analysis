import { useRef, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  className?: string;
}

export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  error = false,
  className,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const normalizedValue = [...value, ...Array(length).fill('')].slice(0, length);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const focusInput = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, length - 1));
    inputRefs.current[clampedIndex]?.focus();
  }, [length]);

  const handleChange = (index: number, inputValue: string) => {

    if (!/^\d*$/.test(inputValue)) return;

    const newValue = [...normalizedValue];
    const digit = inputValue.slice(-1);
    newValue[index] = digit;
    onChange(newValue);

    if (digit && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Backspace':
        e.preventDefault();
        if (normalizedValue[index]) {

          const newValue = [...normalizedValue];
          newValue[index] = '';
          onChange(newValue);
        } else if (index > 0) {

          const newValue = [...normalizedValue];
          newValue[index - 1] = '';
          onChange(newValue);
          focusInput(index - 1);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusInput(index - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusInput(index + 1);
        break;
      case 'Delete': {
        e.preventDefault();
        const newValue = [...normalizedValue];
        newValue[index] = '';
        onChange(newValue);
        break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

    if (pastedData.length > 0) {
      const newValue = [...normalizedValue];
      for (let i = 0; i < pastedData.length; i++) {
        newValue[i] = pastedData[i];
      }
      onChange(newValue);

      const nextEmptyIndex = newValue.findIndex((v) => !v);
      focusInput(nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div
      className={cn('flex justify-center gap-2 xs:gap-2.5 sm:gap-3', className)}
      onPaste={handlePaste}
    >
      {normalizedValue.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={handleFocus}
          aria-label={`Digit ${index + 1} of ${length}`}
          className={cn(

            'w-10 h-12 xs:w-11 xs:h-13 sm:w-12 sm:h-14',
            'rounded-xl border text-center',
            'text-lg xs:text-xl font-semibold text-white',
            'outline-none transition-all duration-200',
            'focus:ring-2 focus:ring-white/20 focus:ring-offset-0',

            error
              ? 'border-red-500/40 bg-red-500/5 focus:border-red-500/60'
              : [
                  'border-white/10 bg-white/[0.04]',
                  'focus:border-white/30 focus:bg-white/[0.08]',
                  'hover:border-white/15 hover:bg-white/[0.06]',
                ],

            digit && !error && 'border-white/20 bg-white/[0.08]',

            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      ))}
    </div>
  );
}
