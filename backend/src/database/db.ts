import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
types.setTypeParser(701, (val) => (val === null ? null : parseFloat(val)));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '21489'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'collateral_risk',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`Query executed: ${text.substring(0, 60)}... - ${duration}ms, rows: ${res.rowCount}`);
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

export const getClient = async () => {
  return await pool.connect();
};

export { pool };
