// Export utilities for invoices (CSV, Excel, PDF)

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../../utils/currency';
import type { Invoice } from '../types/invoice.types';

/**
 * Download invoices as CSV
 */
export const handleDownloadCSV = (invoices: Invoice[]) => {
  const csvHeaders = ['Invoice Number', 'Order ID', 'Customer Name', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Discount', 'Total', 'Status', 'Due Date', 'Created'];
  const csvData = invoices.map(invoice => [
    invoice.display_number,
    `ORD${invoice.order_id}`,
    invoice.customer_name,
    invoice.subtotal,
    invoice.cgst_amount || 0,
    invoice.sgst_amount || 0,
    invoice.igst_amount || 0,
    invoice.discount_amount,
    invoice.total_amount,
    invoice.payment_status,
    invoice.due_date,
    new Date(invoice.created_at).toLocaleDateString()
  ]);
  
  const csvContent = [csvHeaders, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `invoices_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Download invoices as Excel
 */
export const handleDownloadExcel = (invoices: Invoice[]) => {
  const headers = ['Invoice Number', 'Order ID', 'Customer Name', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Discount', 'Total', 'Status', 'Due Date', 'Created'];
  const data = invoices.map(invoice => [
    invoice.display_number,
    `ORD${invoice.order_id}`,
    invoice.customer_name,
    invoice.subtotal,
    invoice.cgst_amount || 0,
    invoice.sgst_amount || 0,
    invoice.igst_amount || 0,
    invoice.discount_amount,
    invoice.total_amount,
    invoice.payment_status,
    invoice.due_date,
    new Date(invoice.created_at).toLocaleDateString()
  ]);
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, `invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Download invoices as PDF
 */
export const handleDownloadPDF = (invoices: Invoice[]) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Invoices Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
  
  const headers = [['Invoice Number', 'Order ID', 'Customer', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Discount', 'Total', 'Status', 'Due Date']];
  const data = invoices.map(invoice => [
    invoice.display_number,
    `ORD${invoice.order_id}`,
    invoice.customer_name,
    formatCurrency(invoice.subtotal),
    formatCurrency(invoice.cgst_amount || 0),
    formatCurrency(invoice.sgst_amount || 0),
    formatCurrency(invoice.igst_amount || 0),
    formatCurrency(invoice.discount_amount),
    formatCurrency(invoice.total_amount),
    invoice.payment_status,
    invoice.due_date
  ]);
  
  autoTable(doc, {
    head: headers,
    body: data,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] }
  });
  
  doc.save(`invoices_${new Date().toISOString().split('T')[0]}.pdf`);
};

