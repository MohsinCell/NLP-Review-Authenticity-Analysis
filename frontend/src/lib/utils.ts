import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatScore(value: number): string {
  return value.toFixed(1);
}

export function getSentimentColor(sentiment: string): string {
  switch (sentiment?.toLowerCase()) {
    case 'positive':
      return 'text-success-600 bg-success-50';
    case 'negative':
      return 'text-danger-600 bg-danger-50';
    case 'neutral':
      return 'text-warning-600 bg-warning-50';
    default:
      return 'text-surface-600 bg-surface-100';
  }
}

export function getAuthenticityColor(label: string): string {
  switch (label?.toLowerCase()) {
    case 'likely genuine':
      return 'text-success-700 bg-success-50 border-success-500';
    case 'suspicious':
      return 'text-warning-600 bg-warning-50 border-warning-500';
    case 'highly suspicious':
      return 'text-danger-700 bg-danger-50 border-danger-500';
    default:
      return 'text-surface-600 bg-surface-100 border-surface-300';
  }
}

export function getRatingStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', 'hi-en': 'Hinglish', fr: 'French',
  de: 'German', es: 'Spanish', pt: 'Portuguese', it: 'Italian',
  ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
  ar: 'Arabic', bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
  mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam',
  pa: 'Punjabi', ur: 'Urdu', nl: 'Dutch', sv: 'Swedish',
  pl: 'Polish', tr: 'Turkish', th: 'Thai', vi: 'Vietnamese',
};

export function getLanguageName(code: string): string {
  if (!code) return 'Unknown';
  // Already a full name (starts with uppercase, length > 3)
  if (code.length > 3 && code[0] === code[0].toUpperCase()) return code;
  return LANGUAGE_NAMES[code.toLowerCase()] || code.toUpperCase();
}
