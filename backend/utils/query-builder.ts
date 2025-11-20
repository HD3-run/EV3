import { pool } from '../db.js';
import { logger } from './logger.js';

// Safe query builder to prevent SQL injection
export class QueryBuilder {
  private table: string;
  private selectFields: string[] = ['*'];
  private whereConditions: Array<{ field: string; operator: string; value: any; paramIndex: number }> = [];
  private joinClauses: string[] = [];
  private orderByClause: string = '';
  private limitClause: string = '';
  private params: any[] = [];
  private paramCounter: number = 1;

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string[]): QueryBuilder {
    this.selectFields = fields;
    return this;
  }

  where(field: string, operator: string, value: any): QueryBuilder {
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

  join(table: string, condition: string): QueryBuilder {
    this.joinClauses.push(`INNER JOIN ${table} ON ${condition}`);
    return this;
  }

  leftJoin(table: string, condition: string): QueryBuilder {
    this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.orderByClause = `ORDER BY ${field} ${direction}`;
    return this;
  }

  limit(count: number, offset: number = 0): QueryBuilder {
    this.limitClause = `LIMIT ${count} OFFSET ${offset}`;
    return this;
  }

  build(): { query: string; params: any[] } {
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
    logger.info('Executing safe query', { query, paramCount: params.length });
    
    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Query execution failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}

// Helper functions for common operations
export const safeQuery = (table: string) => new QueryBuilder(table);

export const safeInsert = async (table: string, data: Record<string, any>) => {
  const fields = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  
  const query = `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  
  logger.info('Executing safe insert', { table, fieldCount: fields.length });
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Insert execution failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};

export const safeUpdate = async (table: string, data: Record<string, any>, whereCondition: { field: string; value: any }) => {
  const fields = Object.keys(data);
  const values = Object.values(data);
  
  const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const query = `UPDATE ${table} SET ${setClause} WHERE ${whereCondition.field} = $${fields.length + 1} RETURNING *`;
  
  logger.info('Executing safe update', { table, fieldCount: fields.length });
  
  try {
    const result = await pool.query(query, [...values, whereCondition.value]);
    return result.rows[0];
  } catch (error) {
    logger.error('Update execution failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};