import { useState, useCallback } from 'react';
import FileUpload from '../components/FileUpload';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWebSocket } from '../context/WebSocketContext';
import Layout from '../components/Layout';

// Import types
import { NewProduct, ManualUpdateProduct, EditingPrice, GstSuggestion } from './inventory/types/inventory.types';

// Import constants
import { DEFAULT_GST_RATE } from './inventory/constants/inventoryConstants';

// Import hooks
import { useInventoryManagement } from './inventory/hooks/useInventoryManagement';
import { useInventoryFilters } from './inventory/hooks/useInventoryFilters';
import { useWebSocketInventory } from './inventory/hooks/useWebSocketInventory';

// Import handlers
import { handlePriceEdit, handlePriceSave, handlePriceCancel } from './inventory/handlers/priceHandlers';
import { handleFileUpload, handleCSVUpload } from './inventory/handlers/fileHandlers';
import { handleAddProduct, handleManualUpdate } from './inventory/handlers/productHandlers';
import { handleDownloadCSV, handleDownloadExcel, handleDownloadPDF } from './inventory/handlers/exportHandlers';

// Import components
import { MetricsCards } from './inventory/components/MetricsCards';
import { SearchToolbar } from './inventory/components/SearchToolbar';
import { ProductsTable } from './inventory/components/ProductsTable';

// Import modals
import AddProductModal from './inventory/modals/AddProductModal';
import UpdateProductModal from './inventory/modals/UpdateProductModal';
import ProcessingErrorsModal from './inventory/modals/ProcessingErrorsModal';

