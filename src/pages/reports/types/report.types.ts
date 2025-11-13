// TypeScript interfaces for reports

export interface ReportData {
  date: string;
  sales: number;
  revenue: number;
}

export type ReportType = 'daily' | 'monthly' | 'yearly';
export type ChartType = 'line' | 'bar' | 'pie' | 'scatter';

