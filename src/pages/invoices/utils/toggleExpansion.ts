// Invoice expansion toggle utility

export function toggleInvoiceExpansion(
    expandedInvoices: Set<number>,
    invoiceId: number
): Set<number> {
    const newSet = new Set(expandedInvoices);
    if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
    } else {
        newSet.add(invoiceId);
    }
    return newSet;
}

