// Custom hook for inventory state management and data loading
import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types/inventory.types';
import { loadProducts, loadMetrics, LoadProductsParams } from '../queries/productQueries';
import { loadProcessingErrors, saveProcessingErrors } from '../utils/clearProcessingErrors';
import { toggleProductExpansion } from '../utils/toggleExpansion';
import { ITEMS_PER_PAGE } from '../constants/inventoryConstants';

export function useInventoryManagement() {
    const [products, setProducts] = useState<Product[]>([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [stockStatusFilter, setStockStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalStock, setTotalStock] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
    const [processingErrors, setProcessingErrors] = useState<string[]>(loadProcessingErrors);
    const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);

    const updateProcessingErrors = useCallback((errors: string[]) => {
        setProcessingErrors(errors);
        saveProcessingErrors(errors);
    }, []);

    const clearProcessingErrors = useCallback(() => {
        setProcessingErrors([]);
        saveProcessingErrors([]);
    }, []);

    const toggleExpansion = useCallback((productId: number) => {
        setExpandedProducts(prev => toggleProductExpansion(prev, productId));
    }, []);

    const loadProductsWrapper = useCallback(async (page?: number, stockStatus?: string, isInitialLoad: boolean = false) => {
        try {
            // Only show full-page loading on initial load or filter changes
            if (isInitialLoad || !page) {
                setLoading(true);
            }
            const pageToLoad = page ?? 1; // Default to page 1 if no page provided
            const params: LoadProductsParams = {
                page: pageToLoad,
                searchTerm,
                categoryFilter: categoryFilter !== 'all' ? categoryFilter : undefined,
                stockStatusFilter: stockStatus || (stockStatusFilter !== 'all' ? stockStatusFilter : undefined)
            };
            
            const result = await loadProducts(params);
            setProducts(result.products);
            setTotalProducts(result.pagination.total);
            setCurrentPage(pageToLoad); // Update current page state to match the loaded page
            setLoading(false);
            setInitialLoading(false);
        } catch (error) {
            console.error('Error loading products:', error);
            setLoading(false);
            setInitialLoading(false);
        }
    }, [searchTerm, categoryFilter, stockStatusFilter]);

    const loadMetricsWrapper = useCallback(async () => {
        try {
            const metrics = await loadMetrics();
            setTotalStock(metrics.totalStock);
            setLowStockCount(metrics.lowStockCount);
        } catch (error) {
            console.error('Error loading inventory metrics:', error);
        }
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const stockStatusParam = urlParams.get('stockStatus');
        
        if (stockStatusParam && ['all', 'in', 'low'].includes(stockStatusParam)) {
            setStockStatusFilter(stockStatusParam);
            loadProductsWrapper(1, stockStatusParam, true);
        } else {
            loadProductsWrapper(1, undefined, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadMetricsWrapper();
    }, [loadMetricsWrapper]);

    useEffect(() => {
        setCurrentPage(1);
        loadProductsWrapper(1, undefined, true); // Filter changes should show loading
    }, [searchTerm, categoryFilter, stockStatusFilter, loadProductsWrapper]);

    useEffect(() => {
        const handleFocus = () => {
            loadMetricsWrapper();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [loadMetricsWrapper]);

    const handlePageChange = useCallback((newPage: number) => {
        loadProductsWrapper(newPage, undefined, false); // Pagination should not show full-page loading
    }, [loadProductsWrapper]);

        return {
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
        setCurrentPage,
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
        loadProducts: loadProductsWrapper,
        loadMetrics: loadMetricsWrapper,
        handlePageChange,
        itemsPerPage: ITEMS_PER_PAGE
    };
}

