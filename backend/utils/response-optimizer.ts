import { Request, Response, NextFunction } from 'express';

// Response field selection middleware (GraphQL-like)
export const selectFields = (req: Request, _res: Response, next: NextFunction) => {
  const fields = req.query.fields as string;
  
  if (fields) {
    // Parse requested fields
    const requestedFields = fields.split(',').map(f => f.trim());
    (req as any).selectedFields = requestedFields;
  }
  
  next();
};

// Optimize response data based on selected fields
export const optimizeResponse = (data: any, selectedFields?: string[]) => {
  if (!selectedFields || selectedFields.length === 0) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => filterFields(item, selectedFields));
  }
  
  return filterFields(data, selectedFields);
};

const filterFields = (obj: any, fields: string[]) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const filtered: any = {};
  
  for (const field of fields) {
    if (field.includes('.')) {
      // Handle nested fields like 'user.name'
      const [parent, child] = field.split('.');
      if (obj[parent]) {
        if (!filtered[parent]) filtered[parent] = {};
        filtered[parent][child] = obj[parent][child];
      }
    } else {
      if (obj.hasOwnProperty(field)) {
        filtered[field] = obj[field];
      }
    }
  }
  
  return filtered;
};

// Response compression for large datasets
export const compressResponse = (_req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    if (typeof data === 'object' && data !== null) {
      // Remove null/undefined values
      const compressed = removeEmpty(data);
      return originalSend.call(this, compressed);
    }
    return originalSend.call(this, data);
  };
  
  next();
};

const removeEmpty = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(removeEmpty).filter(item => item !== null && item !== undefined);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = removeEmpty(value);
      }
    }
    return cleaned;
  }
  
  return obj;
};