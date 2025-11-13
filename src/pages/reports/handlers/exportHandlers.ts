// Export handlers for reports

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportData, ReportType } from '../types/report.types';
import { formatCurrency } from '../../../utils/currency';
import { captureAllCharts, ChartRefs } from '../utils/chartCapture';
import { formatDataForCSV, formatDataForExcel, formatDataForPDF } from '../utils/exportUtils';

/**
 * Handle CSV download
 */
export const handleDownloadCSV = (data: ReportData[], reportType: ReportType) => {
  const csvContent = formatDataForCSV(data);
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Handle Excel download with chart images
 */
export const handleDownloadExcel = async (
  data: ReportData[],
  reportType: ReportType,
  chartRefs: ChartRefs
) => {
  const excelData = formatDataForExcel(data);
  const ws = XLSX.utils.aoa_to_sheet(excelData);
  
  // Add all chart images to Excel
  const chartImages = await captureAllCharts(chartRefs);
  const images: any[] = [];
  
  const chartTypes = ['line', 'bar', 'pie', 'scatter'];
  
  for (let i = 0; i < chartTypes.length; i++) {
    const chartType = chartTypes[i];
    const chartImage = chartImages[chartType];
    
    if (chartImage) {
      // Convert base64 to binary
      const binaryString = atob(chartImage.split(',')[1]);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }
      
      // Add image to worksheet
      images.push({
        position: { type: 'absolute', x: 10, y: 10 + (i * 260) },
        image: bytes,
        width: 400,
        height: 250
      });
    }
  }
  
  if (images.length > 0) {
    ws['!images'] = images;
  }
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
  XLSX.writeFile(wb, `sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Handle PDF download with chart images
 */
export const handleDownloadPDF = async (
  data: ReportData[],
  reportType: ReportType,
  chartRefs: ChartRefs
) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Sales Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
  
  // Capture all chart images
  const chartImages = await captureAllCharts(chartRefs);
  let currentY = 35;
  
  // Add all chart images
  const chartTypes = ['line', 'bar', 'pie', 'scatter'];
  const chartTitles = ['Line Chart', 'Bar Chart', 'Pie Chart', 'Scatter Plot'];
  
  for (let i = 0; i < chartTypes.length; i++) {
    const chartType = chartTypes[i];
    const chartTitle = chartTitles[i];
    const chartImage = chartImages[chartType];
    
    if (chartImage) {
      // Add chart title
      doc.setFontSize(12);
      doc.text(`${chartTitle}`, 14, currentY);
      currentY += 10;
      
      // Add chart image
      doc.addImage(chartImage, 'PNG', 14, currentY, 180, 100);
      currentY += 110;
      
      // Add page break if needed
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
    }
  }
  
  // Add data table
  const { headers, body } = formatDataForPDF(data);
  const pdfData = body.map((row) => [
    row[0],
    row[1],
    formatCurrency(parseFloat(row[2]))
  ]);
  
  autoTable(doc, {
    head: headers,
    body: pdfData,
    startY: currentY,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [66, 139, 202] }
  });
  
  doc.save(`sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
};

