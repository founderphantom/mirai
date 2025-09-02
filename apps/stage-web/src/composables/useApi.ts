import { ref, Ref, shallowRef } from 'vue';
import { handleApiError, ApiError } from '@/utils/error-handler';

export interface UseApiOptions {
  immediate?: boolean;
  showError?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: ApiError) => void;
}

export interface UseApiReturn<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<ApiError | null>;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Composable for handling API calls with loading and error states
 */
export function useApi<T = any>(
  apiCall: (...args: any[]) => Promise<T>,
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  
  const execute = async (...args: any[]): Promise<T | null> => {
    loading.value = true;
    error.value = null;
    
    try {
      const result = await apiCall(...args);
      data.value = result;
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const apiError = handleApiError(err);
      error.value = apiError;
      
      if (options.showError !== false) {
        // Error toast is already shown by the API client interceptor
      }
      
      if (options.onError) {
        options.onError(apiError);
      }
      
      return null;
    } finally {
      loading.value = false;
    }
  };
  
  const reset = () => {
    data.value = null;
    loading.value = false;
    error.value = null;
  };
  
  // Execute immediately if requested
  if (options.immediate) {
    execute();
  }
  
  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

/**
 * Composable for handling paginated API calls
 */
export function usePaginatedApi<T = any>(
  apiCall: (page: number, limit: number, ...args: any[]) => Promise<{
    data: T[];
    total: number;
    hasMore: boolean;
  }>,
  limit: number = 20
) {
  const items = ref<T[]>([]);
  const page = ref(1);
  const total = ref(0);
  const hasMore = ref(true);
  const loading = ref(false);
  const error = ref<ApiError | null>(null);
  
  const loadMore = async (...args: any[]) => {
    if (!hasMore.value || loading.value) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const result = await apiCall(page.value, limit, ...args);
      
      if (page.value === 1) {
        items.value = result.data;
      } else {
        items.value.push(...result.data);
      }
      
      total.value = result.total;
      hasMore.value = result.hasMore;
      page.value++;
    } catch (err) {
      error.value = handleApiError(err);
    } finally {
      loading.value = false;
    }
  };
  
  const refresh = async (...args: any[]) => {
    page.value = 1;
    hasMore.value = true;
    items.value = [];
    await loadMore(...args);
  };
  
  const reset = () => {
    items.value = [];
    page.value = 1;
    total.value = 0;
    hasMore.value = true;
    loading.value = false;
    error.value = null;
  };
  
  return {
    items,
    page,
    total,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
    reset,
  };
}

/**
 * Composable for handling API calls with retry logic
 */
export function useApiWithRetry<T = any>(
  apiCall: (...args: any[]) => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): UseApiReturn<T> {
  const attempt = ref(0);
  
  const executeWithRetry = async (...args: any[]): Promise<T> => {
    attempt.value = 0;
    
    while (attempt.value < maxRetries) {
      try {
        return await apiCall(...args);
      } catch (error) {
        attempt.value++;
        
        if (attempt.value >= maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt.value));
      }
    }
    
    throw new Error('Max retries exceeded');
  };
  
  return useApi(executeWithRetry);
}

/**
 * Composable for handling form submissions
 */
export function useFormApi<T = any, D = any>(
  apiCall: (data: D) => Promise<T>,
  options: UseApiOptions = {}
) {
  const { data, loading, error, execute, reset } = useApi(apiCall, options);
  
  const submit = async (formData: D): Promise<T | null> => {
    return execute(formData);
  };
  
  return {
    data,
    loading,
    error,
    submit,
    reset,
  };
}