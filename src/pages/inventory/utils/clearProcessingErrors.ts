// Processing errors management utilities

const STORAGE_KEY = 'inventory-processing-errors';

export function loadProcessingErrors(): string[] {
    const savedErrors = localStorage.getItem(STORAGE_KEY);
    return savedErrors ? JSON.parse(savedErrors) : [];
}

export function saveProcessingErrors(errors: string[]): void {
    if (errors.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export function clearProcessingErrors(): void {
    localStorage.removeItem(STORAGE_KEY);
}

