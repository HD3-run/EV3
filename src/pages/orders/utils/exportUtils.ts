// Export utilities for orders (CSV, Excel, PDF)

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../../utils/currency';
import { logActivity } from '../../../utils/activityLogger';
import type { Order } from '../types/order.types';

/**
 * Download orders as CSV
 */
export const handleDownloadCSV = (filteredOrders: Order[]) => {
  const csvHeaders = ['Order ID', 'Customer ID', 'Customer Name', 'Channel', 'Status', 'Payment Status', 'Unit Price', 'Amount', 'Date'];
  const csvData = filteredOrders.map(order => [
    order.orderId,
    order.customerId,
    order.customerName,
    order.channel,
    order.status,
    order.paymentStatus || 'pending',
    order.order_items && order.order_items.length > 0
      ? order.order_items.map(item => `${formatCurrency(item.price_per_unit)} (${item.quantity}x)`).join('; ')
      : 'N/A',
    order.amount,
    order.date
  ]);

  const csvContent = [csvHeaders, ...csvData]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  logActivity("Orders CSV downloaded", { recordCount: filteredOrders.length });
};

/**
 * Download orders as Excel
 */
export const handleDownloadExcel = (filteredOrders: Order[]) => {
  const headers = ['Order ID', 'Customer ID', 'Customer Name', 'Channel', 'Status', 'Payment Status', 'Unit Price', 'Amount', 'Date'];
  const data = filteredOrders.map(order => [
    order.orderId,
    order.customerId,
    order.customerName,
    order.channel,
    order.status,
    order.paymentStatus || 'pending',
    order.order_items && order.order_items.length > 0
      ? order.order_items.map(item => `${formatCurrency(item.price_per_unit)} (${item.quantity}x)`).join('; ')
      : 'N/A',
    order.amount,
    order.date
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);

  logActivity("Orders Excel downloaded", { recordCount: filteredOrders.length });
};

/**
 * Download orders as PDF
 */
export const handleDownloadPDF = (filteredOrders: Order[]) => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Orders Report', 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);

  const headers = [['Order ID', 'Customer ID', 'Customer Name', 'Channel', 'Status', 'Payment Status', 'Unit Price', 'Amount', 'Date']];
  const data = filteredOrders.map(order => [
    order.orderId,
    order.customerId,
    order.customerName,
    order.channel,
    order.status,
    order.paymentStatus || 'pending',
    order.order_items && order.order_items.length > 0
      ? order.order_items.map(item => `${formatCurrency(item.price_per_unit)} (${item.quantity}x)`).join('; ')
      : 'N/A',
    formatCurrency(order.amount),
    order.date
  ]);

  autoTable(doc, {
    head: headers,
    body: data,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] }
  });

  doc.save(`orders_${new Date().toISOString().split('T')[0]}.pdf`);

  logActivity("Orders PDF downloaded", { recordCount: filteredOrders.length });
};

