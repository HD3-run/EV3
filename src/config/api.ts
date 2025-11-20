const isDevelopment = import.meta.env.MODE === 'development';

export const API_BASE_URL = isDevelopment
  ? '' // Use relative URLs in development (Vite proxy handles it)
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000'); // Use environment variable or fallback

export const getApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
};