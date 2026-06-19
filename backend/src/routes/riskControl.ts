import express from 'express';
import Joi from 'joi';
import {
  calculateCustomerRisk,
  generateWarning,
  getWarnings,
  getWarningById,
  updateWarningStatus,
  getRiskHistory,
  batchCalculateAllCustomers,
} from '../services/riskControlService';

const router = express.Router();

const generateWarningSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  warning_type: Joi.string().valid('maintenance_ratio', 'suspended_security', 'other').required(),
  user_id: Joi.string().uuid(),
  notes: Joi.string().allow('', null),
});

const getWarningsSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'resolved', 'liquidated', 'cancelled'),
  customer_id: Joi.string().uuid(),
  warning_level: Joi.string().valid('normal', 'warning', 'danger', 'liquidation'),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20),
});

const updateWarningSchema = Joi.object({
  status: Joi.string().valid('pending', 'in_progress', 'resolved', 'liquidated', 'cancelled').required(),
  user_id: Joi.string().uuid(),
  notes: Joi.string().allow('', null),
});

router.post('/calculate/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    const result = await calculateCustomerRisk(customerId, userId, ipAddress);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/batch-calculate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    const result = await batchCalculateAllCustomers(userId, ipAddress);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/warnings', async (req, res) => {
  try {
    const { error, value } = generateWarningSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string || value.user_id;
    const ipAddress = req.ip;

    const warning = await generateWarning(
      value.customer_id,
      value.warning_type,
      userId,
      value.notes,
      ipAddress
    );
    res.json({ success: true, data: warning });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/warnings', async (req, res) => {
  try {
    const { error, value } = getWarningsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const result = await getWarnings(
      value.status,
      value.customer_id,
      value.warning_level,
      value.page,
      value.page_size
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/warnings/:warningId', async (req, res) => {
  try {
    const { warningId } = req.params;
    const warning = await getWarningById(warningId);

    if (!warning) {
      return res.status(404).json({ success: false, error: 'Warning not found' });
    }

    res.json({ success: true, data: warning });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/warnings/:warningId', async (req, res) => {
  try {
    const { warningId } = req.params;
    const { error, value } = updateWarningSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string || value.user_id;
    const ipAddress = req.ip;

    const warning = await updateWarningStatus(
      warningId,
      value.status,
      userId,
      value.notes,
      ipAddress
    );
    res.json({ success: true, data: warning });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/history/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { start_date, end_date, limit } = req.query;

    const history = await getRiskHistory(
      customerId,
      start_date as string,
      end_date as string,
      limit ? parseInt(limit as string) : 100
    );
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
