import { query, getClient } from '../database/db';
import { logAudit } from '../utils/audit';
import { calculateDisposableValue, calculateMaintenanceRatio } from '../utils/risk';
import { hasPendingAddition } from './customerManagerService';
import { ForcedLiquidation, LiquidationStatus, CollateralPosition, LiquidationExecution } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface BatchExecuteInput {
  position_id: string;
  quantity: number;
  fill_price?: number;
  notes?: string;
}

interface CancelOrderInput {
  position_id: string;
  cancellation_reason: string;
  notes?: string;
}

export const getLiquidatablePositions = async (
  customerId: string
): Promise<{
  positions: (CollateralPosition & {
    security_code: string;
    security_name: string;
    is_suspended: boolean;
    disposable_ratio: number;
    current_price: number;
    disposable_value: number;
  })[];
  totalDisposableValue: number;
  totalMarketValue: number;
}> => {
  const positionsResult = await query(
    `SELECT cp.*, s.security_code, s.security_name, s.is_suspended, s.disposable_ratio, s.current_price
     FROM collateral_positions cp
     JOIN securities s ON cp.security_id = s.security_id
     WHERE cp.customer_id = $1
     ORDER BY s.is_suspended ASC, cp.market_value DESC`,
    [customerId]
  );

  const positions = positionsResult.rows.map((p) => ({
    ...p,
    disposable_value: calculateDisposableValue(
      p.quantity * p.current_price,
      p.is_suspended,
      p.disposable_ratio
    ),
  }));

  const totalMarketValue = positions.reduce((sum, p) => sum + p.market_value, 0);
  const totalDisposableValue = positions.reduce((sum, p) => sum + p.disposable_value, 0);

  return { positions, totalDisposableValue, totalMarketValue };
};

