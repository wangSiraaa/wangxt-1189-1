import { query, getClient } from '../database/db';
import { logAudit } from '../utils/audit';
import { Communication, CollateralAddition, CommunicationType, AdditionType, AdditionStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const createCommunication = async (
  customerId: string,
  managerId: string,
  communicationType: CommunicationType,
  content: string,
  warningId?: string,
  customerResponse?: string,
  nextFollowUpAt?: string,
  ipAddress?: string
): Promise<Communication> => {
  const communicationId = uuidv4();
  const result = await query(
    `INSERT INTO communications (communication_id, customer_id, warning_id, manager_id,
                                   communication_type, content, customer_response, next_follow_up_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      communicationId,
      customerId,
      warningId,
      managerId,
      communicationType,
      content,
      customerResponse,
      nextFollowUpAt ? new Date(nextFollowUpAt) : null,
    ]
  );

  await logAudit(
    managerId,
    'communication_created',
    'communication',
    communicationId,
    null,
    result.rows[0],
    ipAddress
  );

  return result.rows[0] as Communication;
};

export const getCommunications = async (
  customerId?: string,
  warningId?: string,
  managerId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ communications: Communication[]; total: number }> => {
  const params: any[] = [];
  const conditions: string[] = [];

  if (customerId) {
    conditions.push(`c.customer_id = $${params.length + 1}`);
    params.push(customerId);
  }
  if (warningId) {
    conditions.push(`c.warning_id = $${params.length + 1}`);
    params.push(warningId);
  }
  if (managerId) {
    conditions.push(`c.manager_id = $${params.length + 1}`);
    params.push(managerId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM communications c ${whereClause}`,
    params
  );

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const result = await query(
    `SELECT c.*, cu.customer_name, u.full_name as manager_name
     FROM communications c
     JOIN customers cu ON c.customer_id = cu.customer_id
     JOIN users u ON c.manager_id = u.user_id
     ${whereClause}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    communications: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
};

export const recordCollateralAddition = async (
  customerId: string,
  additionType: AdditionType,
  amount: number,
  submittedBy: string,
  warningId?: string,
  securityId?: string,
  quantity?: number,
  notes?: string,
  ipAddress?: string
): Promise<CollateralAddition> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const additionId = uuidv4();
    const result = await client.query(
      `INSERT INTO collateral_additions (addition_id, customer_id, warning_id, addition_type,
                                       amount, security_id, quantity, status, submitted_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        additionId,
        customerId,
        warningId,
        additionType,
        amount,
        securityId,
        quantity,
        'pending',
        submittedBy,
        notes,
      ]
    );

    if (warningId) {
      await client.query(
        `UPDATE risk_warnings SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
         WHERE warning_id = $1`,
        [warningId]
      );
    }

    await client.query('COMMIT');

    await logAudit(
      submittedBy,
      'collateral_addition_recorded',
      'collateral_addition',
      additionId,
      null,
      result.rows[0],
      ipAddress
    );

    return result.rows[0] as CollateralAddition;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getCollateralAdditions = async (
  customerId?: string,
  warningId?: string,
  status?: AdditionStatus,
  page: number = 1,
  pageSize: number = 20
): Promise<{ additions: CollateralAddition[]; total: number }> => {
  const params: any[] = [];
  const conditions: string[] = [];

  if (customerId) {
    conditions.push(`ca.customer_id = $${params.length + 1}`);
    params.push(customerId);
  }
  if (warningId) {
    conditions.push(`ca.warning_id = $${params.length + 1}`);
    params.push(warningId);
  }
  if (status) {
    conditions.push(`ca.status = $${params.length + 1}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM collateral_additions ca ${whereClause}`,
    params
  );

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const result = await query(
    `SELECT ca.*, cu.customer_name, u1.full_name as submitter_name, u2.full_name as confirmer_name,
            s.security_code, s.security_name
     FROM collateral_additions ca
     JOIN customers cu ON ca.customer_id = cu.customer_id
     JOIN users u1 ON ca.submitted_by = u1.user_id
     LEFT JOIN users u2 ON ca.confirmed_by = u2.user_id
     LEFT JOIN securities s ON ca.security_id = s.security_id
     ${whereClause}
     ORDER BY ca.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    additions: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
};

export const confirmCollateralAddition = async (
  additionId: string,
  confirmedBy: string,
  ipAddress?: string
): Promise<CollateralAddition> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT * FROM collateral_additions WHERE addition_id = $1 FOR UPDATE`,
      [additionId]
    );

    if (oldResult.rows.length === 0) {
      throw new Error('Collateral addition not found');
    }

    const oldAddition = oldResult.rows[0];

    if (oldAddition.status !== 'pending') {
      throw new Error('Only pending additions can be confirmed');
    }

    const result = await client.query(
      `UPDATE collateral_additions
       SET status = 'confirmed', confirmed_by = $1, confirmed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE addition_id = $2
       RETURNING *`,
      [confirmedBy, additionId]
    );

    const addition = result.rows[0];

    if (addition.addition_type === 'cash') {
      await client.query(
        `UPDATE margin_accounts
         SET total_collateral_value = total_collateral_value + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE customer_id = $2`,
        [addition.amount, addition.customer_id]
      );
    } else if (addition.addition_type === 'security' && addition.security_id) {
      const existingPosition = await client.query(
        `SELECT * FROM collateral_positions WHERE customer_id = $1 AND security_id = $2 FOR UPDATE`,
        [addition.customer_id, addition.security_id]
      );

      if (existingPosition.rows.length > 0) {
        await client.query(
          `UPDATE collateral_positions
           SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
           WHERE position_id = $2`,
          [addition.quantity, existingPosition.rows[0].position_id]
        );
      } else {
        const securityResult = await client.query(
          `SELECT current_price FROM securities WHERE security_id = $1`,
          [addition.security_id]
        );
        const currentPrice = securityResult.rows[0].current_price;
        const positionId = uuidv4();
        await client.query(
          `INSERT INTO collateral_positions (position_id, customer_id, security_id, quantity, market_value)
           VALUES ($1, $2, $3, $4, $5)`,
          [positionId, addition.customer_id, addition.security_id, addition.quantity, (addition.quantity || 0) * currentPrice]
        );
      }
    }

    if (addition.warning_id) {
      const warningResult = await client.query(
        `SELECT * FROM risk_warnings WHERE warning_id = $1`,
        [addition.warning_id]
      );
      if (warningResult.rows.length > 0) {
        await client.query(
          `UPDATE risk_warnings
           SET notes = COALESCE(notes, '') || $1, updated_at = CURRENT_TIMESTAMP
           WHERE warning_id = $2`,
          [`\n${new Date().toISOString()}: 客户追加担保品已确认 - 金额: ${addition.amount}`, addition.warning_id]
        );
      }
    }

    await client.query('COMMIT');

    await logAudit(
      confirmedBy,
      'collateral_addition_confirmed',
      'collateral_addition',
      additionId,
      oldAddition,
      addition,
      ipAddress
    );

    return addition as CollateralAddition;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const rejectCollateralAddition = async (
  additionId: string,
  rejectedBy: string,
  notes?: string,
  ipAddress?: string
): Promise<CollateralAddition> => {
  const oldResult = await query(`SELECT * FROM collateral_additions WHERE addition_id = $1`, [additionId]);
  if (oldResult.rows.length === 0) {
    throw new Error('Collateral addition not found');
  }

  const oldAddition = oldResult.rows[0];

  if (oldAddition.status !== 'pending') {
    throw new Error('Only pending additions can be rejected');
  }

  const result = await query(
    `UPDATE collateral_additions
     SET status = 'rejected', confirmed_by = $1, confirmed_at = CURRENT_TIMESTAMP,
         notes = COALESCE(notes, '') || $2, updated_at = CURRENT_TIMESTAMP
     WHERE addition_id = $3
     RETURNING *`,
    [rejectedBy, notes ? `\n${new Date().toISOString()}: ${notes}` : '', additionId]
  );

  await logAudit(
    rejectedBy,
    'collateral_addition_rejected',
    'collateral_addition',
    additionId,
    oldAddition,
    result.rows[0],
    ipAddress
  );

  return result.rows[0] as CollateralAddition;
};

export const hasPendingAddition = async (customerId: string): Promise<boolean> => {
  const result = await query(
    `SELECT COUNT(*) FROM collateral_additions
     WHERE customer_id = $1 AND status = 'pending'`,
    [customerId]
  );
  return parseInt(result.rows[0].count) > 0;
};
