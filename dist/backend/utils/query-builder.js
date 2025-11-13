"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeUpdate = exports.safeInsert = exports.safeQuery = exports.QueryBuilder = void 0;
const db_js_1 = require("../db.js");
const logger_js_1 = require("./logger.js");
// Safe query builder to prevent SQL injection
class QueryBuilder {
    constructor(table) {
        this.selectFields = ['*'];
        this.whereConditions = [];
        this.joinClauses = [];
        this.orderByClause = '';
        this.limitClause = '';
        this.params = [];
        this.paramCounter = 1;
        this.table = table;
    }
    select(fields) {
        this.selectFields = fields;
        return this;
    }
    where(field, operator, value) {
        this.whereConditions.push({
            field,
            operator,
            value,
            paramIndex: this.paramCounter
        });
        this.params.push(value);
        this.paramCounter++;
        return this;
    }
    join(table, condition) {
        this.joinClauses.push(`INNER JOIN ${table} ON ${condition}`);
        return this;
    }
    leftJoin(table, condition) {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
        return this;
    }
    orderBy(field, direction = 'ASC') {
        this.orderByClause = `ORDER BY ${field} ${direction}`;
        return this;
    }
    limit(count, offset = 0) {
        this.limitClause = `LIMIT ${count} OFFSET ${offset}`;
        return this;
    }
    build() {
        let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.table}`;
        if (this.joinClauses.length > 0) {
            query += ` ${this.joinClauses.join(' ')}`;
        }
        if (this.whereConditions.length > 0) {
            const whereClause = this.whereConditions
                .map(condition => `${condition.field} ${condition.operator} $${condition.paramIndex}`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
        }
        if (this.orderByClause) {
            query += ` ${this.orderByClause}`;
        }
        if (this.limitClause) {
            query += ` ${this.limitClause}`;
        }
        return { query, params: this.params };
    }
    async execute() {
        const { query, params } = this.build();
        logger_js_1.logger.info('Executing safe query', { query, paramCount: params.length });
        try {
            const result = await db_js_1.pool.query(query, params);
            return result.rows;
        }
        catch (error) {
            logger_js_1.logger.error('Query execution failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
}
exports.QueryBuilder = QueryBuilder;
// Helper functions for common operations
const safeQuery = (table) => new QueryBuilder(table);
exports.safeQuery = safeQuery;
const safeInsert = async (table, data) => {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const query = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    logger_js_1.logger.info('Executing safe insert', { table, fieldCount: fields.length });
    try {
        const result = await db_js_1.pool.query(query, values);
        return result.rows[0];
    }
    catch (error) {
        logger_js_1.logger.error('Insert execution failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.safeInsert = safeInsert;
const safeUpdate = async (table, data, whereCondition) => {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereCondition.field} = $${fields.length + 1} RETURNING *`;
    logger_js_1.logger.info('Executing safe update', { table, fieldCount: fields.length });
    try {
        const result = await db_js_1.pool.query(query, [...values, whereCondition.value]);
        return result.rows[0];
    }
    catch (error) {
        logger_js_1.logger.error('Update execution failed', { error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
};
exports.safeUpdate = safeUpdate;
//# sourceMappingURL=query-builder.js.map