export const createForcedLiquidation = async (
  warningId: string,
  executedBy: string,
  notes?: string,
  ipAddress?: string
): Promise<ForcedLiquidation> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const warningResult = await client.query(
      `SELECT * FROM risk_warnings WHERE warning_id = $1 FOR UPDATE`,
      [warningId]
    );

    if (warningResult.rows.length === 0) {
      throw new Error('Warning not found');
    }

    const warning = warningResult.rows[0];

    if (warning.status === 'resolved' || warning.status === 'cancelled' || warning.status === 'liquidated') {
      throw new Error('Warning is already resolved, cancelled, or liquidated');
    }

    const pendingAddition = await hasPendingAddition(warning.customer_id);
    if (pendingAddition) {
      throw new Error('客户已追加担保品但尚未入账，不能触发强平');
    }

    const accountResult = await client.query(
      `SELECT * FROM margin_accounts WHERE customer_id = $1`,
      [warning.customer_id]
    );
    const account = accountResult.rows[0];

    const { positions, totalDisposableValue } = await getLiquidatablePositions(warning.customer_id);

    const targetRatio = account.warning_line;
    const currentDebt = account.total_debt;
    const requiredValue = (targetRatio / 100) * currentDebt;
    const deficit = requiredValue - totalDisposableValue;

    if (deficit <= 0) {
      throw new Error('维持担保比例已高于预警线，无需强平');
    }

    const positionsToLiquidate: any[] = [];
    let remainingDeficit = deficit;

    for (const position of positions) {
      if (remainingDeficit <= 0) break;

      const availableToSell = Math.min(position.disposable_value, remainingDeficit * 1.1);
      const quantityToSell = availableToSell / position.current_price;

      if (quantityToSell > 0.01) {
        positionsToLiquidate.push({
          position_id: position.position_id,
          security_id: position.security_id,
          security_code: position.security_code,
          security_name: position.security_name,
          is_suspended: position.is_suspended,
          current_price: position.current_price,
          disposable_ratio: position.disposable_ratio,
          original_quantity: position.quantity,
          quantity_to_liquidate: Number(quantityToSell.toFixed(4)),
          filled_quantity: 0,
          filled_amount: 0,
          cancelled: false,
          estimated_amount: Number((quantityToSell * position.current_price).toFixed(2)),
        });
        remainingDeficit -= availableToSell;
      }
    }

    if (positionsToLiquidate.length === 0) {
      throw new Error('没有可处置的担保品');
    }

    const triggerTime = new Date();
    const liquidationId = uuidv4();

    const result = await client.query(
      `INSERT INTO forced_liquidations (liquidation_id, warning_id, customer_id,
                                       trigger_maintenance_ratio, trigger_time,
                                       is_trigger_time_locked, status, positions_to_liquidate,
                                       executed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        liquidationId,
        warningId,
        warning.customer_id,
        warning.maintenance_ratio,
        triggerTime,
        false,
        'pending',
        JSON.stringify(positionsToLiquidate),
        executedBy,
        notes,
      ]
    );

    await client.query(
      `UPDATE risk_warnings
       SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP,
           notes = COALESCE(notes, '') || $1
       WHERE warning_id = $2`,
      [`\n${new Date().toISOString()}: 已创建强平指令 - 强平ID: ${liquidationId}`, warningId]
    );

    await client.query('COMMIT');

    await logAudit(
      executedBy,
      'forced_liquidation_created',
      'forced_liquidation',
      liquidationId,
      null,
      result.rows[0],
      ipAddress
    );

    return result.rows[0] as ForcedLiquidation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const executeForcedLiquidation = async (
  liquidationId: string,
  executedBy: string,
  actualLiquidatedAmount?: number,
  ipAddress?: string
): Promise<ForcedLiquidation> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT * FROM forced_liquidations WHERE liquidation_id = $1 FOR UPDATE`,
      [liquidationId]
    );

    if (oldResult.rows.length === 0) {
      throw new Error('Forced liquidation not found');
    }

    const oldLiquidation = oldResult.rows[0];

    if (oldLiquidation.status === 'completed' || oldLiquidation.status === 'cancelled') {
      throw new Error('Liquidation is already completed or cancelled');
    }

    const pendingAddition = await hasPendingAddition(oldLiquidation.customer_id);
    if (pendingAddition) {
      throw new Error('客户已追加担保品但尚未入账，不能执行强平');
    }

    const positionsToLiquidate = oldLiquidation.positions_to_liquidate;
    let totalLiquidated = actualLiquidatedAmount || 0;

    if (!actualLiquidatedAmount) {
      totalLiquidated = positionsToLiquidate.reduce(
        (sum: number, p: any) => sum + p.estimated_amount,
        0
      );
    }

    for (const pos of positionsToLiquidate) {
      const existingPosition = await client.query(
        `SELECT * FROM collateral_positions WHERE position_id = $1 FOR UPDATE`,
        [pos.position_id]
      );

      if (existingPosition.rows.length > 0) {
        const currentPosition = existingPosition.rows[0];
        const newQuantity = currentPosition.quantity - pos.quantity_to_liquidate;

        const fillPrice = pos.current_price;
        const fillAmount = Number((pos.quantity_to_liquidate * fillPrice).toFixed(2));

        if (newQuantity < 0.01) {
          await client.query(
            `DELETE FROM collateral_positions WHERE position_id = $1`,
            [pos.position_id]
          );
        } else {
          const newMarketValue = newQuantity * pos.current_price;
          await client.query(
            `UPDATE collateral_positions
             SET quantity = $1, market_value = $2, updated_at = CURRENT_TIMESTAMP
             WHERE position_id = $3`,
            [newQuantity, newMarketValue, pos.position_id]
          );
        }

        const executionId = uuidv4();
        await client.query(
          `INSERT INTO liquidation_executions
           (execution_id, liquidation_id, execution_type, position_id, security_id,
            security_code, security_name, planned_quantity, quantity, fill_price,
            fill_amount, executed_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            executionId, liquidationId, 'fill',
            pos.position_id, pos.security_id, pos.security_code, pos.security_name,
            pos.quantity_to_liquidate, pos.quantity_to_liquidate, fillPrice, fillAmount,
            executedBy, '一次性执行成交',
          ]
        );
      }
    }

    const accountDebtResult = await client.query(
      `SELECT total_debt FROM margin_accounts WHERE customer_id = $1`,
      [oldLiquidation.customer_id]
    );
    const currentDebt = accountDebtResult.rows[0].total_debt;
    const totalLiquidationAmount = positionsToLiquidate.reduce(
      (sum: number, p: any) => sum + p.estimated_amount,
      0
    );
    const newDebt = currentDebt - totalLiquidationAmount;

    await client.query(
      `UPDATE margin_accounts
       SET total_debt = GREATEST(0, $1),
           total_collateral_value = total_collateral_value - $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $3`,
      [newDebt, totalLiquidated, oldLiquidation.customer_id]
    );

    const result = await client.query(
      `UPDATE forced_liquidations
       SET status = 'completed', is_trigger_time_locked = true, is_disposal_locked = true,
           executed_at = CURRENT_TIMESTAMP, total_liquidated_amount = $1,
           executed_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE liquidation_id = $3
       RETURNING *`,
      [totalLiquidated, executedBy, liquidationId]
    );

    await client.query(
      `UPDATE risk_warnings
       SET status = 'liquidated', resolved_at = CURRENT_TIMESTAMP,
           notes = COALESCE(notes, '') || $1, updated_at = CURRENT_TIMESTAMP
       WHERE warning_id = $2`,
      [`\n${new Date().toISOString()}: 强平已完成 - 强平金额: ${totalLiquidated}`, oldLiquidation.warning_id]
    );

    await client.query('COMMIT');

    await logAudit(
      executedBy,
      'forced_liquidation_executed',
      'forced_liquidation',
      liquidationId,
      oldLiquidation,
      result.rows[0],
      ipAddress
    );

    return result.rows[0] as ForcedLiquidation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cancelForcedLiquidation = async (
  liquidationId: string,
  cancelledBy: string,
  cancellationReason: string,
  ipAddress?: string
): Promise<ForcedLiquidation> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT * FROM forced_liquidations WHERE liquidation_id = $1 FOR UPDATE`,
      [liquidationId]
    );

    if (oldResult.rows.length === 0) {
      throw new Error('Forced liquidation not found');
    }

    const oldLiquidation = oldResult.rows[0];

    if (oldLiquidation.status === 'completed') {
      throw new Error('Completed liquidation cannot be cancelled');
    }

    if (oldLiquidation.is_trigger_time_locked || oldLiquidation.is_disposal_locked) {
      throw new Error('处置流水已锁定，不能撤销强平');
    }

    const result = await client.query(
      `UPDATE forced_liquidations
       SET status = 'cancelled', cancellation_reason = $1,
           cancelled_by = $2, cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE liquidation_id = $3
       RETURNING *`,
      [cancellationReason, cancelledBy, liquidationId]
    );

    await client.query(
      `UPDATE risk_warnings
       SET status = 'in_progress',
           notes = COALESCE(notes, '') || $1, updated_at = CURRENT_TIMESTAMP
       WHERE warning_id = $2`,
      [`\n${new Date().toISOString()}: 强平已撤销 - 原因: ${cancellationReason}`, oldLiquidation.warning_id]
    );

    await client.query('COMMIT');

    await logAudit(
      cancelledBy,
      'forced_liquidation_cancelled',
      'forced_liquidation',
      liquidationId,
      oldLiquidation,
      result.rows[0],
      ipAddress
    );

    return result.rows[0] as ForcedLiquidation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateTriggerTime = async (
  liquidationId: string,
  newTriggerTime: string,
  updatedBy: string,
  ipAddress?: string
): Promise<ForcedLiquidation> => {
  const oldResult = await query(
    `SELECT * FROM forced_liquidations WHERE liquidation_id = $1`,
    [liquidationId]
  );

  if (oldResult.rows.length === 0) {
    throw new Error('Forced liquidation not found');
  }

  const oldLiquidation = oldResult.rows[0];

  if (oldLiquidation.is_trigger_time_locked) {
    throw new Error('强平完成后不能修改触发时点');
  }

  if (oldLiquidation.status === 'completed') {
    throw new Error('强平完成后不能修改触发时点');
  }

  const result = await query(
    `UPDATE forced_liquidations
     SET trigger_time = $1, updated_at = CURRENT_TIMESTAMP
     WHERE liquidation_id = $2
     RETURNING *`,
    [new Date(newTriggerTime), liquidationId]
  );

  await logAudit(
    updatedBy,
    'trigger_time_updated',
    'forced_liquidation',
    liquidationId,
    { trigger_time: oldLiquidation.trigger_time },
    { trigger_time: new Date(newTriggerTime) },
    ipAddress
  );

  return result.rows[0] as ForcedLiquidation;
};

export const getLiquidations = async (
  customerId?: string,
  warningId?: string,
  status?: LiquidationStatus,
  page: number = 1,
  pageSize: number = 20
): Promise<{ liquidations: ForcedLiquidation[]; total: number }> => {
  const params: any[] = [];
  const conditions: string[] = [];

  if (customerId) {
    conditions.push(`fl.customer_id = $${params.length + 1}`);
    params.push(customerId);
  }
  if (warningId) {
    conditions.push(`fl.warning_id = $${params.length + 1}`);
    params.push(warningId);
  }
  if (status) {
    conditions.push(`fl.status = $${params.length + 1}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM forced_liquidations fl ${whereClause}`,
    params
  );

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const result = await query(
    `SELECT fl.*, cu.customer_name, cu.account_number,
            u1.full_name as executor_name, u2.full_name as canceller_name,
            rw.warning_level, rw.maintenance_ratio
     FROM forced_liquidations fl
     JOIN customers cu ON fl.customer_id = cu.customer_id
     LEFT JOIN users u1 ON fl.executed_by = u1.user_id
     LEFT JOIN users u2 ON fl.cancelled_by = u2.user_id
     LEFT JOIN risk_warnings rw ON fl.warning_id = rw.warning_id
     ${whereClause}
     ORDER BY fl.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    liquidations: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
};

export const getLiquidationById = async (liquidationId: string): Promise<ForcedLiquidation | null> => {
  const result = await query(
    `SELECT fl.*, cu.customer_name, cu.account_number, cu.phone, cu.email,
            u1.full_name as executor_name, u2.full_name as canceller_name
     FROM forced_liquidations fl
     JOIN customers cu ON fl.customer_id = cu.customer_id
     LEFT JOIN users u1 ON fl.executed_by = u1.user_id
     LEFT JOIN users u2 ON fl.cancelled_by = u2.user_id
     WHERE liquidation_id = $1`,
    [liquidationId]
  );
  return result.rows[0] as ForcedLiquidation || null;
};

export const batchExecuteForcedLiquidation = async (
  liquidationId: string,
  executedBy: string,
  input: BatchExecuteInput,
  ipAddress?: string
): Promise<ForcedLiquidation> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT * FROM forced_liquidations WHERE liquidation_id = $1 FOR UPDATE`,
      [liquidationId]
    );

    if (oldResult.rows.length === 0) {
      throw new Error('Forced liquidation not found');
    }

    const oldLiquidation = oldResult.rows[0];

    if (oldLiquidation.status === 'completed' || oldLiquidation.status === 'cancelled') {
      throw new Error('强平已完成或已撤销，不能继续分批成交');
    }

    if (oldLiquidation.is_disposal_locked) {
      throw new Error('处置流水已锁定，不能继续分批成交');
    }

    const pendingAddition = await hasPendingAddition(oldLiquidation.customer_id);
    if (pendingAddition) {
      throw new Error('客户已追加担保品但尚未入账，不能执行强平');
    }

    const positionsToLiquidate: any[] = oldLiquidation.positions_to_liquidate;
    const planItem = positionsToLiquidate.find((p) => p.position_id === input.position_id);

    if (!planItem) {
      throw new Error('该持仓不在本次强平计划中');
    }

    if (planItem.cancelled) {
      throw new Error('该笔订单已撤销，不能继续成交');
    }

    const remainingQuantity = Number(
      (planItem.quantity_to_liquidate - planItem.filled_quantity).toFixed(4)
    );

    if (input.quantity <= 0) {
      throw new Error('成交数量必须大于0');
    }

    if (input.quantity > remainingQuantity + 0.0001) {
      throw new Error(
        `分批成交数量超过剩余可成交数量（剩余 ${remainingQuantity}）`
      );
    }

    const positionResult = await client.query(
      `SELECT cp.*, s.security_code, s.security_name, s.current_price
       FROM collateral_positions cp
       JOIN securities s ON cp.security_id = s.security_id
       WHERE cp.position_id = $1 FOR UPDATE`,
      [input.position_id]
    );

    if (positionResult.rows.length === 0) {
      throw new Error('持仓不存在');
    }

    const currentPosition = positionResult.rows[0];
    const fillPrice = input.fill_price ?? currentPosition.current_price;
    const fillAmount = Number((input.quantity * fillPrice).toFixed(2));

    if (currentPosition.quantity < input.quantity - 0.0001) {
      throw new Error('持仓数量不足，不能成交');
    }

    const newQuantity = currentPosition.quantity - input.quantity;
    if (newQuantity < 0.01) {
      await client.query(
        `DELETE FROM collateral_positions WHERE position_id = $1`,
        [input.position_id]
      );
    } else {
      const newMarketValue = newQuantity * currentPosition.current_price;
      await client.query(
        `UPDATE collateral_positions
         SET quantity = $1, market_value = $2, updated_at = CURRENT_TIMESTAMP
         WHERE position_id = $3`,
        [newQuantity, newMarketValue, input.position_id]
      );
    }

    planItem.filled_quantity = Number((planItem.filled_quantity + input.quantity).toFixed(4));
    planItem.filled_amount = Number((planItem.filled_amount + fillAmount).toFixed(2));

    const executionId = uuidv4();
    await client.query(
      `INSERT INTO liquidation_executions
       (execution_id, liquidation_id, execution_type, position_id, security_id,
        security_code, security_name, planned_quantity, quantity, fill_price,
        fill_amount, executed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        executionId, liquidationId, 'fill',
        input.position_id, planItem.security_id, planItem.security_code, planItem.security_name,
        planItem.quantity_to_liquidate, input.quantity, fillPrice, fillAmount,
        executedBy, input.notes ?? '分批成交',
      ]
    );

    const accountResult = await client.query(
      `SELECT * FROM margin_accounts WHERE customer_id = $1 FOR UPDATE`,
      [oldLiquidation.customer_id]
    );
    const account = accountResult.rows[0];

    const newDebt = Math.max(0, account.total_debt - fillAmount);
    const newCollateralValue = Math.max(0, account.total_collateral_value - fillAmount);

    await client.query(
      `UPDATE margin_accounts
       SET total_debt = $1, total_collateral_value = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE customer_id = $3`,
      [newDebt, newCollateralValue, oldLiquidation.customer_id]
    );

    const allFilled = positionsToLiquidate.every(
      (p) => p.cancelled || p.filled_quantity >= p.quantity_to_liquidate - 0.0001
    );

    let updateSql: string;
    let updateParams: any[];

    if (allFilled) {
      const totalLiquidated = positionsToLiquidate.reduce(
        (sum: number, p: any) => sum + p.filled_amount,
        0
      );
      updateSql = `UPDATE forced_liquidations
                    SET status = 'completed', is_trigger_time_locked = true,
                        is_disposal_locked = true, executed_by = $1,
                        executed_at = CURRENT_TIMESTAMP,
                        total_liquidated_amount = $2,
                        positions_to_liquidate = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE liquidation_id = $4
                    RETURNING *`;
      updateParams = [executedBy, totalLiquidated, JSON.stringify(positionsToLiquidate), liquidationId];
    } else {
      updateSql = `UPDATE forced_liquidations
                    SET status = 'in_progress',
                        positions_to_liquidate = $1,
                        total_liquidated_amount = COALESCE(total_liquidated_amount, 0) + $2,
                        executed_by = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE liquidation_id = $4
                    RETURNING *`;
      updateParams = [JSON.stringify(positionsToLiquidate), fillAmount, executedBy, liquidationId];
    }

    const result = await client.query(updateSql, updateParams);

    if (allFilled) {
      await client.query(
        `UPDATE risk_warnings
         SET status = 'liquidated', resolved_at = CURRENT_TIMESTAMP,
             notes = COALESCE(notes, '') || $1, updated_at = CURRENT_TIMESTAMP
         WHERE warning_id = $2`,
        [`\n${new Date().toISOString()}: 分批强平全部成交完成`, oldLiquidation.warning_id]
      );
    }

    await client.query('COMMIT');

    await logAudit(
      executedBy,
      allFilled ? 'forced_liquidation_batch_completed' : 'forced_liquidation_batch_fill',
      'forced_liquidation',
      liquidationId,
      oldLiquidation,
      result.rows[0],
      ipAddress
    );

    return result.rows[0] as ForcedLiquidation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const cancelLiquidationOrder = async (
  liquidationId: string,
  cancelledBy: string,
  input: CancelOrderInput,
  ipAddress?: string
): Promise<ForcedLiquidation> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query(
      `SELECT * FROM forced_liquidations WHERE liquidation_id = $1 FOR UPDATE`,
      [liquidationId]
    );

    if (oldResult.rows.length === 0) {
      throw new Error('Forced liquidation not found');
    }

    const oldLiquidation = oldResult.rows[0];

    if (oldLiquidation.status === 'completed' || oldLiquidation.status === 'cancelled') {
      throw new Error('强平已完成或已撤销，不能撤单');
    }

    if (oldLiquidation.is_disposal_locked) {
      throw new Error('处置流水已锁定，不能撤单');
    }

    const positionsToLiquidate: any[] = oldLiquidation.positions_to_liquidate;
    const planItem = positionsToLiquidate.find((p) => p.position_id === input.position_id);

    if (!planItem) {
      throw new Error('该持仓不在本次强平计划中');
    }

    if (planItem.cancelled) {
      throw new Error('该笔订单已撤销，不能重复撤单');
    }

    if (planItem.filled_quantity >= planItem.quantity_to_liquidate - 0.0001) {
      throw new Error('该笔订单已全部成交，不能撤单');
    }

    planItem.cancelled = true;

    const executionId = uuidv4();
    await client.query(
      `INSERT INTO liquidation_executions
       (execution_id, liquidation_id, execution_type, position_id, security_id,
        security_code, security_name, planned_quantity, quantity,
        executed_by, cancellation_reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        executionId, liquidationId, 'cancel',
        input.position_id, planItem.security_id, planItem.security_code, planItem.security_name,
        planItem.quantity_to_liquidate,
        Number((planItem.quantity_to_liquidate - planItem.filled_quantity).toFixed(4)),
        cancelledBy, input.cancellation_reason, input.notes ?? '撤单',
      ]
    );

    const allResolved = positionsToLiquidate.every(
      (p) => p.cancelled || p.filled_quantity >= p.quantity_to_liquidate - 0.0001
    );

    let updateSql: string;
    let updateParams: any[];

    if (allResolved) {
      const totalLiquidated = positionsToLiquidate.reduce(
        (sum: number, p: any) => sum + p.filled_amount,
        0
      );
      const allCancelled = positionsToLiquidate.every((p) => p.cancelled);
      updateSql = `UPDATE forced_liquidations
                    SET status = $1, is_trigger_time_locked = true,
                        is_disposal_locked = true,
                        total_liquidated_amount = $2,
                        positions_to_liquidate = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE liquidation_id = $4
                    RETURNING *`;
      updateParams = [
        allCancelled ? 'cancelled' : 'completed',
        totalLiquidated,
        JSON.stringify(positionsToLiquidate),
        liquidationId,
      ];
    } else {
      updateSql = `UPDATE forced_liquidations
                    SET positions_to_liquidate = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE liquidation_id = $2
                    RETURNING *`;
      updateParams = [JSON.stringify(positionsToLiquidate), liquidationId];
    }

    const result = await client.query(updateSql, updateParams);

    await client.query('COMMIT');

    await logAudit(
      cancelledBy,
      'forced_liquidation_order_cancelled',
      'forced_liquidation',
      liquidationId,
      oldLiquidation,
      result.rows[0],
      ipAddress
    );

    return result.rows[0] as ForcedLiquidation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getLiquidationExecutions = async (
  liquidationId: string
): Promise<LiquidationExecution[]> => {
  const result = await query(
    `SELECT le.*, u.full_name as executor_name
     FROM liquidation_executions le
     LEFT JOIN users u ON le.executed_by = u.user_id
     WHERE le.liquidation_id = $1
     ORDER BY le.created_at ASC`,
    [liquidationId]
  );
  return result.rows;
};
