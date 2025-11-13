// Custom hook for invoice state management and data loading

import { useState, useEffect, useCallback } from 'react';
import { Invoice, NewInvoiceFormData, UpdateInvoiceFormData } from '../types/invoice.types';
import { loadInvoices, LoadInvoicesParams } from '../queries/invoiceQueries';
import { toggleInvoiceExpansion } from '../utils/toggleExpansion';
import { ITEMS_PER_PAGE } from '../constants/invoiceConstants';

export function useInvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  // Form states
  const [newInvoice, setNewInvoice] = useState<NewInvoiceFormData>({
    orderId: '',
    dueDate: '',
    notes: '',
    discountAmount: 0
  });
  
  const [updateInvoice, setUpdateInvoice] = useState<UpdateInvoiceFormData>({
    dueDate: '',
    notes: '',
    discountAmount: 0,
    paymentStatus: 'unpaid',
    paymentMethod: ''
  });

  const toggleExpansion = useCallback((invoiceId: number) => {
    setExpandedInvoices(prev => toggleInvoiceExpansion(prev, invoiceId));
  }, []);

  const loadInvoicesWrapper = useCallback(async () => {
    try {
      setLoading(true);
      const params: LoadInvoicesParams = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        searchTerm: searchTerm || undefined,
        filterStatus: filterStatus !== 'all' ? filterStatus : undefined
      };
      
      const result = await loadInvoices(params);
      setInvoices(result.invoices);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, filterStatus]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Load invoices when page, search, or filter changes
  useEffect(() => {
    loadInvoicesWrapper();
  }, [currentPage, searchTerm, filterStatus]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [searchTerm, filterStatus]);

  // Initialize updateInvoice when editingInvoice changes
  useEffect(() => {
    if (editingInvoice) {
      setUpdateInvoice({
        dueDate: editingInvoice.due_date.split('T')[0], // Convert to YYYY-MM-DD format
        notes: editingInvoice.notes || '',
        discountAmount: editingInvoice.discount_amount,
        paymentStatus: editingInvoice.payment_status,
        paymentMethod: editingInvoice.payment_method || ''
      });
    }
  }, [editingInvoice]);

  return {
    // State
    invoices,
    setInvoices,
    loading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    currentPage,
    totalCount,
    totalPages,
    expandedInvoices,
    currentUploadId,
    setCurrentUploadId,
    showAddModal,
    setShowAddModal,
    showUpdateModal,
    setShowUpdateModal,
    editingInvoice,
    setEditingInvoice,
    newInvoice,
    setNewInvoice,
    updateInvoice,
    setUpdateInvoice,
    
    // Functions
    loadInvoices: loadInvoicesWrapper,
    toggleExpansion,
    handlePageChange,
    itemsPerPage: ITEMS_PER_PAGE
  };
}

