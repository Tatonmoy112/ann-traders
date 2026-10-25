import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status = 500, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const isServer = typeof window === 'undefined';
const baseURL = isServer
  ? process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'
  : '';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Client-side session or trace headers can be attached here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const responseData = error.response?.data;
      const message =
        responseData?.error ||
        responseData?.message ||
        error.message ||
        'An unexpected server error occurred';

      return Promise.reject(new ApiError(message, status, responseData));
    }
    return Promise.reject(new ApiError((error as Error).message || 'Network error'));
  },
);

// Type-safe HTTP Methods Helper
export const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await apiClient.get<T>(url, config);
    return res.data;
  },

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await apiClient.post<T>(url, data, config);
    return res.data;
  },

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await apiClient.put<T>(url, data, config);
    return res.data;
  },

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await apiClient.delete<T>(url, config);
    return res.data;
  },
};

export default api;

