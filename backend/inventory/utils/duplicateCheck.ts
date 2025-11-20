// Helper function to check for product duplicates and handle name conflicts
import {
  checkExactDuplicate,
  checkNameConflict,
  checkModifiedNameConflict
} from '../queries/product-queries';

export async function checkProductDuplicate(
  client: any,
  merchantId: number,
  name: string,
  brand: string | null
): Promise<{ isDuplicate: boolean; existingProduct?: any; modifiedName?: string }> {
  // First check for exact duplicate (same name AND same brand)
  const exactDuplicate = await checkExactDuplicate(client, merchantId, name, brand || null);
  
  if (exactDuplicate) {
    return {
      isDuplicate: true,
      existingProduct: exactDuplicate
    };
  }
  
  // Check if there's a name conflict with different brand
  const nameConflict = await checkNameConflict(client, merchantId, name);
  
  if (nameConflict && brand) {
    // There's a name conflict but different brand - modify the name to include brand
    const modifiedName = `${name} (${brand})`;
    
    // Check if the modified name also exists
    const modifiedConflict = await checkModifiedNameConflict(client, merchantId, modifiedName);
    
    if (!modifiedConflict) {
      return {
        isDuplicate: false,
        modifiedName: modifiedName
      };
    }
  }
  
  return {
    isDuplicate: false
  };
}

