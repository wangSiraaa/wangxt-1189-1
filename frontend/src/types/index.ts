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
  created_at: string;
}

export interface Customer {
  customer_id: string;
  customer_name: string;
  account_number: string;
  phone?: string;
  email?: string;
  manager_id?: string;
  manager_name?: string;
  total_collateral_value?: number;
  total_debt?: number;
  maintenance_ratio?: number;
  warning_line?: number;
  liquidation_line?: number;
  created_at: string;
  updated_at: string;
}

export interface Security {
  security_id: string;
  security_code: string;
  security_name: string;
  is_suspended: boolean;
  suspension_start_date?: string;
  disposable_ratio: number;
  current_price: number;
  created_at: string;
  updated_at: string;
}

export interface CollateralPosition {
  position_id: string;
  customer_id: string;
  security_id: string;
  security_code: string;
  security_name: string;
  is_suspended: boolean;
  disposable_ratio: number;
  current_price: number;
  quantity: number;
  market_value: number;
  disposable_value?: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface MarginAccount {
  account_id: string;
  customer_id: string;
  total_collateral_value: number;
  total_debt: number;
  maintenance_ratio: number;
  warning_line: number;
  liquidation_line: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface RiskWarning {
  warning_id: string;
  customer_id: string;
  customer_name: string;
  account_number: string;
  warning_type: WarningType;
  warning_level: WarningLevel;
  maintenance_ratio: number;
  total_collateral_value: number;
  total_debt: number;
  triggered_at: string;
  created_by?: string;
  creator_name?: string;
  status: WarningStatus;
  resolved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  communication_id: string;
  customer_id: string;
  customer_name: string;
  warning_id?: string;
  manager_id: string;
  manager_name: string;
  communication_type: CommunicationType;
  content: string;
  customer_response?: string;
  next_follow_up_at?: string;
  created_at: string;
}

export interface CollateralAddition {
  addition_id: string;
  customer_id: string;
  customer_name: string;
  warning_id?: string;
  addition_type: AdditionType;
  amount: number;
  security_id?: string;
  security_code?: string;
  security_name?: string;
  quantity?: number;
  status: AdditionStatus;
  submitted_by: string;
  submitter_name: string;
  confirmed_by?: string;
  confirmer_name?: string;
  submitted_at: string;
  confirmed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ForcedLiquidation {
  liquidation_id: string;
  warning_id: string;
  customer_id: string;
  customer_name: string;
  account_number: string;
  phone?: string;
  email?: string;
  trigger_maintenance_ratio: number;
  trigger_time: string;
  is_trigger_time_locked: boolean;
  status: LiquidationStatus;
  positions_to_liquidate?: any[];
  executed_by?: string;
  executor_name?: string;
  executed_at?: string;
  total_liquidated_amount?: number;
  cancellation_reason?: string;
  cancelled_by?: string;
  canceller_name?: string;
  cancelled_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  warning_level?: WarningLevel;
}

export interface RiskHistory {
  history_id: string;
  customer_id: string;
  maintenance_ratio: number;
  total_collateral_value: number;
  total_debt: number;
  warning_level: WarningLevel;
  calculated_at: string;
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
  created_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardStats {
  warnings: {
    total: number;
    pending: number;
    in_progress: number;
    resolved: number;
    level_warning: number;
    level_danger: number;
    level_liquidation: number;
  };
  liquidations: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    total_liquidated_amount: number;
  };
  additions: {
    total: number;
    pending: number;
    confirmed: number;
    total_confirmed_amount: number;
  };
  at_risk_customers: number;
}

export const WarningLevelColors: Record<WarningLevel, string> = {
  normal: 'green',
  warning: 'gold',
  danger: 'orange',
  liquidation: 'red',
};

export const WarningLevelTexts: Record<WarningLevel, string> = {
  normal: '正常',
  warning: '预警',
  danger: '警戒',
  liquidation: '平仓',
};

export const WarningStatusTexts: Record<WarningStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  liquidated: '已平仓',
  cancelled: '已取消',
};

export const LiquidationStatusTexts: Record<LiquidationStatus, string> = {
  pending: '待执行',
  in_progress: '执行中',
  completed: '已完成',
  cancelled: '已撤销',
};

export const AdditionStatusTexts: Record<AdditionStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
  cancelled: '已取消',
};

export const CommunicationTypeTexts: Record<CommunicationType, string> = {
  phone: '电话',
  email: '邮件',
  sms: '短信',
  in_person: '面谈',
};

export const AdditionTypeTexts: Record<AdditionType, string> = {
  cash: '现金',
  security: '证券',
};

export const RoleTexts: Record<UserRole, string> = {
  risk_control: '风控',
  customer_manager: '客户经理',
  trading_ops: '交易运营',
  admin: '管理员',
};
