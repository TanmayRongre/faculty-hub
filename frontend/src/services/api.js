import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s timeout to allow for Render cold starts (initial wake-up from sleep)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('facultyhub_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with Render cold-start auto-retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 globally (token expired/invalid)
    if (error.response?.status === 401) {
      localStorage.removeItem('facultyhub_token');
      localStorage.removeItem('facultyhub_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Render Cold Start Auto-Retry Logic (502, 503, 504, ECONNABORTED, Network Error)
    const isColdStartError =
      !error.response ||
      [502, 503, 504].includes(error.response.status) ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error');

    if (isColdStartError && originalRequest && !originalRequest._retryCount) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

      if (originalRequest._retryCount <= 3) {
        const delay = originalRequest._retryCount * 2000; // 2s, 4s, 6s backoff
        console.warn(`[API] Render backend cold-start detected. Retrying request in ${delay / 1000}s (Attempt ${originalRequest._retryCount}/3)...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Proactively pings the backend health endpoint to wake it up if idle.
 */
export async function wakeUpBackend() {
  try {
    const res = await api.get('/health', { timeout: 10000 });
    return res.data;
  } catch (err) {
    // Non-blocking ping
    console.debug('[API] Initial wake-up ping dispatched.');
  }
}

export default api;
