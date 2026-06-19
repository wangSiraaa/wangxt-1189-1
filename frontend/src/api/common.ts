import { api } from './client';
import { Customer, User, Security, AuditLog, DashboardStats } from '../types';

export const commonApi = {
  getCustomers: (params?: {
    page?: number;
    page_size?: number;
    manager_id?: string;
  }) =>
    api.get<{ customers: Customer[]; total: number }>('/common/customers', { params }),

  getCustomer: (customerId: string) =>
    api.get<Customer>(`/common/customers/${customerId}`),

  getUsers: (params?: { role?: string }) =>
    api.get<User[]>('/common/users', { params }),

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

  healthCheck: () => api.get('/health'),
};
