import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Make API call using Axios (client-side)
 */
export async function apiRequest<T = any>(
  path: string,
  config: AxiosRequestConfig = {},
): Promise<ApiResponse<T>> {
  try {
    const isFormData = config.data instanceof FormData;
    
    const headers = isFormData
      ? { ...config.headers }
      : {
          "Content-Type": "application/json",
          ...config.headers,
        };

    const response: AxiosResponse<ApiResponse<T>> = await axios({
      url: path.startsWith("/") ? path : `/${path}`,
      method: config.method || "GET",
      headers,
      data: config.data,
      params: config.params,
      withCredentials: true,
      ...config,
    });

    return response.data;
  } catch (error: any) {
    if (error.response) {
      return (
        error.response.data || {
          success: false,
          message: error.response.statusText || "An error occurred",
        }
      );
    } else if (error.request) {
      return {
        success: false,
        message: "No response from server",
      };
    } else {
      return {
        success: false,
        message: error.message || "An error occurred",
      };
    }
  }
}

export async function apiGet<T = any>(
  path: string,
  params?: Record<string, any>,
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, {
    method: "GET",
    params,
  });
}
