import { useState, useEffect, useRef } from 'react';
import { ReportData, ReportType, ChartType } from '../types/report.types';
import { fetchReportData } from '../queries/reportQueries';
import { ChartRefs } from '../utils/chartCapture';

export function useReportManagement() {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedDate, setSelectedDate] = useState('');
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Refs for all chart types
  const lineChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const scatterChartRef = useRef<HTMLDivElement>(null);
  
  const chartRefs: ChartRefs = {
    line: lineChartRef,
    bar: barChartRef,
    pie: pieChartRef,
    scatter: scatterChartRef
  };

  // Fetch data when report type or date changes
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const reportData = await fetchReportData(reportType, selectedDate);
        setData(reportData);
      } catch (error) {
        console.error('Error fetching reports:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [reportType, selectedDate]);

  return {
    reportType,
    chartType,
    selectedDate,
    data,
    loading,
    chartRefs,
    setReportType,
    setChartType,
    setSelectedDate
  };
}

