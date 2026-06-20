import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initRedis } from './utils/redis';
import { pool } from './database/db';
import { checkAndInitializeDatabase } from './database/initDb';
import riskControlRoutes from './routes/riskControl';
import customerManagerRoutes from './routes/customerManager';
import tradingOperationsRoutes from './routes/tradingOperations';
import commonRoutes from './routes/common';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 19489;

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-token'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  if (req.path !== '/api/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  }
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

app.options('*', (req, res) => {
  res.sendStatus(204);
});

app.use('/api/auth', authRoutes);
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
        port: PORT,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: String(error),
      },
    });
  }
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || String(err),
  });
});

const startServer = async () => {
  try {
    console.log('========================================');
    console.log('  证券两融担保品风险处置系统 - 服务启动');
    console.log('========================================');

    await initRedis();

    await pool.query('SELECT 1');
    console.log('[OK] 数据库连接成功');

    const initialized = await checkAndInitializeDatabase();
    if (initialized) {
      console.log('[OK] 数据库首次初始化完成（表结构+演示数据已创建）');
    } else {
      console.log('[OK] 数据库校验通过（已存在数据）');
    }

    app.listen(PORT, () => {
      console.log('========================================');
      console.log(`  服务启动成功! 端口: ${PORT}`);
      console.log(`  健康检查: http://localhost:${PORT}/api/health`);
      console.log(`  API 基础路径: http://localhost:${PORT}/api`);
      console.log('========================================');
      console.log('  演示账号:');
      console.log('  风控:     risk01    / risk123');
      console.log('  客户经理: manager01 / manager123');
      console.log('  交易运营: trading01 / trading123');
      console.log('  管理员:   admin     / admin123');
      console.log('========================================');
    });
  } catch (error) {
    console.error('[FAIL] 服务启动失败:', error);
    process.exit(1);
  }
};

startServer();
