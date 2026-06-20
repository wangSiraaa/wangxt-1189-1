import express from 'express';
import Joi from 'joi';
import {
  createForcedLiquidation,
  executeForcedLiquidation,
  cancelForcedLiquidation,
  updateTriggerTime,
  getLiquidations,
  getLiquidationById,
  getLiquidatablePositions,
  batchExecuteForcedLiquidation,
  cancelLiquidationOrder,
  getLiquidationExecutions,
} from '../services/tradingOperationsService';

const router = express.Router();

const createLiquidationSchema = Joi.object({
  warning_id: Joi.string().uuid().required(),
  notes: Joi.string().allow('', null),
  executed_by: Joi.string().uuid(),
});

const getLiquidationsSchema = Joi.object({
  customer_id: Joi.string().uuid(),
  warning_id: Joi.string().uuid(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled'),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20),
});

const executeLiquidationSchema = Joi.object({
  actual_liquidated_amount: Joi.number().positive().allow(null),
});

const cancelLiquidationSchema = Joi.object({
  cancellation_reason: Joi.string().required(),
});

const updateTriggerTimeSchema = Joi.object({
  new_trigger_time: Joi.string().isoDate().required(),
});

const batchExecuteSchema = Joi.object({
  position_id: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  fill_price: Joi.number().positive().allow(null),
  notes: Joi.string().allow('', null),
});

const cancelOrderSchema = Joi.object({
  position_id: Joi.string().uuid().required(),
  cancellation_reason: Joi.string().required(),
  notes: Joi.string().allow('', null),
});

router.get('/positions/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const result = await getLiquidatablePositions(customerId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/liquidations', async (req, res) => {
  try {
    const { error, value } = createLiquidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string || value.executed_by;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const liquidation = await createForcedLiquidation(
      value.warning_id,
      userId,
      value.notes,
      ipAddress
    );
    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/liquidations', async (req, res) => {
  try {
    const { error, value } = getLiquidationsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const result = await getLiquidations(
      value.customer_id,
      value.warning_id,
      value.status,
      value.page,
      value.page_size
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/liquidations/:liquidationId', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const liquidation = await getLiquidationById(liquidationId);

    if (!liquidation) {
      return res.status(404).json({ success: false, error: 'Liquidation not found' });
    }

    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/liquidations/:liquidationId/execute', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const { error, value } = executeLiquidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const liquidation = await executeForcedLiquidation(
      liquidationId,
      userId,
      value.actual_liquidated_amount,
      ipAddress
    );
    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/liquidations/:liquidationId/cancel', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const { error, value } = cancelLiquidationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const liquidation = await cancelForcedLiquidation(
      liquidationId,
      userId,
      value.cancellation_reason,
      ipAddress
    );
    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/liquidations/:liquidationId/trigger-time', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const { error, value } = updateTriggerTimeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const liquidation = await updateTriggerTime(
      liquidationId,
      value.new_trigger_time,
      userId,
      ipAddress
    );
    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/liquidations/:liquidationId/batch-execute', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const { error, value } = batchExecuteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const liquidation = await batchExecuteForcedLiquidation(
      liquidationId,
      userId,
      {
        position_id: value.position_id,
        quantity: value.quantity,
        fill_price: value.fill_price ?? undefined,
        notes: value.notes ?? undefined,
      },
      ipAddress
    );
    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/liquidations/:liquidationId/cancel-order', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const { error, value } = cancelOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const liquidation = await cancelLiquidationOrder(
      liquidationId,
      userId,
      {
        position_id: value.position_id,
        cancellation_reason: value.cancellation_reason,
        notes: value.notes ?? undefined,
      },
      ipAddress
    );
    res.json({ success: true, data: liquidation });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/liquidations/:liquidationId/executions', async (req, res) => {
  try {
    const { liquidationId } = req.params;
    const executions = await getLiquidationExecutions(liquidationId);
    res.json({ success: true, data: executions });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
