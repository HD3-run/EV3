// Export handlers
import { Product } from '../types/inventory.types';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportUtils';

export function handleDownloadCSV(products: Product[]): void {
    exportToCSV(products);
}

export function handleDownloadExcel(products: Product[]): void {
    exportToExcel(products);
}

export function handleDownloadPDF(products: Product[]): void {
    exportToPDF(products);
}

