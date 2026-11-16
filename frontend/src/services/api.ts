import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected API error occurred';

    // Keep the HTTP status and Axios error code so callers can tell
    // timeouts, network failures and provider errors apart.
    return Promise.reject(Object.assign(
      new Error(Array.isArray(message) ? message.join(', ') : message),
      {
        status: error.response?.status as number | undefined,
        code: error.code as string | undefined,
        errorCode: error.response?.data?.errorCode as string | undefined,
      },
    ));
  },
);

export default api;
