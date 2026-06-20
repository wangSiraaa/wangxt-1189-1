import { api } from './client';
import { User, UserRole } from '../types';
import type { AxiosRequestConfig } from 'axios';

export interface LoginRequest {
  username: string;
  password: string;
  role?: UserRole;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export const authApi = {
  login: (data: LoginRequest, config?: AxiosRequestConfig) =>
    api.post<LoginResponse>('/auth/login', data, config),

  logout: () => api.post<{ message: string }>('/auth/logout'),

  getCurrentUser: () => api.get<User>('/auth/me'),

  healthCheck: (config?: AxiosRequestConfig) => api.get<{
    status: string;
    timestamp: string;
    database: string;
    port: number;
  }>('/health', config),
};
