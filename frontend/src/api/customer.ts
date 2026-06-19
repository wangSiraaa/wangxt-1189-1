import { api } from './client';
import {
  Communication,
  CollateralAddition,
  CommunicationType,
  AdditionType,
  AdditionStatus,
} from '../types';

export const customerApi = {
  createCommunication: (data: {
    customer_id: string;
    manager_id?: string;
    communication_type: CommunicationType;
    content: string;
    warning_id?: string;
    customer_response?: string;
    next_follow_up_at?: string;
  }) => api.post<Communication>('/customer/communications', data),

  getCommunications: (params?: {
    customer_id?: string;
    warning_id?: string;
    manager_id?: string;
    page?: number;
    page_size?: number;
  }) =>
    api.get<{ communications: Communication[]; total: number }>('/customer/communications', { params }),

  recordCollateralAddition: (data: {
    customer_id: string;
    addition_type: AdditionType;
    amount: number;
    warning_id?: string;
    security_id?: string;
    quantity?: number;
    notes?: string;
  }) => api.post<CollateralAddition>('/customer/collateral-additions', data),

  getCollateralAdditions: (params?: {
    customer_id?: string;
    warning_id?: string;
    status?: AdditionStatus;
    page?: number;
    page_size?: number;
  }) =>
    api.get<{ additions: CollateralAddition[]; total: number }>(
      '/customer/collateral-additions',
      { params }
    ),

  confirmAddition: (additionId: string) =>
    api.post<CollateralAddition>(`/customer/collateral-additions/${additionId}/confirm`),

  rejectAddition: (additionId: string, data: { notes?: string }) =>
    api.post<CollateralAddition>(`/customer/collateral-additions/${additionId}/reject`, data),

  checkPendingAddition: (customerId: string) =>
    api.get<{ has_pending: boolean }>(`/customer/collateral-additions/pending/${customerId}`),
};