const Inventory = () => {
    const { user } = useAuth();
    useTheme();
    const { isConnected } = useWebSocket();
    const userRole = user?.role || 'admin';

    // Use custom hooks for state management
    const {
        products,
        setProducts,
        totalProducts,
        setTotalProducts,
        loading,
        initialLoading,
        searchTerm,
        setSearchTerm,
        categoryFilter,
        setCategoryFilter,
        stockStatusFilter,
        setStockStatusFilter,
        currentPage,
        totalStock,
        setTotalStock,
        lowStockCount,
        setLowStockCount,
        expandedProducts,
        toggleExpansion,
        processingErrors,
        updateProcessingErrors,
        clearProcessingErrors,
        currentUploadId,
        setCurrentUploadId,
        loadProducts,
        loadMetrics,
        handlePageChange,
        itemsPerPage
    } = useInventoryManagement();

    const { categories } = useInventoryFilters(products);

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showManualUpdateModal, setShowManualUpdateModal] = useState(false);
    const [showErrorsModal, setShowErrorsModal] = useState(false);
    
    // Form states
    const [newProduct, setNewProduct] = useState<NewProduct>({
        name: '',
        category: '',
        brand: '',
        description: '',
        stock: 0,
        reorderLevel: 0,
        unitPrice: 0,
        sellingPrice: 0,
        hsn_code: '',
        gst_rate: DEFAULT_GST_RATE
    });
    
    const [manualUpdateProduct, setManualUpdateProduct] = useState<ManualUpdateProduct>({
        productId: 0,
        productName: '',
        sku: '',
        brand: '',
        description: '',
        stock: 0,
        reorderLevel: 0,
        hsn_code: '',
        gst_rate: DEFAULT_GST_RATE
    });
    
    const [editingPrice, setEditingPrice] = useState<EditingPrice | null>(null);
    const [gstSuggestion, setGstSuggestion] = useState<GstSuggestion | null>(null);
    const [gstSuggestionUpdate, setGstSuggestionUpdate] = useState<GstSuggestion | null>(null);

    // WebSocket integration
    useWebSocketInventory({
        isConnected,
        products,
        setProducts,
        setTotalProducts,
        setTotalStock,
        setLowStockCount,
        loadMetrics
    });

    // Price handlers with state
    const handlePriceEditWrapper = useCallback((productId: number, currentPrice: number, priceType: 'cost' | 'selling' = 'cost') => {
        handlePriceEdit(productId, currentPrice, setEditingPrice, priceType);
    }, []);

    const handlePriceSaveWrapper = useCallback(async (productId: number) => {
        await handlePriceSave(productId, editingPrice, setEditingPrice, setProducts);
    }, [editingPrice, setProducts]);

    const handlePriceCancelWrapper = useCallback(() => {
        handlePriceCancel(setEditingPrice);
    }, []);
    
    // File upload handlers
    const handleFileUploadWrapper = useCallback(async (file: File) => {
        await handleFileUpload(
            file,
            setCurrentUploadId,
            updateProcessingErrors,
            loadProducts,
            loadMetrics
        );
    }, [loadProducts, loadMetrics, updateProcessingErrors]);

    const handleCSVUploadWrapper = useCallback(async (file: File) => {
        await handleCSVUpload(
            file,
            setCurrentUploadId,
            loadProducts,
            loadMetrics
        );
    }, [loadProducts, loadMetrics]);

    // Product handlers
    const handleAddProductWrapper = useCallback(async () => {
        await handleAddProduct(
            newProduct,
            setShowAddModal,
            setNewProduct,
            loadProducts,
            loadMetrics,
            currentPage
        );
    }, [newProduct, currentPage, loadProducts, loadMetrics]);

    const handleManualUpdateWrapper = useCallback(async () => {
        await handleManualUpdate(
            manualUpdateProduct,
            setShowManualUpdateModal,
            setManualUpdateProduct,
            setProducts,
            loadMetrics
        );
    }, [manualUpdateProduct, setProducts, loadMetrics]);

    // Export handlers
    const handleDownloadCSVWrapper = useCallback(() => {
        handleDownloadCSV(products);
    }, [products]);

    const handleDownloadExcelWrapper = useCallback(() => {
        handleDownloadExcel(products);
    }, [products]);

    const handleDownloadPDFWrapper = useCallback(() => {
        handleDownloadPDF(products);
    }, [products]);


    // Total pages calculation
    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    // Only show full-page loading on initial load
    if (initialLoading) {
        return (
            <Layout>
                <h1 className="text-3xl font-bold heading-gradient mb-6">Inventory</h1>
                <div className="flex justify-center items-center h-64">
                    <div className="text-lg text-slate-300">Loading inventory...</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <h1 className="text-3xl font-bold heading-gradient mb-6">Inventory</h1>

            <MetricsCards
                totalProducts={totalProducts}
                totalStock={totalStock}
                lowStockCount={lowStockCount}
            />

            {userRole === 'admin' && (
                <>
                    <div>
                        <div className="mb-6 flex items-center space-x-4">
                            <FileUpload 
                                onFileUpload={handleFileUploadWrapper} 
                                buttonLabel="Upload CSV" 
                                showProgress={true}
                                uploadId={currentUploadId || undefined}
                                onProcessingErrors={updateProcessingErrors}
                            />
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center">
                                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mr-2">CSV Upload Format:</h3>
                                <div className="relative group">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-blue-600 dark:text-blue-300 cursor-pointer">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                    </svg>
                                    <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-80 p-3 rounded-lg shadow-lg bg-gray-800 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                        <p className="mb-1 font-semibold">Your CSV file should include these columns:</p>
                                        <p className="font-mono text-xs mb-2">product_name, category, brand, description, stock_quantity, cost_price, selling_price, reorder_level, hsn_code, gst_rate</p>
                                        <p className="mt-2"><strong>Example:</strong></p>
                                        <p className="font-mono text-xs mb-2">iPhone 15, Electronics, Apple, Latest iPhone model, 50, 25000.00, 30000.00, 10, 85171200, 18</p>
                                        <p className="mt-1 text-xs"><strong>Required:</strong> product_name, category, stock_quantity, cost_price</p>
                                        <p className="text-xs"><strong>Optional:</strong> brand, description, selling_price, reorder_level, hsn_code, gst_rate (defaults to 18%)</p>
                                        <p className="mt-1 text-xs"><strong>Note:</strong> SKU will be auto-generated for each product</p>
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-800 rotate-45"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mb-6 space-y-2">
                            <button
                                onClick={() => {
                                    setNewProduct({
                                        name: '',
                                        category: '',
                                        brand: '',
                                        description: '',
                                        stock: 0,
                                        reorderLevel: 0,
                                        unitPrice: 0,
                                        sellingPrice: 0,
                                        hsn_code: '',
                                        gst_rate: DEFAULT_GST_RATE
                                    });
                                    setShowAddModal(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out"
                            >
                                Add New Product
                            </button>
                        </div>
                    </div>
                    <SearchToolbar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        stockStatusFilter={stockStatusFilter}
                        setStockStatusFilter={setStockStatusFilter}
                        categories={categories}
                        processingErrors={processingErrors}
                        setShowErrorsModal={setShowErrorsModal}
                        handleFileUpload={handleFileUploadWrapper}
                        handleCSVUpload={handleCSVUploadWrapper}
                        handleDownloadCSV={handleDownloadCSVWrapper}
                        handleDownloadExcel={handleDownloadExcelWrapper}
                        handleDownloadPDF={handleDownloadPDFWrapper}
                        currentUploadId={currentUploadId}
                    />
                </>
            )}

            <div className="mt-8">
                <ProductsTable
                    products={products}
                    userRole={userRole}
                    editingPrice={editingPrice}
                    setEditingPrice={setEditingPrice}
                    handlePriceEdit={handlePriceEditWrapper}
                    handlePriceSave={handlePriceSaveWrapper}
                    handlePriceCancel={handlePriceCancelWrapper}
                    setManualUpdateProduct={setManualUpdateProduct}
                    setShowManualUpdateModal={setShowManualUpdateModal}
                    expandedProducts={expandedProducts}
                    toggleProductExpansion={toggleExpansion}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalProducts={totalProducts}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    loading={loading}
                />
            </div>

            <AddProductModal
                show={showAddModal}
                newProduct={newProduct}
                gstSuggestion={gstSuggestion}
                onProductChange={setNewProduct}
                onGstSuggestionChange={setGstSuggestion}
                onSubmit={handleAddProductWrapper}
                onClose={() => setShowAddModal(false)}
            />

            <UpdateProductModal
                show={showManualUpdateModal}
                manualUpdateProduct={manualUpdateProduct}
                gstSuggestion={gstSuggestionUpdate}
                onProductChange={setManualUpdateProduct}
                onGstSuggestionChange={setGstSuggestionUpdate}
                onSubmit={handleManualUpdateWrapper}
                onClose={() => setShowManualUpdateModal(false)}
            />

            <ProcessingErrorsModal
                show={showErrorsModal}
                errors={processingErrors}
                onClear={() => {
                    clearProcessingErrors();
                    setShowErrorsModal(false);
                }}
                onClose={() => setShowErrorsModal(false)}
            />
        </Layout>
    );
};

export default Inventory;
