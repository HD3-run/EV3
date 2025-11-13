// Export formatting utilities

import { ReportData } from '../types/report.types';

/**
 * Format data for CSV export
 */
export const formatDataForCSV = (data: ReportData[]): string => {
  const csvHeaders = ['Date', 'Sales Count', 'Revenue'];
  const csvData = data.map(item => [
    item.date,
    item.sales,
    item.revenue
  ]);
  
  const csvContent = [csvHeaders, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  return csvContent;
};

/**
 * Format data for Excel export
 */
export const formatDataForExcel = (data: ReportData[]): any[][] => {
  const headers = ['Date', 'Sales Count', 'Revenue'];
  const excelData = data.map(item => [
    item.date,
    item.sales,
    item.revenue
  ]);
  
  return [headers, ...excelData];
};

/**
 * Format data for PDF export
 */
export const formatDataForPDF = (data: ReportData[]): { headers: string[][]; body: string[][] } => {
  const headers = [['Date', 'Sales Count', 'Revenue']];
  const pdfData = data.map(item => [
    item.date,
    item.sales.toString(),
    item.revenue.toString()
  ]);
  
  return { headers, body: pdfData };
};

