import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';

/**
 * Custom hook for making authenticated API requests
 * Automatically includes phantom token in Authorization header
 * Falls back to session-based auth if no token available
 */
export const useAuthFetch = () => {
  const { getAuthHeaders } = useAuth();

  const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : getApiUrl(endpoint);
    
    // Check if body is FormData (for file uploads)
    const isFormData = options.body instanceof FormData;
    
    // Get auth headers, but don't include Content-Type for FormData
    const authHeaders = getAuthHeaders();
    
    // Convert HeadersInit to a plain object for easier access
    const authHeadersObj = authHeaders instanceof Headers 
      ? Object.fromEntries(authHeaders.entries())
      : Array.isArray(authHeaders)
      ? Object.fromEntries(authHeaders)
      : authHeaders;
    
    const headers = isFormData 
      ? {
          // Only include Authorization header for FormData, let browser set Content-Type with boundary
          ...(authHeadersObj.Authorization ? { Authorization: authHeadersObj.Authorization } : {}),
          ...options.headers,
        }
      : {
          ...authHeaders,
          ...options.headers,
        };

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Keep session as fallback
    });
  };

  return authFetch;
};
