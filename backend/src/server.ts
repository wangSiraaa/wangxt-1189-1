import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initRedis } from './utils/redis';
import { pool } from './database/db';
import riskControlRoutes from './routes/riskControl';
import customerManagerRoutes from './routes/customerManager';
import tradingOperationsRoutes from './routes/tradingOperations';
import commonRoutes from './routes/common';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 19489;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:20489',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use('/api/risk', riskControlRoutes);
app.use('/api/customer', customerManagerRoutes);
app.use('/api/trading', tradingOperationsRoutes);
app.use('/api/common', commonRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1 as health');
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbResult.rows[0].health === 1 ? 'connected' : 'error',
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error,
      },
    });
  }
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

const startServer = async () => {
  try {
    await initRedis();
    console.log('Redis initialized');

    await pool.query('SELECT 1');
    console.log('Database connected');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
