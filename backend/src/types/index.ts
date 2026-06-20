export type UserRole = 'risk_control' | 'customer_manager' | 'trading_ops' | 'admin';

export type WarningLevel = 'normal' | 'warning' | 'danger' | 'liquidation';

export type WarningType = 'maintenance_ratio' | 'suspended_security' | 'other';

export type WarningStatus = 'pending' | 'in_progress' | 'resolved' | 'liquidated' | 'cancelled';

export type CommunicationType = 'phone' | 'email' | 'sms' | 'in_person';

export type AdditionType = 'cash' | 'security';

export type AdditionStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export type LiquidationStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface User {
  user_id: string;
  username: string;
  full_name: string;
  role: UserRole;
  created_at: Date;
}

export interface Customer {
  customer_id: string;
  customer_name: string;
  account_number: string;
  phone?: string;
  email?: string;
  manager_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Security {
  security_id: string;
  security_code: string;
  security_name: string;
  is_suspended: boolean;
  suspension_start_date?: Date;
  disposable_ratio: number;
  current_price: number;
  prev_close_price: number;
  created_at: Date;
  updated_at: Date;
}

export interface CollateralPosition {
  position_id: string;
  customer_id: string;
  security_id: string;
  quantity: number;
  market_value: number;
  disposable_value?: number;
  intraday_change?: number;
  last_calculated_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface MarginAccount {
  account_id: string;
  customer_id: string;
  total_collateral_value: number;
  total_debt: number;
  maintenance_ratio: number;
  warning_line: number;
  liquidation_line: number;
  last_calculated_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface RiskWarning {
  warning_id: string;
  customer_id: string;
  warning_type: WarningType;
  warning_level: WarningLevel;
  maintenance_ratio: number;
  total_collateral_value: number;
  total_debt: number;
  triggered_at: Date;
  created_by?: string;
  status: WarningStatus;
  resolved_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Communication {
  communication_id: string;
  customer_id: string;
  warning_id?: string;
  manager_id: string;
  communication_type: CommunicationType;
  content: string;
  customer_response?: string;
  next_follow_up_at?: Date;
  created_at: Date;
}

export interface CollateralAddition {
  addition_id: string;
  customer_id: string;
  warning_id?: string;
  addition_type: AdditionType;
  amount: number;
  security_id?: string;
  quantity?: number;
  status: AdditionStatus;
  submitted_by: string;
  confirmed_by?: string;
  submitted_at: Date;
  confirmed_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ForcedLiquidation {
  liquidation_id: string;
  warning_id: string;
  customer_id: string;
  trigger_maintenance_ratio: number;
  trigger_time: Date;
  is_trigger_time_locked: boolean;
  is_disposal_locked: boolean;
  status: LiquidationStatus;
  positions_to_liquidate?: any;
  executed_by?: string;
  executed_at?: Date;
  total_liquidated_amount?: number;
  cancellation_reason?: string;
  cancelled_by?: string;
  cancelled_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export type ExecutionType = 'fill' | 'cancel';

export interface LiquidationExecution {
  execution_id: string;
  liquidation_id: string;
  execution_type: ExecutionType;
  position_id?: string;
  security_id?: string;
  security_code?: string;
  security_name?: string;
  planned_quantity?: number;
  quantity: number;
  fill_price?: number;
  fill_amount?: number;
  executed_by?: string;
  executed_at: Date;
  cancellation_reason?: string;
  notes?: string;
  created_at: Date;
}

export interface RiskHistory {
  history_id: string;
  customer_id: string;
  maintenance_ratio: number;
  total_collateral_value: number;
  total_debt: number;
  warning_level: WarningLevel;
  intraday_change: number;
  calculated_at: Date;
}

export interface AuditLog {
  log_id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}
