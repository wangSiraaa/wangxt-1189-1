import { api } from './client';
import type { AxiosRequestConfig } from 'axios';
import { Customer, User, Security, AuditLog, DashboardStats, RiskHistory } from '../types';

export const commonApi = {
  getCustomers: (params?: {
    page?: number;
    page_size?: number;
    manager_id?: string;
  }) =>
    api.get<{ customers: Customer[]; total: number }>('/common/customers', { params }),

  getCustomer: (customerId: string) =>
    api.get<Customer>(`/common/customers/${customerId}`),

  getUsers: (params?: { role?: string }, config?: AxiosRequestConfig) =>
    api.get<User[]>('/common/users', { params, ...config }),

  getSecurities: (params?: { is_suspended?: boolean }) =>
    api.get<Security[]>('/common/securities', { params }),

  getAuditLogs: (params?: {
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    page?: number;
    page_size?: number;
  }) =>
    api.get<{ logs: AuditLog[]; total: number }>('/common/audit-logs', { params }),

  getDashboardStats: () =>
    api.get<DashboardStats>('/common/statistics/dashboard'),

  getRiskHistory: (params?: {
    customer_id?: string;
    start_date?: string;
    end_date?: string;
  }) =>
    api.get<{ history: RiskHistory[]; customers: Customer[] }>('/common/risk-history', {
      params,
    }),

  healthCheck: () => api.get('/health'),
};
