import { api } from './client';
import {
  RiskWarning,
  MarginAccount,
  RiskHistory,
  CollateralPosition,
  WarningStatus,
  WarningLevel,
  WarningType,
} from '../types';

export const riskApi = {
  calculateRisk: (customerId: string) =>
    api.post<{
      marginAccount: MarginAccount;
      positions: CollateralPosition[];
      warningLevel: WarningLevel;
    }>(`/risk/calculate/${customerId}`),

  batchCalculate: () =>
    api.post<{ processed: number; warningsGenerated: number }>('/risk/batch-calculate'),

  generateWarning: (data: {
    customer_id: string;
    warning_type: WarningType;
    notes?: string;
  }) => api.post<RiskWarning>('/risk/warnings', data),

  getWarnings: (params?: {
    status?: WarningStatus;
    customer_id?: string;
    warning_level?: WarningLevel;
    page?: number;
    page_size?: number;
  }) =>
    api.get<{ warnings: RiskWarning[]; total: number }>('/risk/warnings', { params }),

  getWarning: (warningId: string) =>
    api.get<RiskWarning>(`/risk/warnings/${warningId}`),

  updateWarningStatus: (
    warningId: string,
    data: {
      status: WarningStatus;
      notes?: string;
    }
  ) => api.put<RiskWarning>(`/risk/warnings/${warningId}`, data),

  getRiskHistory: (
    customerId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      limit?: number;
    }
  ) => api.get<RiskHistory[]>(`/risk/history/${customerId}`, { params }),
};
