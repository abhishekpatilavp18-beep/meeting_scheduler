import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Request cache to prevent duplicates
const pendingRequests = new Map();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s timeout (bulk slot operations can take time)
});

// Helper for logging frontend requests to help identify spam
const logRequest = (config) => {
  const timestamp = new Date().toISOString();
  console.log(`[API_REQ][${timestamp}] ${config.method.toUpperCase()} ${config.url}`);
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Deduplicate only GET requests to be safe
    if (config.method.toLowerCase() === 'get') {
      const requestKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${JSON.stringify(config.data || {})}`;
      
      // If a request with the same key is already pending, abort the OLD one 
      // and let this NEW one proceed. This ensures the latest mount gets the data.
      if (pendingRequests.has(requestKey)) {
        console.warn(`[API_PREV_ABORT] Aborting stale request: ${config.url}`);
        const oldController = pendingRequests.get(requestKey);
        oldController.abort();
      }
      
      const controller = new AbortController();
      config.signal = controller.signal;
      pendingRequests.set(requestKey, controller);
    }

    logRequest(config);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Clear pending request on success
    const config = response.config;
    if (config.method.toLowerCase() === 'get') {
      // Use config.data directly since GET requests don't typically have bodies, but if they do we must parse carefully.
      // Actually, since GET requests rarely have bodies, we can just use the key.
      const requestData = typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {});
      const requestKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${requestData}`;
      pendingRequests.delete(requestKey);
    }

    return response.data;
  },
  async (error) => {
    const config = error.config;
    if (config && config.method && config.method.toLowerCase() === 'get') {
      const requestData = typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {});
      const requestKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${requestData}`;
      // Only delete if this is the controller we own
      if (pendingRequests.get(requestKey) === config.signal) {
        pendingRequests.delete(requestKey);
      }
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    // Handle 403 Forbidden (RBAC denial)
    if (error.response?.status === 403) {
      console.warn(`[API_403] Access denied: ${error.response?.data?.message || 'Insufficient permissions'}`);
    }

    // CANCELLATION: If a request was aborted by our deduplication or a component 
    // unmounting, reject with a special error that callers can identify and ignore.
    if (axios.isCancel(error)) {
      const cancelError = new Error('Request was cancelled');
      cancelError.isCancelled = true;
      return Promise.reject(cancelError);
    }

    // Handle 429 Too Many Requests with exponential backoff retry
    if (error.response?.status === 429) {
      const retryCount = config.__retryCount || 0;
      const MAX_RETRIES = 3;

      if (retryCount < MAX_RETRIES) {
        config.__retryCount = retryCount + 1;
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
        console.warn(`[API_429] Rate limited. Retrying ${config.url} in ${Math.round(delay)}ms... (Attempt ${config.__retryCount}/${MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(config);
      }
      
      console.error(`[API_429_MAX] Max retries reached for ${config.url}`);
      window.dispatchEvent(new CustomEvent('api:rate-limit', { detail: { message: error.response.data.message } }));
    }
    
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const errObj = new Error(message);
    if (error.response?.data) {
      Object.assign(errObj, error.response.data);
    }
    return Promise.reject(errObj);
  }
);

export default api;
