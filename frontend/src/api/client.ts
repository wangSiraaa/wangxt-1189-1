import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { ApiResponse } from '../types';

const baseURL = '/api';

declare module 'axios' {
  interface AxiosRequestConfig {
    skipErrorMessage?: boolean;
  }
}

const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

instance.interceptors.request.use(
  (config) => {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        if (user?.user_id) {
          config.headers['x-user-id'] = user.user_id;
        }
      } catch (e) {
        // ignore parse error
      }
    }
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['x-token'] = token;
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse;
    if (data.success) {
      return data.data;
    } else {
      const errorMsg = data.error || '请求失败';
      if (!response.config?.skipErrorMessage) {
        message.error(errorMsg);
      }
      const err = new Error(errorMsg);
      (err as any).status = response.status;
      return Promise.reject(err);
    }
  },
  (error) => {
    const serverError = error.response?.data?.error;
    const errorMessage = serverError || error.message || '网络错误';
    if (!error.config?.skipErrorMessage) {
      message.error(errorMessage);
    }
    const customError = new Error(errorMessage);
    (customError as any).status = error.response?.status;
    (customError as any).response = error.response;
    return Promise.reject(customError);
  }
);

export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => instance.get<any, T>(url, config),
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => instance.post<any, T>(url, data, config),
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => instance.put<any, T>(url, data, config),
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => instance.delete<any, T>(url, config),
};

export default api;
