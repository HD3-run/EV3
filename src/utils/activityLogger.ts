export const logActivity = (message: string, details?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  console.log(`[ACTIVITY LOG] ${timestamp}: ${message}`, details || '');
  // In a real application, this would send data to a logging service or backend.
  // Example: fetch('/api/log', { method: 'POST', body: JSON.stringify({ message, details, timestamp }) });
};