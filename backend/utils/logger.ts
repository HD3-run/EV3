/**
 * Secure logging utility to prevent log injection attacks
 */

export function sanitizeLogInput(input: any): string {
  if (input === null || input === undefined) {
    return 'null';
  }
  
  let str = String(input);
  
  // Remove or encode dangerous characters that could be used for log injection
  str = str
    .replace(/\r\n/g, '\\r\\n')  // Replace CRLF
    .replace(/\r/g, '\\r')      // Replace CR
    .replace(/\n/g, '\\n')      // Replace LF
    .replace(/\t/g, '\\t')      // Replace tabs
    .replace(/\x00/g, '\\0')    // Replace null bytes
    .replace(/\x1b/g, '\\x1b'); // Replace escape sequences
  
  // Truncate very long strings to prevent log flooding
  if (str.length > 1000) {
    str = str.substring(0, 1000) + '...[truncated]';
  }
  
  return str;
}

export function secureLog(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const sanitizedMessage = sanitizeLogInput(message);
  
  let logEntry = `[${timestamp}] ${level.toUpperCase()}: ${sanitizedMessage}`;
  
  if (data !== undefined) {
    const sanitizedData = sanitizeLogInput(data);
    logEntry += ` | Data: ${sanitizedData}`;
  }
  
  switch (level) {
    case 'info':
      console.log(logEntry);
      break;
    case 'warn':
      console.warn(logEntry);
      break;
    case 'error':
      console.error(logEntry);
      break;
  }
}

export const logger = {
  info: (message: string, data?: any) => secureLog('info', message, data),
  warn: (message: string, data?: any) => secureLog('warn', message, data),
  error: (message: string, data?: any) => secureLog('error', message, data),
};