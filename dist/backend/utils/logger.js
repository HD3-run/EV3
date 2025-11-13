"use strict";
/**
 * Secure logging utility to prevent log injection attacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.sanitizeLogInput = sanitizeLogInput;
exports.secureLog = secureLog;
function sanitizeLogInput(input) {
    if (input === null || input === undefined) {
        return 'null';
    }
    let str = String(input);
    // Remove or encode dangerous characters that could be used for log injection
    str = str
        .replace(/\r\n/g, '\\r\\n') // Replace CRLF
        .replace(/\r/g, '\\r') // Replace CR
        .replace(/\n/g, '\\n') // Replace LF
        .replace(/\t/g, '\\t') // Replace tabs
        .replace(/\x00/g, '\\0') // Replace null bytes
        .replace(/\x1b/g, '\\x1b'); // Replace escape sequences
    // Truncate very long strings to prevent log flooding
    if (str.length > 1000) {
        str = str.substring(0, 1000) + '...[truncated]';
    }
    return str;
}
function secureLog(level, message, data) {
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
exports.logger = {
    info: (message, data) => secureLog('info', message, data),
    warn: (message, data) => secureLog('warn', message, data),
    error: (message, data) => secureLog('error', message, data),
};
//# sourceMappingURL=logger.js.map