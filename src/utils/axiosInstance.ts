import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL, API_KEY } from '@/config';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['x-api-key'] = API_KEY;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      // Prevent multiple toasts
      toast.dismiss();
      toast.error('Session expired. Please log in again.');

      // Clear storage
      localStorage.clear();
      sessionStorage.clear();

      // Redirect after short delay
      setTimeout(() => {
        window.location.href = '/'; // Reload will happen automatically on navigation
      }, 1500);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
