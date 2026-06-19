import { query } from '../database/db';
import { AuditLog } from '../types';

export const logAudit = async (
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<AuditLog> => {
  const result = await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, action, entityType, entityId, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, ipAddress, userAgent]
  );
  return result.rows[0];
};

export const getAuditLogs = async (
  entityType?: string,
  entityId?: string,
  userId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ logs: AuditLog[]; total: number }> => {
  const params: any[] = [];
  const conditions: string[] = [];

  if (entityType) {
    conditions.push(`entity_type = $${params.length + 1}`);
    params.push(entityType);
  }
  if (entityId) {
    conditions.push(`entity_id = $${params.length + 1}`);
    params.push(entityId);
  }
  if (userId) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(userId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
    params
  );

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const result = await query(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    logs: result.rows,
    total: parseInt(countResult.rows[0].count),
  };
};
