import { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye, 
  RefreshCw, 
  AlertTriangle,
  Truck,
  DollarSign,
  Search
} from 'lucide-react';

interface ReturnItem {
  return_item_id: number;
  quantity: number;
  unit_price: number;
  total_amount: number;
  product_name: string;
  sku: string;
  brand: string;
  category: string;
}

interface Return {
  return_id: number;
  order_id: number;
  customer_id: number;
  reason: string;
  total_refund_amount: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  receipt_status: 'pending' | 'received' | 'inspected' | 'rejected';
  status: 'pending' | 'processed';
  return_date: string;
  created_at: string;
  updated_at: string;
  order_date: string;
  order_total: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  return_items: ReturnItem[];
}

interface ReturnFilters {
  approval_status: string;
  receipt_status: string;
  status: string;
  date_range: string;
}

const Returns = () => {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{
    field: 'approval_status' | 'receipt_status' | 'status';
    value: string;
    label: string;
  } | null>(null);
  const [confirmationWord, setConfirmationWord] = useState('');
  const [displayedWord, setDisplayedWord] = useState('');
  const [filters, setFilters] = useState<ReturnFilters>({
    approval_status: '',
    receipt_status: '',
    status: '',
    date_range: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReturns, setTotalReturns] = useState(0);
  const [itemsPerPage] = useState(50);

  // Load returns data with pagination
  const loadReturns = async (page: number = currentPage) => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(`/api/returns?page=${page}&limit=${itemsPerPage}`), {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setReturns(data.returns || []);
        if (data.pagination) {
          setTotalReturns(data.pagination.total);
        }
      } else {
        console.error('Failed to load returns');
      }
    } catch (error) {
      console.error('Error loading returns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);
  
  useEffect(() => {
    setCurrentPage(1);
    loadReturns(1);
  }, [searchTerm, filters.approval_status, filters.receipt_status, filters.status]);

  // Predefined confirmation words
  const confirmationWords = ['hallelujah', 'hahaha', 'yezzir', 'suuure', 'mmmhhmm', 'ovio'];
  
  // Generate random confirmation word
  const generateConfirmationWord = () => {
    const randomIndex = Math.floor(Math.random() * confirmationWords.length);
    return confirmationWords[randomIndex];
  };

  // Handle status change with confirmation
  const handleStatusChange = (field: 'approval_status' | 'receipt_status' | 'status', value: string) => {
    if (!selectedReturn) return;

    const currentValue = selectedReturn[field];
    
    // If trying to change to the same value, do nothing
    if (currentValue === value) return;

    // Check if this is a valid status change based on logical progression rules
    const isValid = isValidStatusChange(field, currentValue, value, selectedReturn);
    
    if (!isValid) {
      alert('Invalid status change. Please follow the logical progression rules.');
      return;
    }

    // Special handling: If approval_status is set to 'rejected', automatically set receipt_status to 'rejected'
    if (field === 'approval_status' && value === 'rejected') {
      // Update both approval_status and receipt_status
      setPendingStatusUpdate({
        field: 'approval_status',
        value: 'rejected',
        label: 'Reject approval (will also set receipt to rejected)'
      });
    } else {
      // Get the label for the status
      const getStatusLabel = (field: string, value: string) => {
        switch (field) {
          case 'approval_status':
            return value === 'approved' ? 'Approve' : value === 'rejected' ? 'Reject' : 'Set Pending';
          case 'receipt_status':
            return value === 'received' ? 'Mark as Received' : 
                   value === 'rejected' ? 'Reject Receipt' : 'Set Pending';
          case 'status':
            return value === 'processed' ? 'Mark as Processed' : 'Set Pending';
          default:
            return `Set ${value}`;
        }
      };

      // Set up the pending update and show confirmation
      setPendingStatusUpdate({
        field,
        value,
        label: getStatusLabel(field, value)
      });
    }
    const word = generateConfirmationWord();
    setDisplayedWord(word);
    setConfirmationWord('');
    setShowConfirmationModal(true);
  };

  // Check if a status change is valid based on logical progression rules
  const isValidStatusChange = (field: string, currentValue: string, newValue: string, returnData?: Return) => {
    if (!returnData) return false;

    // Special logic for approval_status
    if (field === 'approval_status') {
      if (currentValue === 'pending') {
        return ['approved', 'rejected'].includes(newValue);
      }
      // Once approved or rejected, cannot change
      return false;
    }

    // Special logic for receipt_status based on approval_status
    if (field === 'receipt_status') {
      // Can only change receipt_status if approval_status is approved or rejected
      if (returnData.approval_status === 'pending') {
        return false; // Must approve/reject first
      }
      
      // If approval is rejected, can only set receipt_status to rejected
      if (returnData.approval_status === 'rejected') {
        return newValue === 'rejected';
      }
      
      // If approval is approved
      if (returnData.approval_status === 'approved') {
        // If current receipt_status is 'received', cannot change it anymore
        if (currentValue === 'received') {
          return false; // Final state - no more changes
        }
        
        // If current receipt_status is 'pending', can set to received or rejected
        if (currentValue === 'pending') {
          return ['received', 'rejected'].includes(newValue);
        }
        
        // If current receipt_status is 'rejected', cannot change
        return false;
      }
    }

    // Special logic for processing status
    if (field === 'status') {
      // Can only change processing status if receipt_status is either 'received' or 'rejected'
      if (returnData.receipt_status === 'pending') {
        return false; // Must set receipt_status first
      }
      
      // If receipt_status is 'received', can set processing to 'processed'
      if (returnData.receipt_status === 'received') {
        return newValue === 'processed';
      }
      
      // If receipt_status is 'rejected', cannot set processing to 'processed'
      if (returnData.receipt_status === 'rejected') {
        return false; // Cannot process a rejected return
      }
      
      // If already processed, cannot change
      if (currentValue === 'processed') {
        return false;
      }
    }

    return false; // Default to false for any unhandled cases
  };

  // Confirm and execute status update
  const confirmStatusUpdate = async () => {
    if (!pendingStatusUpdate || !selectedReturn) return;

    // Validate the entered word
    if (confirmationWord.toLowerCase() !== displayedWord.toLowerCase()) {
      alert('You typed wrong! Please enter the exact word shown above.');
      return;
    }

    try {
      setUpdating(true);
      const updates = { [pendingStatusUpdate.field]: pendingStatusUpdate.value };
      
      const response = await fetch(`/api/returns/${selectedReturn.return_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Status updated:', data.message);
        
        // Refresh returns list to get updated data including total_refund_amount
        await loadReturns(currentPage);
        
        // Fetch the full updated return data to ensure all fields are current
        if (data.return) {
          // Use the updated return from the response, or fetch it fresh
          const updatedReturnResponse = await fetch(getApiUrl(`/api/returns/${selectedReturn.return_id}`), {
            credentials: 'include'
          });
          if (updatedReturnResponse.ok) {
            const returnData = await updatedReturnResponse.json();
            setSelectedReturn(returnData.return);
          } else {
            // Fallback to response data if fetch fails
            setSelectedReturn({ ...selectedReturn, ...data.return });
          }
        } else {
          // Fallback: update with status changes
          setSelectedReturn({ ...selectedReturn, ...updates });
        }
        
        // Show success message
        alert(data.message);
        
        // Close modals
        setShowConfirmationModal(false);
        setShowUpdateModal(false);
        setPendingStatusUpdate(null);
        setConfirmationWord('');
        setDisplayedWord('');
      } else {
        const errorData = await response.json();
        alert(`Failed to update status: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating return status:', error);
      alert('Failed to update return status');
    } finally {
      setUpdating(false);
    }
  };


  // Filter returns based on current filters and search
  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = searchTerm === '' || 
      returnItem.return_id.toString().includes(searchTerm) ||
      returnItem.order_id.toString().includes(searchTerm) ||
      returnItem.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.customer_phone.includes(searchTerm);

    const matchesApproval = filters.approval_status === '' || 
      returnItem.approval_status === filters.approval_status;
    
    const matchesReceipt = filters.receipt_status === '' || 
      returnItem.receipt_status === filters.receipt_status;
    
    const matchesStatus = filters.status === '' || 
      returnItem.status === filters.status;

    return matchesSearch && matchesApproval && matchesReceipt && matchesStatus;
  });

  // Get status badge styling
  const getStatusBadge = (status: string, type: 'approval' | 'receipt' | 'status') => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    
    switch (type) {
      case 'approval':
        switch (status) {
          case 'approved': return `${baseClasses} bg-green-100 text-green-800`;
          case 'rejected': return `${baseClasses} bg-red-100 text-red-800`;
          default: return `${baseClasses} bg-yellow-100 text-yellow-800`;
        }
      case 'receipt':
        switch (status) {
          case 'received': return `${baseClasses} bg-blue-100 text-blue-800`;
          case 'inspected': return `${baseClasses} bg-purple-100 text-purple-800`;
          case 'rejected': return `${baseClasses} bg-red-100 text-red-800`;
          default: return `${baseClasses} bg-gray-100 text-gray-800`;
        }
      case 'status':
        switch (status) {
          case 'processed': return `${baseClasses} bg-green-100 text-green-800`;
          default: return `${baseClasses} bg-yellow-100 text-yellow-800`;
        }
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string, type: 'approval' | 'receipt' | 'status') => {
    switch (type) {
      case 'approval':
        switch (status) {
          case 'approved': return <CheckCircle className="w-4 h-4" />;
          case 'rejected': return <XCircle className="w-4 h-4" />;
          default: return <Clock className="w-4 h-4" />;
        }
      case 'receipt':
        switch (status) {
          case 'received': return <Package className="w-4 h-4" />;
          case 'inspected': return <Eye className="w-4 h-4" />;
          case 'rejected': return <XCircle className="w-4 h-4" />;
          default: return <Clock className="w-4 h-4" />;
        }
      case 'status':
        switch (status) {
          case 'processed': return <CheckCircle className="w-4 h-4" />;
          default: return <Clock className="w-4 h-4" />;
        }
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Calculate return metrics
  const metrics = {
    total: returns.length,
    pending: returns.filter(r => r.approval_status === 'pending').length,
    approved: returns.filter(r => r.approval_status === 'approved').length,
    received: returns.filter(r => r.receipt_status === 'received').length,
    processed: returns.filter(r => r.status === 'processed').length,
    totalRefund: returns.reduce((sum, r) => sum + parseFloat(r.total_refund_amount.toString()), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-300">Loading returns...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-indigo-400">Return Management</h1>
          <p className="text-gray-300">Track and manage product returns</p>
        </div>
        <button
          onClick={() => loadReturns()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800/50 p-6 rounded-lg">
          <div className="flex items-center">
            <Package className="w-8 h-8 text-blue-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-300">Total Returns</p>
              <p className="text-2xl font-bold text-white">{metrics.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-lg">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-300">Pending Approval</p>
              <p className="text-2xl font-bold text-white">{metrics.pending}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-300">Approved</p>
              <p className="text-2xl font-bold text-white">{metrics.approved}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-lg">
          <div className="flex items-center">
            <Truck className="w-8 h-8 text-purple-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-300">Received</p>
              <p className="text-2xl font-bold text-white">{metrics.received}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-300">Processed</p>
              <p className="text-2xl font-bold text-white">{metrics.processed}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-lg">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-300">Total Refund</p>
              <p className="text-2xl font-bold text-white">₹{metrics.totalRefund.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by return ID, order ID, customer name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-white placeholder-gray-400"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filters.approval_status}
              onChange={(e) => setFilters({...filters, approval_status: e.target.value})}
              className="px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
            >
              <option value="">All Approval Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            
            <select
              value={filters.receipt_status}
              onChange={(e) => setFilters({...filters, receipt_status: e.target.value})}
              className="px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
            >
              <option value="">All Receipt Status</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="inspected">Inspected</option>
              <option value="rejected">Rejected</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-gray-800 rounded-lg shadow border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Return Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Order Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredReturns.map((returnItem) => (
                <tr key={returnItem.return_id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Return #{returnItem.return_id}
                      </div>
                      <div className="text-sm text-gray-300">
                        {new Date(returnItem.return_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {returnItem.return_items.length} item(s)
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {returnItem.customer_name}
                      </div>
                      <div className="text-sm text-gray-300">
                        {returnItem.customer_phone}
                      </div>
                      {returnItem.customer_email && (
                        <div className="text-xs text-gray-400">
                          {returnItem.customer_email}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Order #{returnItem.order_id}
                      </div>
                      <div className="text-sm text-gray-300">
                        {new Date(returnItem.order_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        ₹{returnItem.order_total}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        {getStatusIcon(returnItem.approval_status, 'approval')}
                        <span className={`ml-1 ${getStatusBadge(returnItem.approval_status, 'approval')}`}>
                          {returnItem.approval_status}
                        </span>
                      </div>
                      <div className="flex items-center">
                        {getStatusIcon(returnItem.receipt_status, 'receipt')}
                        <span className={`ml-1 ${getStatusBadge(returnItem.receipt_status, 'receipt')}`}>
                          {returnItem.receipt_status}
                        </span>
                      </div>
                      <div className="flex items-center">
                        {getStatusIcon(returnItem.status, 'status')}
                        <span className={`ml-1 ${getStatusBadge(returnItem.status, 'status')}`}>
                          {returnItem.status}
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      ₹{returnItem.total_refund_amount}
                    </div>
                    <div className="text-xs text-gray-400">
                      Refund Amount
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedReturn(returnItem);
                          setShowDetailsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReturn(returnItem);
                          setShowUpdateModal(true);
                        }}
                        className="text-green-600 hover:text-green-900 flex items-center"
                        disabled={updating}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${updating ? 'animate-spin' : ''}`} />
                        Update
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredReturns.length === 0 && (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No returns found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || Object.values(filters).some(f => f !== '') 
                ? 'Try adjusting your search or filters.' 
                : 'No returns have been submitted yet.'}
            </p>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {Math.ceil(totalReturns / itemsPerPage) > 1 && (() => {
        const totalPages = Math.ceil(totalReturns / itemsPerPage);
        const handlePrevious = () => {
          if (currentPage === 1) {
            // Wrap around to last page when on first page
            const newPage = totalPages;
            setCurrentPage(newPage);
            loadReturns(newPage);
          } else {
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            loadReturns(newPage);
          }
        };
        const handleNext = () => {
          if (currentPage >= totalPages) {
            // Wrap around to first page when on last page
            const newPage = 1;
            setCurrentPage(newPage);
            loadReturns(newPage);
          } else {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            loadReturns(newPage);
          }
        };
        return (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-t border-gray-700">
            <div className="flex items-center text-sm text-gray-300">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalReturns)} of {totalReturns} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevious}
                className="px-3 py-1 text-sm border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-300">
                Page {currentPage} of <button
                  onClick={() => {
                    setCurrentPage(totalPages);
                    loadReturns(totalPages);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                  title="Go to last page"
                >
                  {totalPages}
                </button>
              </span>
              <button
                onClick={handleNext}
                className="px-3 py-1 text-sm border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                Next
              </button>
            </div>
          </div>
        );
      })()}

      {/* Return Details Modal */}
      {showDetailsModal && selectedReturn && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-700 w-11/12 max-w-4xl shadow-lg rounded-md bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">
                Return Details - #{selectedReturn.return_id}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Return Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-white mb-2">Return Information</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div><span className="font-medium text-white">Return ID:</span> #{selectedReturn.return_id}</div>
                    <div><span className="font-medium text-white">Order ID:</span> #{selectedReturn.order_id}</div>
                    <div><span className="font-medium text-white">Return Date:</span> {new Date(selectedReturn.return_date).toLocaleDateString()}</div>
                    <div><span className="font-medium text-white">Reason:</span> {selectedReturn.reason}</div>
                    <div><span className="font-medium text-white">Refund Amount:</span> ₹{selectedReturn.total_refund_amount}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-white mb-2">Customer Information</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div><span className="font-medium text-white">Name:</span> {selectedReturn.customer_name}</div>
                    <div><span className="font-medium text-white">Phone:</span> {selectedReturn.customer_phone}</div>
                    {selectedReturn.customer_email && (
                      <div><span className="font-medium text-white">Email:</span> {selectedReturn.customer_email}</div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Status Timeline */}
              <div>
                <h4 className="font-medium text-white mb-3">Status Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center">
                    {getStatusIcon(selectedReturn.approval_status, 'approval')}
                    <span className="ml-2 text-sm text-gray-300">
                      <span className="font-medium text-white">Approval Status:</span>
                      <span className={`ml-2 ${getStatusBadge(selectedReturn.approval_status, 'approval')}`}>
                        {selectedReturn.approval_status}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center">
                    {getStatusIcon(selectedReturn.receipt_status, 'receipt')}
                    <span className="ml-2 text-sm text-gray-300">
                      <span className="font-medium text-white">Receipt Status:</span>
                      <span className={`ml-2 ${getStatusBadge(selectedReturn.receipt_status, 'receipt')}`}>
                        {selectedReturn.receipt_status}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center">
                    {getStatusIcon(selectedReturn.status, 'status')}
                    <span className="ml-2 text-sm text-gray-300">
                      <span className="font-medium text-white">Processing Status:</span>
                      <span className={`ml-2 ${getStatusBadge(selectedReturn.status, 'status')}`}>
                        {selectedReturn.status}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Return Items */}
              <div>
                <h4 className="font-medium text-white mb-3">Returned Items</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">SKU</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Unit Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {selectedReturn.return_items.map((item) => (
                        <tr key={item.return_item_id}>
                          <td className="px-4 py-2 text-sm">
                            <div>
                              <div className="font-medium text-white">{item.product_name}</div>
                              <div className="text-gray-300">{item.brand} - {item.category}</div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-white">{item.sku}</td>
                          <td className="px-4 py-2 text-sm text-white">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-white">₹{item.unit_price}</td>
                          <td className="px-4 py-2 text-sm text-white">₹{item.total_amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && selectedReturn && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Update Return Status - #{selectedReturn.return_id}
              </h3>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approval Status
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedReturn.approval_status}
                  onChange={(e) => handleStatusChange('approval_status', e.target.value)}
                >
                  <option value="pending" disabled={selectedReturn.approval_status !== 'pending'}>
                    Pending {selectedReturn.approval_status !== 'pending' && '(Already Set)'}
                  </option>
                  <option 
                    value="approved" 
                    disabled={!isValidStatusChange('approval_status', selectedReturn.approval_status, 'approved', selectedReturn)}
                  >
                    Approved {selectedReturn.approval_status === 'approved' && '(Already Set)'}
                  </option>
                  <option 
                    value="rejected" 
                    disabled={!isValidStatusChange('approval_status', selectedReturn.approval_status, 'rejected', selectedReturn)}
                  >
                    Rejected {selectedReturn.approval_status === 'rejected' && '(Already Set)'}
                  </option>
                </select>
                {selectedReturn.approval_status !== 'pending' && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Status changes are irreversible
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receipt Status <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedReturn.receipt_status}
                  onChange={(e) => handleStatusChange('receipt_status', e.target.value)}
                >
                  <option value="pending" disabled={selectedReturn.receipt_status !== 'pending'}>
                    Pending {selectedReturn.receipt_status !== 'pending' && '(Already Set)'}
                  </option>
                  <option 
                    value="received" 
                    disabled={!isValidStatusChange('receipt_status', selectedReturn.receipt_status, 'received', selectedReturn)}
                  >
                    Received (Triggers Inventory Restock) {selectedReturn.receipt_status === 'received' && '(Already Set)'}
                  </option>
                  <option 
                    value="rejected" 
                    disabled={!isValidStatusChange('receipt_status', selectedReturn.receipt_status, 'rejected', selectedReturn)}
                  >
                    Rejected {selectedReturn.receipt_status === 'rejected' && '(Already Set)'}
                  </option>
                </select>
                {selectedReturn.approval_status === 'pending' && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Must approve or reject the return first
                  </p>
                )}
                {selectedReturn.approval_status === 'approved' && selectedReturn.receipt_status === 'pending' && (
                  <p className="text-xs text-blue-500 mt-1">
                    ℹ️ You can now mark as "Received" to restock inventory
                  </p>
                )}
                {selectedReturn.approval_status === 'rejected' && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Return rejected - receipt status automatically set to rejected
                  </p>
                )}
                {selectedReturn.receipt_status === 'received' && (
                  <p className="text-xs text-green-500 mt-1">
                    ✅ Inventory has been restocked - cannot change receipt status anymore
                  </p>
                )}
                {selectedReturn.receipt_status !== 'pending' && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Status changes are irreversible
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Processing Status
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedReturn.status}
                  onChange={(e) => handleStatusChange('status', e.target.value)}
                >
                  <option value="pending" disabled={selectedReturn.status !== 'pending'}>
                    Pending {selectedReturn.status !== 'pending' && '(Already Set)'}
                  </option>
                  <option 
                    value="processed" 
                    disabled={!isValidStatusChange('status', selectedReturn.status, 'processed', selectedReturn)}
                  >
                    Processed {selectedReturn.status === 'processed' && '(Already Set)'}
                  </option>
                </select>
                {selectedReturn.receipt_status === 'pending' && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Must set receipt status first (received or rejected)
                  </p>
                )}
                {selectedReturn.receipt_status === 'received' && selectedReturn.status === 'pending' && (
                  <p className="text-xs text-blue-500 mt-1">
                    ℹ️ You can now mark as "Processed" to complete the return
                  </p>
                )}
                {selectedReturn.receipt_status === 'rejected' && (
                  <p className="text-xs text-red-500 mt-1">
                    ⚠️ Cannot process a rejected return
                  </p>
                )}
                {selectedReturn.status === 'processed' && (
                  <p className="text-xs text-green-500 mt-1">
                    ✅ Return processing completed
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmationModal && pendingStatusUpdate && selectedReturn && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-700 w-11/12 max-w-md shadow-lg rounded-md bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">
                Confirm Status Change
              </h3>
              <button
                onClick={() => {
                  setShowConfirmationModal(false);
                  setPendingStatusUpdate(null);
                  setConfirmationWord('');
                  setDisplayedWord('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
                <div className="flex">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-200">
                      Irreversible Action
                    </h4>
                    <p className="text-sm text-yellow-300 mt-1">
                      You are about to <strong>{pendingStatusUpdate.label}</strong> for Return #{selectedReturn.return_id}. 
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {pendingStatusUpdate.field === 'receipt_status' && pendingStatusUpdate.value === 'received' && (
                <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
                  <div className="flex">
                    <Package className="w-5 h-5 text-blue-400 mt-0.5 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-200">
                        Inventory Restock
                      </h4>
                      <p className="text-sm text-blue-300 mt-1">
                        This will automatically restock inventory for all returned items.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enter confirmation word: <span className="font-mono text-lg font-bold text-blue-400">{displayedWord}</span>
                </label>
                <input
                  type="text"
                  placeholder="Type the word shown above"
                  value={confirmationWord}
                  onChange={(e) => setConfirmationWord(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg bg-gray-700 text-white placeholder-gray-400"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowConfirmationModal(false);
                    setPendingStatusUpdate(null);
                    setConfirmationWord('');
                    setDisplayedWord('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusUpdate}
                  disabled={updating || !confirmationWord.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {updating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Confirm & Update'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
