// Export utilities for CSV, Excel, and PDF
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../../utils/currency';
import { Product } from '../types/inventory.types';

export function exportToCSV(products: Product[]): void {
    const csvHeaders = ['Product Name', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'Stock Quantity', 'Reorder Level', 'Status'];
    const csvData = products.map(product => [
        product.product_name,
        product.sku,
        product.category || 'Uncategorized',
        product.unit_price || 0,
        product.selling_price || 0,
        product.quantity_available || 0,
        product.reorder_level || 0,
        product.is_low_stock ? 'Low Stock' : 'In Stock'
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function exportToExcel(products: Product[]): void {
    const headers = ['Product Name', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'Stock Quantity', 'Reorder Level', 'Status'];
    const data = products.map(product => [
        product.product_name,
        product.sku,
        product.category || 'Uncategorized',
        product.unit_price || 0,
        product.selling_price || 0,
        product.quantity_available || 0,
        product.reorder_level || 0,
        product.is_low_stock ? 'Low Stock' : 'In Stock'
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToPDF(products: Product[]): void {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Inventory Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
    
    const headers = [['Product Name', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'Stock Quantity', 'Reorder Level', 'Status']];
    const data = products.map(product => [
        product.product_name,
        product.sku,
        product.category || 'Uncategorized',
        product.unit_price ? formatCurrency(product.unit_price) : '₹0.00',
        product.selling_price ? formatCurrency(product.selling_price) : '₹0.00',
        product.quantity_available || 0,
        product.reorder_level || 0,
        product.is_low_stock ? 'Low Stock' : 'In Stock'
    ]);
    
    autoTable(doc, {
        head: headers,
        body: data,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] }
    });
    
    doc.save(`inventory_${new Date().toISOString().split('T')[0]}.pdf`);
}

