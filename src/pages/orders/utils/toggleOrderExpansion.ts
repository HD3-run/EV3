// Utility function for toggling order expansion state

/**
 * Toggle expanded state of an order
 */
export const toggleOrderExpansion = (
  orderId: string,
  _expandedOrders: Set<string>,
  setExpandedOrders: (setter: (prev: Set<string>) => Set<string>) => void
) => {
  setExpandedOrders(prev => {
    const newSet = new Set(prev);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    return newSet;
  });
};

