import express from 'express';
import Joi from 'joi';
import {
  createCommunication,
  getCommunications,
  recordCollateralAddition,
  getCollateralAdditions,
  confirmCollateralAddition,
  rejectCollateralAddition,
  hasPendingAddition,
} from '../services/customerManagerService';

const router = express.Router();

const communicationSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  manager_id: Joi.string().uuid().required(),
  communication_type: Joi.string().valid('phone', 'email', 'sms', 'in_person').required(),
  content: Joi.string().required(),
  warning_id: Joi.string().uuid().allow(null),
  customer_response: Joi.string().allow('', null),
  next_follow_up_at: Joi.string().isoDate().allow(null),
});

const getCommunicationsSchema = Joi.object({
  customer_id: Joi.string().uuid(),
  warning_id: Joi.string().uuid(),
  manager_id: Joi.string().uuid(),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20),
});

const additionSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  addition_type: Joi.string().valid('cash', 'security').required(),
  amount: Joi.number().positive().required(),
  warning_id: Joi.string().uuid().allow(null),
  security_id: Joi.string().uuid().when('addition_type', {
    is: 'security',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
  quantity: Joi.number().positive().when('addition_type', {
    is: 'security',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
  notes: Joi.string().allow('', null),
  submitted_by: Joi.string().uuid(),
});

const getAdditionsSchema = Joi.object({
  customer_id: Joi.string().uuid(),
  warning_id: Joi.string().uuid(),
  status: Joi.string().valid('pending', 'confirmed', 'rejected', 'cancelled'),
  page: Joi.number().integer().min(1).default(1),
  page_size: Joi.number().integer().min(1).max(100).default(20),
});

router.post('/communications', async (req, res) => {
  try {
    const { error, value } = communicationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string || value.manager_id;
    const ipAddress = req.ip;

    const communication = await createCommunication(
      value.customer_id,
      userId,
      value.communication_type,
      value.content,
      value.warning_id,
      value.customer_response,
      value.next_follow_up_at,
      ipAddress
    );
    res.json({ success: true, data: communication });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/communications', async (req, res) => {
  try {
    const { error, value } = getCommunicationsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const result = await getCommunications(
      value.customer_id,
      value.warning_id,
      value.manager_id,
      value.page,
      value.page_size
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/collateral-additions', async (req, res) => {
  try {
    const { error, value } = additionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const userId = req.headers['x-user-id'] as string || value.submitted_by;
    const ipAddress = req.ip;

    const addition = await recordCollateralAddition(
      value.customer_id,
      value.addition_type,
      value.amount,
      userId,
      value.warning_id,
      value.security_id,
      value.quantity,
      value.notes,
      ipAddress
    );
    res.json({ success: true, data: addition });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/collateral-additions', async (req, res) => {
  try {
    const { error, value } = getAdditionsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const result = await getCollateralAdditions(
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

router.post('/collateral-additions/:additionId/confirm', async (req, res) => {
  try {
    const { additionId } = req.params;
    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const addition = await confirmCollateralAddition(additionId, userId, ipAddress);
    res.json({ success: true, data: addition });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/collateral-additions/:additionId/reject', async (req, res) => {
  try {
    const { additionId } = req.params;
    const { notes } = req.body;
    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    const addition = await rejectCollateralAddition(additionId, userId, notes, ipAddress);
    res.json({ success: true, data: addition });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/collateral-additions/pending/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const hasPending = await hasPendingAddition(customerId);
    res.json({ success: true, data: { has_pending: hasPending } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
