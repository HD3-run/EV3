// Currency utility for formatting amounts
export const formatCurrency = (amount: number | string | null | undefined, currency: 'USD' | 'INR' = 'INR'): string => {
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount === null || numAmount === undefined) {
    return currency === 'INR' ? '₹0.00' : '$0.00';
  }
  
  if (currency === 'INR') {
    return `₹${numAmount.toFixed(2)}`;
  } else {
    return `$${numAmount.toFixed(2)}`;
  }
};

// Get currency symbol
export const getCurrencySymbol = (currency: 'USD' | 'INR' = 'INR'): string => {
  return currency === 'INR' ? '₹' : '$';
};

// Default currency - can be changed based on user preference or location
export const DEFAULT_CURRENCY: 'USD' | 'INR' = 'INR';