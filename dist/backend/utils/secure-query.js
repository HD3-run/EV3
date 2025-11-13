"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureQuery = void 0;
// Secure query wrapper to prevent SQL injection
class SecureQuery {
    constructor(pool) {
        this.pool = pool;
    }
    // Safe query execution with parameterized queries
    async execute(query, params = []) {
        const client = await this.pool.connect();
        try {
            // Validate query doesn't contain dangerous patterns
            if (this.containsDangerousSQL(query)) {
                throw new Error('Potentially dangerous SQL detected');
            }
            const result = await client.query(query, params);
            return result;
        }
        finally {
            client.release();
        }
    }
    // Check for dangerous SQL patterns
    containsDangerousSQL(query) {
        const dangerous = [
            /;\s*(drop|delete|truncate|alter)\s+/i,
            /union\s+select/i,
            /exec\s*\(/i,
            /xp_cmdshell/i,
            /sp_executesql/i
        ];
        return dangerous.some(pattern => pattern.test(query));
    }
    // Safe WHERE clause builder
    buildWhereClause(conditions) {
        const clauses = [];
        const params = [];
        let paramIndex = 1;
        for (const [key, value] of Object.entries(conditions)) {
            if (value !== undefined && value !== null) {
                // Validate column name (alphanumeric + underscore only)
                if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                    throw new Error(`Invalid column name: ${key}`);
                }
                clauses.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        }
        return {
            clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
            params
        };
    }
}
exports.SecureQuery = SecureQuery;
//# sourceMappingURL=secure-query.js.map