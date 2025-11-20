// Validation utilities

export function validateProductName(name: string): boolean {
  return name.trim().length > 0;
}

export function validatePrice(price: string): boolean {
  const numPrice = parseFloat(price);
  return !isNaN(numPrice) && numPrice >= 0;
}

export function validateStockQuantity(quantity: string): boolean {
  const numQty = parseInt(quantity);
  return !isNaN(numQty) && numQty >= 0;
}

