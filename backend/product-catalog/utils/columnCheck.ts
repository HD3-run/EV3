import { Pool, PoolClient } from 'pg';

type Queryable = Pool | PoolClient;

// Utility function to check if a column exists in a table
export async function checkColumnExists(
  queryable: Queryable,
  schema: string,
  table: string,
  column: string
): Promise<boolean> {
  const result = await queryable.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
  `, [schema, table, column]);
  
  return result.rows.length > 0;
}

// Utility function to check if multiple columns exist
export async function checkColumnsExist(
  queryable: Queryable,
  schema: string,
  table: string,
  columns: string[]
): Promise<Record<string, boolean>> {
  const result = await queryable.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = $2 AND column_name = ANY($3)
  `, [schema, table, columns]);
  
  const existingColumns = new Set(result.rows.map((row: any) => row.column_name));
  const columnMap: Record<string, boolean> = {};
  
  for (const column of columns) {
    columnMap[column] = existingColumns.has(column);
  }
  
  return columnMap;
}

// Utility function to check if a view exists
export async function checkViewExists(
  queryable: Queryable,
  schema: string,
  viewName: string
): Promise<boolean> {
  const result = await queryable.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_schema = $1 AND table_name = $2
    ) as exists
  `, [schema, viewName]);
  
  return result.rows[0]?.exists || false;
}

