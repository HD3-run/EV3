// Custom hook for WebSocket catalog updates
import { useEffect, useRef } from 'react';
import { useWebSocket } from '../../../context/WebSocketContext';
import { Product } from '../types/catalog.types';

interface UseWebSocketCatalogProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  loadProducts: () => Promise<void>;
}

export function useWebSocketCatalog({
  products,
  setProducts,
  loadProducts
}: UseWebSocketCatalogProps) {
  const { isConnected, socket } = useWebSocket();
  // Use refs to avoid stale closures
  const productsRef = useRef(products);
  const loadProductsRef = useRef(loadProducts);
  const lastUpdateTimeRef = useRef<Map<number, number>>(new Map());
  
  // Update refs when values change
  useEffect(() => {
    productsRef.current = products;
  }, [products]);
  
  useEffect(() => {
    loadProductsRef.current = loadProducts;
  }, [loadProducts]);

  useEffect(() => {
    if (!isConnected) {
      console.log('⚠️ WebSocket not connected, skipping catalog updates');
      return;
    }

    const handleInventoryUpdate = (data: any) => {
      console.log('📡 WebSocket inventory update received for catalog:', data);
      
      if (data.productId) {
        // Normalize productId to number for comparison
        const productId = typeof data.productId === 'string' ? parseInt(data.productId, 10) : Number(data.productId);
        const now = Date.now();
        lastUpdateTimeRef.current.set(productId, now);
        
        console.log('🔍 Looking for product with ID:', productId, 'Type:', typeof productId);
        console.log('🔍 Current products IDs:', productsRef.current.map(p => ({ id: p.product_id, type: typeof p.product_id })));
        
        setProducts(prevProducts => {
          // Compare with both string and number to handle type mismatches
          const productExists = prevProducts.some(p => {
            const pid = typeof p.product_id === 'string' ? parseInt(p.product_id, 10) : Number(p.product_id);
            return pid === productId;
          });
          console.log('🔍 Product exists in current list?', productExists);
          
          if (!productExists) {
            console.log('⚠️ Product not found in current list, skipping update (not in current view)');
            return prevProducts;
          }
          
          // Create a new array to ensure React detects the change
          let hasChanges = false;
          const updated = prevProducts.map(product => {
            // Normalize product_id for comparison
            const pid = typeof product.product_id === 'string' ? parseInt(product.product_id, 10) : Number(product.product_id);
            if (pid === productId) {
              const oldStock = product.total_stock || product.quantity_available || 0;
              const newStock = data.quantity !== undefined ? Number(data.quantity) : oldStock;
              
              // Check if any value actually changed
              const nameChanged = data.productName && product.product_name !== data.productName;
              const skuChanged = data.sku && product.sku !== data.sku;
              const stockChanged = oldStock !== newStock;
              
              if (stockChanged || nameChanged || skuChanged) {
                hasChanges = true;
                console.log('🔄 Updating product stock via WebSocket:', product.product_id, 'old:', oldStock, '→ new:', newStock);
                // Create a completely new object to ensure React detects the change
                return {
                  ...product,
                  quantity_available: newStock,
                  total_stock: newStock,
                  ...(data.productName && { product_name: data.productName }),
                  ...(data.sku && { sku: data.sku })
                };
              } else {
                console.log('⏭️ No changes detected, skipping update:', product.product_id);
              }
            }
            return product;
          });
          
          // Always return a new array reference to ensure React detects the change
          // Even if no changes, create a new array to trigger React re-render
          const newArray = [...updated];
          
          const updatedProduct = newArray.find(p => {
            const pid = typeof p.product_id === 'string' ? parseInt(p.product_id, 10) : Number(p.product_id);
            return pid === productId;
          });
          console.log('✅ Products updated via WebSocket, new state:', updatedProduct);
          console.log('📊 Full updated products array length:', newArray.length);
          console.log('🔄 Array reference changed:', newArray !== prevProducts);
          console.log('🔄 Product object reference changed:', hasChanges ? 'Yes (updated)' : 'No (same)');
          return newArray;
        });
        
        // No refresh needed - WebSocket updates handle real-time changes directly
        // Removed debounced refresh since state updates are working correctly
      }
    };

    const handleInventoryStockUpdate = (data: any) => {
      console.log('📡 WebSocket inventory stock update received for catalog:', data);
      
      if (data.productId && data.quantity !== undefined) {
        // Normalize productId to number for comparison
        const productId = typeof data.productId === 'string' ? parseInt(data.productId, 10) : Number(data.productId);
        const now = Date.now();
        lastUpdateTimeRef.current.set(productId, now);
        
        console.log('🔍 Looking for product with ID (stock-updated):', productId, 'Type:', typeof productId);
        
        setProducts(prevProducts => {
          // Compare with both string and number to handle type mismatches
          const productExists = prevProducts.some(p => {
            const pid = typeof p.product_id === 'string' ? parseInt(p.product_id, 10) : Number(p.product_id);
            return pid === productId;
          });
          console.log('🔍 Product exists in current list (stock-updated)?', productExists);
          
          if (!productExists) {
            console.log('⚠️ Product not found in current list (stock-updated), skipping update (not in current view)');
            return prevProducts;
          }
          
          // Create a new array to ensure React detects the change
          let hasChanges = false;
          const updated = prevProducts.map(product => {
            // Normalize product_id for comparison
            const pid = typeof product.product_id === 'string' ? parseInt(product.product_id, 10) : Number(product.product_id);
            if (pid === productId) {
              const oldStock = product.total_stock || product.quantity_available || 0;
              const newStock = Number(data.quantity);
              
              // Only update if stock actually changed
              if (oldStock !== newStock) {
                hasChanges = true;
                console.log('🔄 Updating product stock via WebSocket (stock-updated):', product.product_id, 'old:', oldStock, '→ new:', newStock);
                // Create a completely new object to ensure React detects the change
                return {
                  ...product,
                  quantity_available: newStock,
                  total_stock: newStock
                };
              } else {
                console.log('⏭️ Stock unchanged (stock-updated), skipping update:', product.product_id, 'stock:', oldStock);
              }
            }
            return product;
          });
          
          // Always return a new array reference to ensure React detects the change
          // Even if no changes, create a new array to trigger React re-render
          const newArray = [...updated];
          
          const updatedProduct = newArray.find(p => {
            const pid = typeof p.product_id === 'string' ? parseInt(p.product_id, 10) : Number(p.product_id);
            return pid === productId;
          });
          console.log('✅ Products updated via WebSocket (stock-updated), new state:', updatedProduct);
          console.log('📊 Full updated products array length:', newArray.length);
          console.log('🔄 Array reference changed (stock-updated):', newArray !== prevProducts);
          console.log('🔄 Product object reference changed (stock-updated):', hasChanges ? 'Yes (updated)' : 'No (same)');
          return newArray;
        });
        
        // No refresh needed - WebSocket updates handle real-time changes directly
        // Removed debounced refresh since state updates are working correctly - shorter delay for faster sync
      }
    };

    // Use socket from context or fallback to window.io for backward compatibility
    const socketInstance = socket || (window as any).io;
    
    if (!socketInstance) {
      console.error('❌ Socket not available, will use polling fallback');
      // Fallback: If WebSocket isn't available, use polling every 3 seconds
      const pollingInterval = setInterval(() => {
        if (!document.hidden) {
          console.log('🔄 Polling fallback: Refreshing products (WebSocket not available)');
          loadProductsRef.current();
        }
      }, 3000);
      
      return () => {
        clearInterval(pollingInterval);
      };
    }

    console.log('🔌 Setting up WebSocket listeners for catalog updates');
    console.log('🔌 Socket connected status:', socketInstance.connected);
    console.log('🔌 Socket ID:', socketInstance.id);
    
    // Register listeners - they'll work once connected
    // Register them regardless of connection status (they'll queue until connected)
    socketInstance.on('inventory-updated', handleInventoryUpdate);
    socketInstance.on('inventory-stock-updated', handleInventoryStockUpdate);
    
    console.log('✅ WebSocket listeners registered for catalog updates');
    
    // Test listener to verify ANY events are being received (for debugging)
    const testHandler = (eventName: string, ...args: any[]) => {
      if (eventName === 'inventory-updated' || eventName === 'inventory-stock-updated') {
        console.log('🧪 TEST: Received inventory event:', eventName, args[0]);
      }
    };
    socketInstance.onAny(testHandler);
    
    return () => {
      console.log('🧹 Cleaning up WebSocket listeners for catalog');
      socketInstance.off('inventory-updated', handleInventoryUpdate);
      socketInstance.off('inventory-stock-updated', handleInventoryStockUpdate);
      socketInstance.offAny(testHandler);
    };
  }, [isConnected, socket, setProducts]); // Removed products and loadProducts from deps
}

