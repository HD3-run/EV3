// API queries for reports

import { ReportData, ReportType } from '../types/report.types';

/**
 * Fetch report data from API
 */
export const fetchReportData = async (
  reportType: ReportType,
  selectedDate: string
): Promise<ReportData[]> => {
  try {
    // Build query string - only include dates if provided
    let url = `/api/reports?type=${reportType}`;
    if (selectedDate) {
      url += `&startDate=${selectedDate}&endDate=${selectedDate}`;
    }
    
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.data || [];
    } else {
      console.error('Failed to fetch reports data');
      return [];
    }
  } catch (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
};

