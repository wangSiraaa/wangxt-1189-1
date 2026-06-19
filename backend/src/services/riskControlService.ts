import { query, getClient } from '../database/db';
import { calculateMaintenanceRatio, calculateWarningLevel, calculateDisposableValue } from '../utils/risk';
import { logAudit } from '../utils/audit';
import { cacheSet, cacheGet } from '../utils/redis';
import { RiskWarning, MarginAccount, CollateralPosition, Security, RiskHistory, WarningLevel, WarningType } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const calculateCustomerRisk = async (
  customerId: string,
  userId?: string,
  ipAddress?: string
): Promise<{
  marginAccount: MarginAccount;
  positions: CollateralPosition[];
  warningLevel: WarningLevel;
}> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const positionsResult = await client.query(
      `SELECT cp.*, s.security_code, s.security_name, s.is_suspended, s.disposable_ratio, s.current_price
       FROM collateral_positions cp
       JOIN securities s ON cp.security_id = s.security_id
       WHERE cp.customer_id = $1
       FOR UPDATE`,
      [customerId]
    );

    const positions: (CollateralPosition & {
      security_code: string;
      security_name: string;
      is_suspended: boolean;
      disposable_ratio: number;
      current_price: number;
    })[] = positionsResult.rows;

    const accountResult = await client.query(
      `SELECT * FROM margin_accounts WHERE customer_id = $1 FOR UPDATE`,
      [customerId]
    );

    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Margin account not found');
    }

    const marginAccount = accountResult.rows[0] as MarginAccount;

    let totalCollateralValue = 0;
    let totalDisposableValue = 0;

    for (const position of positions) {
      const marketValue = position.quantity * position.current_price;
      const disposableValue = calculateDisposableValue(
        marketValue,
        position.is_suspended,
        position.disposable_ratio
      );

      totalCollateralValue += marketValue;
      totalDisposableValue += disposableValue;

      await client.query(
        `UPDATE collateral_positions
         SET market_value = $1, last_calculated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE position_id = $2`,
        [marketValue, position.position_id]
      );
    }

    const maintenanceRatio = calculateMaintenanceRatio(
      totalDisposableValue,
      marginAccount.total_debt
    );

    const warningLevel = calculateWarningLevel(
      maintenanceRatio,
      marginAccount.warning_line,
      marginAccount.liquidation_line
    );

    await client.query(
      `UPDATE margin_accounts
       SET total_collateral_value = $1, maintenance_ratio = $2,
           last_calculated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE account_id = $3`,
      [totalCollateralValue, maintenanceRatio, marginAccount.account_id]
    );

    const historyId = uuidv4();
    await client.query(
      `INSERT INTO risk_history (history_id, customer_id, maintenance_ratio, total_collateral_value, total_debt, warning_level)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [historyId, customerId, maintenanceRatio, totalCollateralValue, marginAccount.total_debt, warningLevel]
    );

    await client.query('COMMIT');

    const cacheKey = `customer_risk:${customerId}`;
    await cacheSet(cacheKey, { maintenanceRatio, totalCollateralValue, warningLevel }, 60);

    await logAudit(
      userId,
      'risk_calculated',
      'margin_account',
      marginAccount.account_id,
      null,
      { maintenanceRatio, totalCollateralValue, warningLevel },
      ipAddress
    );

    return {
      marginAccount: { ...marginAccount, total_collateral_value: totalCollateralValue, maintenance_ratio: maintenanceRatio },
      positions,
      warningLevel,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const generateWarning = async (
  customerId: string,
  warningType: WarningType,
  userId?: string,
  notes?: string,
  ipAddress?: string
): Promise<RiskWarning> => {
  const riskData = await calculateCustomerRisk(customerId, userId, ipAddress);
  const { marginAccount, warningLevel } = riskData;

  const existingWarning = await query(
    `SELECT * FROM risk_warnings
     WHERE customer_id = $1 AND status IN ('pending', 'in_progress')
     ORDER BY created_at DESC LIMIT 1`,
    [customerId]
  );

  if (existingWarning.rows.length > 0) {
    return existingWarning.rows[0] as RiskWarning;
  }

  const warningId = uuidv4();
  const result = await query(
    `INSERT INTO risk_warnings (warning_id, customer_id, warning_type, warning_level,
                               maintenance_ratio, total_collateral_value, total_debt,
                               created_by, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      warningId,
      customerId,
      warningType,
      warningLevel,
      marginAccount.maintenance_ratio,
      marginAccount.total_collateral_value,
      marginAccount.total_debt,
      userId,
      'pending',
      notes,
    ]
  );

  await logAudit(
    userId,
    'warning_generated',
    'risk_warning',
    warningId,
    null,
    result.rows[0],
    ipAddress
  );

  return result.rows[0] as RiskWarning;
};

