// Product expansion toggle utility

export function toggleProductExpansion(
    expandedProducts: Set<number>,
    productId: number
): Set<number> {
    const newSet = new Set(expandedProducts);
    if (newSet.has(productId)) {
        newSet.delete(productId);
    } else {
        newSet.add(productId);
    }
    return newSet;
}

