"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressResponse = exports.optimizeResponse = exports.selectFields = void 0;
// Response field selection middleware (GraphQL-like)
const selectFields = (req, _res, next) => {
    const fields = req.query.fields;
    if (fields) {
        // Parse requested fields
        const requestedFields = fields.split(',').map(f => f.trim());
        req.selectedFields = requestedFields;
    }
    next();
};
exports.selectFields = selectFields;
// Optimize response data based on selected fields
const optimizeResponse = (data, selectedFields) => {
    if (!selectedFields || selectedFields.length === 0) {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map(item => filterFields(item, selectedFields));
    }
    return filterFields(data, selectedFields);
};
exports.optimizeResponse = optimizeResponse;
const filterFields = (obj, fields) => {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    const filtered = {};
    for (const field of fields) {
        if (field.includes('.')) {
            // Handle nested fields like 'user.name'
            const [parent, child] = field.split('.');
            if (obj[parent]) {
                if (!filtered[parent])
                    filtered[parent] = {};
                filtered[parent][child] = obj[parent][child];
            }
        }
        else {
            if (obj.hasOwnProperty(field)) {
                filtered[field] = obj[field];
            }
        }
    }
    return filtered;
};
// Response compression for large datasets
const compressResponse = (_req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        if (typeof data === 'object' && data !== null) {
            // Remove null/undefined values
            const compressed = removeEmpty(data);
            return originalSend.call(this, compressed);
        }
        return originalSend.call(this, data);
    };
    next();
};
exports.compressResponse = compressResponse;
const removeEmpty = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(removeEmpty).filter(item => item !== null && item !== undefined);
    }
    if (obj !== null && typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && value !== undefined && value !== '') {
                cleaned[key] = removeEmpty(value);
            }
        }
        return cleaned;
    }
    return obj;
};
//# sourceMappingURL=response-optimizer.js.map