export const getWarnings = async (
  status?: string,
  customerId?: string,
  warningLevel?: WarningLevel,
  page: number = 1,
  pageSize: number = 20
): Promise<{ warnings: RiskWarning[]; total: number }> => {
  const params: any[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push(`rw.status = $${params.length + 1}`);
    params.push(status);
  }
  if (customerId) {
    conditions.push(`rw.customer_id = $${params.length + 1}`);
    params.push(customerId);
  }
  if (warningLevel) {
    conditions.push(`rw.warning_level = $${params.length + 1}`);
    params.push(warningLevel);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM risk_warnings rw ${whereClause}`,
    params
  );

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const result = await query(
    `SELECT rw.*, c.customer_name, c.account_number, u.full_name as creator_name
     FROM risk_warnings rw
     JOIN customers c ON rw.customer_id = c.customer_id
     LEFT JOIN users u ON rw.created_by = u.user_id
     ${whereClause}
     ORDER BY rw.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    warnings: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
};

export const getWarningById = async (warningId: string): Promise<RiskWarning | null> => {
  const result = await query(
    `SELECT rw.*, c.customer_name, c.account_number, c.phone, c.email
     FROM risk_warnings rw
     JOIN customers c ON rw.customer_id = c.customer_id
     WHERE warning_id = $1`,
    [warningId]
  );
  return result.rows[0] as RiskWarning || null;
};

export const updateWarningStatus = async (
  warningId: string,
  status: string,
  userId?: string,
  notes?: string,
  ipAddress?: string
): Promise<RiskWarning> => {
  const oldResult = await query(`SELECT * FROM risk_warnings WHERE warning_id = $1`, [warningId]);
  if (oldResult.rows.length === 0) {
    throw new Error('Warning not found');
  }

  const oldWarning = oldResult.rows[0];

  const updates: string[] = [];
  const params: any[] = [];

  updates.push(`status = $${params.length + 1}`);
  params.push(status);

  if (notes) {
    updates.push(`notes = COALESCE(notes, '') || $${params.length + 1}`);
    params.push(`\n${new Date().toISOString()}: ${notes}`);
  }

  if (status === 'resolved' || status === 'liquidated' || status === 'cancelled') {
    updates.push(`resolved_at = CURRENT_TIMESTAMP`);
  }

  params.push(warningId);

  const result = await query(
    `UPDATE risk_warnings
     SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE warning_id = $${params.length}
     RETURNING *`,
    params
  );

  await logAudit(
    userId,
    `warning_status_updated:${status}`,
    'risk_warning',
    warningId,
    oldWarning,
    result.rows[0],
    ipAddress
  );

  return result.rows[0] as RiskWarning;
};

export const getRiskHistory = async (
  customerId: string,
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<RiskHistory[]> => {
  const params: any[] = [customerId];
  const conditions: string[] = ['customer_id = $1'];

  if (startDate) {
    conditions.push(`calculated_at >= $${params.length + 1}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`calculated_at <= $${params.length + 1}`);
    params.push(endDate);
  }

  params.push(limit);

  const result = await query(
    `SELECT * FROM risk_history
     WHERE ${conditions.join(' AND ')}
     ORDER BY calculated_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
};

export const batchCalculateAllCustomers = async (
  userId?: string,
  ipAddress?: string
): Promise<{
  processed: number;
  warningsGenerated: number;
}> => {
  const customersResult = await query(`SELECT customer_id FROM customers`);
  const customers = customersResult.rows;

  let warningsGenerated = 0;

  for (const customer of customers) {
    const riskData = await calculateCustomerRisk(customer.customer_id, userId, ipAddress);
    
    if (riskData.warningLevel === 'danger' || riskData.warningLevel === 'liquidation') {
      await generateWarning(customer.customer_id, 'maintenance_ratio', userId, undefined, ipAddress);
      warningsGenerated++;
    }
  }

  return {
    processed: customers.length,
    warningsGenerated,
  };
};
