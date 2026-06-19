import express from 'express';
import { query } from '../database/db';
import { getAuditLogs } from '../utils/audit';
import Joi from 'joi';

const router = express.Router();

const getCustomersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20),
  manager_id: Joi.string().uuid(),
});

const getAuditLogsSchema = Joi.object({
  entity_type: Joi.string(),
  entity_id: Joi.string().uuid(),
  user_id: Joi.string().uuid(),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20),
});

router.get('/customers', async (req, res) => {
  try {
    const { error, value } = getCustomersSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const params: any[] = [];
    const conditions: string[] = [];

    if (value.manager_id) {
      conditions.push(`manager_id = $${params.length + 1}`);
      params.push(value.manager_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM customers ${whereClause}`,
      params
    );

    const offset = (value.page - 1) * value.page_size;
    params.push(value.page_size, offset);

    const result = await query(
      `SELECT c.*, u.full_name as manager_name
       FROM customers c
       LEFT JOIN users u ON c.manager_id = u.user_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        customers: result.rows,
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/customers/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const result = await query(
      `SELECT c.*, u.full_name as manager_name,
              ma.total_collateral_value, ma.total_debt, ma.maintenance_ratio,
              ma.warning_line, ma.liquidation_line
       FROM customers c
       LEFT JOIN users u ON c.manager_id = u.user_id
       LEFT JOIN margin_accounts ma ON c.customer_id = ma.customer_id
       WHERE c.customer_id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;

    const params: any[] = [];
    const conditions: string[] = [];

    if (role) {
      conditions.push(`role = $${params.length + 1}`);
      params.push(role);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT user_id, username, full_name, role, created_at FROM users ${whereClause} ORDER BY full_name`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/securities', async (req, res) => {
  try {
    const { is_suspended } = req.query;

    const params: any[] = [];
    const conditions: string[] = [];

    if (is_suspended !== undefined) {
      conditions.push(`is_suspended = $${params.length + 1}`);
      params.push(is_suspended === 'true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM securities ${whereClause} ORDER BY security_code`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { error, value } = getAuditLogsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const result = await getAuditLogs(
      value.entity_type,
      value.entity_id,
      value.user_id,
      value.page,
      value.page_size
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/statistics/dashboard', async (req, res) => {
  try {
    const warningsResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE warning_level = 'warning') as level_warning,
        COUNT(*) FILTER (WHERE warning_level = 'danger') as level_danger,
        COUNT(*) FILTER (WHERE warning_level = 'liquidation') as level_liquidation
      FROM risk_warnings
    `);

    const liquidationsResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COALESCE(SUM(total_liquidated_amount), 0) as total_liquidated_amount
      FROM forced_liquidations
    `);

    const additionsResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) as total_confirmed_amount
      FROM collateral_additions
    `);

    const atRiskCustomersResult = await query(`
      SELECT
        COUNT(DISTINCT c.customer_id) as at_risk_count
      FROM customers c
      JOIN margin_accounts ma ON c.customer_id = ma.customer_id
      WHERE ma.maintenance_ratio < ma.warning_line
    `);

    res.json({
      success: true,
      data: {
        warnings: warningsResult.rows[0],
        liquidations: liquidationsResult.rows[0],
        additions: additionsResult.rows[0],
        at_risk_customers: atRiskCustomersResult.rows[0].at_risk_count,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
