import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { ApiResponse } from '../types';

const baseURL = '/api';

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
      const user = JSON.parse(currentUser);
      config.headers['x-user-id'] = user.user_id;
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
      message.error(data.error || '请求失败');
      return Promise.reject(new Error(data.error || '请求失败'));
    }
  },
  (error) => {
    const errorMessage = error.response?.data?.error || error.message || '网络错误';
    message.error(errorMessage);
    return Promise.reject(error);
  }
);

export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => instance.get<any, T>(url, config),
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => instance.post<any, T>(url, data, config),
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => instance.put<any, T>(url, data, config),
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => instance.delete<any, T>(url, config),
};

export default api;
