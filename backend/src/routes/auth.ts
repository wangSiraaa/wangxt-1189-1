import express from 'express';
import { query } from '../database/db';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../utils/audit';

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().required().trim().min(3).max(50),
  password: Joi.string().required().min(6).max(100),
  role: Joi.string().valid('risk_control', 'customer_manager', 'trading_ops', 'admin'),
});

router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { username, password, role } = value;

    const sql = `SELECT user_id, username, full_name, role, created_at FROM users WHERE username = $1 AND password = $2`;
    const params: any[] = [username, password];

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      await logAudit(
        undefined,
        'login_failed',
        'auth',
        undefined,
        { username, role: role || null },
        undefined,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(401).json({
        success: false,
        error: '用户名或密码错误，请检查后重试',
      });
    }

    const user = result.rows[0];

    if (role && user.role !== role) {
      await logAudit(
        user.user_id,
        'login_failed_role_mismatch',
        'auth',
        undefined,
        { username: user.username, expected_role: role, actual_role: user.role },
        undefined,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(403).json({
        success: false,
        error: `该用户不具有${role}角色权限`,
      });
    }

    const sessionId = uuidv4();

    await logAudit(
      user.user_id,
      'login_success',
      'auth',
      user.user_id,
      undefined,
      { username: user.username, role: user.role, session_id: sessionId },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      data: {
        user: {
          user_id: user.user_id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          created_at: user.created_at,
        },
        token: sessionId,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: '登录服务异常，请稍后重试' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    await logAudit(
      userId || undefined,
      'logout',
      'auth',
      userId || undefined,
      undefined,
      undefined,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, data: { message: '登出成功' } });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: '登出服务异常' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const result = await query(
      `SELECT user_id, username, full_name, role, created_at FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: '用户不存在' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, error: '获取用户信息异常' });
  }
});

export default router;
