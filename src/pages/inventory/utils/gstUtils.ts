// GST utility functions
import { HSN_GST_MAPPING } from '../constants/inventoryConstants';

export function getGstRateFromHsn(hsnCode: string): number | null {
    if (!hsnCode || hsnCode.length < 4) return null;
    
    const hsn4 = hsnCode.substring(0, 4);
    return HSN_GST_MAPPING[hsn4] ?? null;
}

