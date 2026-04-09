import { useCallback } from 'react';
import { AxiosError } from 'axios';

interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string>;
}

export function useApiError() {
  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof AxiosError) {
      const data = error.response?.data as ApiErrorResponse | undefined;
      if (data?.message) return data.message;
      if (data?.errors) {
        return Object.values(data.errors).join(', ');
      }
      if (error.response?.status === 429) return 'Rate limit exceeded. Please try again later.';
      if (error.response?.status === 401) return 'Authentication required. Please log in.';
      if (error.response?.status === 403) return 'Access denied. Insufficient permissions.';
      if (error.response?.status === 404) return 'Resource not found.';
      if (error.response?.status === 500) return 'Server error. Please try again later.';
      return error.message || 'An unexpected error occurred.';
    }
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred.';
  }, []);

  return { getErrorMessage };
}
