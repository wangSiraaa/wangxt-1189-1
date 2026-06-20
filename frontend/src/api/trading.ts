import { api } from './client';
import { ForcedLiquidation, CollateralPosition, LiquidationStatus, LiquidationExecution } from '../types';

export const tradingApi = {
  getLiquidatablePositions: (customerId: string) =>
    api.get<{
      positions: (CollateralPosition & { disposable_value: number })[];
      totalDisposableValue: number;
      totalMarketValue: number;
    }>(`/trading/positions/${customerId}`),

  createLiquidation: (data: {
    warning_id: string;
    notes?: string;
  }) => api.post<ForcedLiquidation>('/trading/liquidations', data),

  getLiquidations: (params?: {
    customer_id?: string;
    warning_id?: string;
    status?: LiquidationStatus;
    page?: number;
    page_size?: number;
  }) =>
    api.get<{ liquidations: ForcedLiquidation[]; total: number }>('/trading/liquidations', {
      params,
    }),

  getLiquidation: (liquidationId: string) =>
    api.get<ForcedLiquidation>(`/trading/liquidations/${liquidationId}`),

  executeLiquidation: (
    liquidationId: string,
    data?: { actual_liquidated_amount?: number }
  ) => api.post<ForcedLiquidation>(`/trading/liquidations/${liquidationId}/execute`, data),

  cancelLiquidation: (
    liquidationId: string,
    data: { cancellation_reason: string }
  ) => api.post<ForcedLiquidation>(`/trading/liquidations/${liquidationId}/cancel`, data),

  updateTriggerTime: (
    liquidationId: string,
    data: { new_trigger_time: string }
  ) => api.put<ForcedLiquidation>(`/trading/liquidations/${liquidationId}/trigger-time`, data),

  batchExecute: (
    liquidationId: string,
    data: {
      position_id: string;
      quantity: number;
      fill_price?: number;
      notes?: string;
    }
  ) =>
    api.post<ForcedLiquidation>(
      `/trading/liquidations/${liquidationId}/batch-execute`,
      data
    ),

  cancelOrder: (
    liquidationId: string,
    data: {
      position_id: string;
      cancellation_reason: string;
      notes?: string;
    }
  ) =>
    api.post<ForcedLiquidation>(
      `/trading/liquidations/${liquidationId}/cancel-order`,
      data
    ),

  getExecutions: (liquidationId: string) =>
    api.get<LiquidationExecution[]>(
      `/trading/liquidations/${liquidationId}/executions`
    ),
};
