// import { getTokenFromStorage } from '@/lib/authContext';

// const baseURL = import.meta.env.BACKEND_URL ?? 'http://localhost:8000/api/v1';

// console.log(baseURL)

// function buildHeaders() {
//   const headers: Record<string, string> = {
//     'Content-Type': 'application/json',
//   };
//   const token = getTokenFromStorage();
//   if (token) {
//     headers.Authorization = `Bearer ${token}`;
//   }
//   return headers;
// }

// async function parseJsonResponse(response: Response) {
//   const text = await response.text();
//   try {
//     return text ? JSON.parse(text) : null;
//   } catch {
//     return text;
//   }
// }

// async function post(path: string, body: unknown) {
//   const response = await fetch(`${baseURL}${path}`, {
//     method: 'POST',
//     headers: buildHeaders(),
//     body: JSON.stringify(body),
//   });

//   const data = await parseJsonResponse(response);
//   if (!response.ok) {
//     const error = new Error(data?.detail || response.statusText || 'Request failed');
//     (error as any).response = { status: response.status, data };
//     throw error;
//   }

//   return { data };
// }

// const api = {
//   defaults: { baseURL },
//   post,
// };

// export default api;











import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveClaims,
  clearAllAuthStorage,
} from '@/lib/authStorage';

/**
 * Configured Axios instance for API communication.
 * 
 * Connection strategy (configurable via ENV):
 *  - VITE_API_BASE_URL: Direct API URL (e.g., http://backend:8000/api/v1)
 *  - BACKEND_URL: (Not used in browser, only for SSR if needed)
 *  - Default: /api/v1 (uses Vite proxy)
 * 
 * Token: Read from localStorage on each request
 */

const baseURL = import.meta.env.BACKEND_URL ?? 'http://localhost:8000/api/v1';

function buildHeaders(isJson = true) {
  const headers: Record<string, string> = {};

  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function buildBody(body: unknown) {
  if (body === undefined || body === null) return undefined;
  return isFormDataBody(body) ? body : JSON.stringify(body);
}

function buildUrl(path: string, params?: Record<string, unknown>) {
  const url = new URL(`${baseURL}${path}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

/**
 *  NEW: refresh token logic
 */
async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const res = await fetch(`${baseURL}/auth/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
      clearAllAuthStorage();
      return false;
    }

    const data = await res.json();

    saveAccessToken(data.access);
    const refreshedClaims = {
      user_id: data.user_id,
      username: data.username,
      role_type: data.role_type,
      company_id: data.company_id,
      employee_id: data.employee_id,
    };

    saveClaims(refreshedClaims);

    return true;
  } catch {
    clearAllAuthStorage();
    return false;
  }
}
async function get<T = unknown>(
  path: string,
  configOrRetry?: { params?: Record<string, unknown> } | boolean,
  retry = true,
): Promise<{ data: T }> {
  const config = typeof configOrRetry === 'boolean' ? undefined : configOrRetry;
  const shouldRetry = typeof configOrRetry === 'boolean' ? configOrRetry : retry;

  let response = await fetch(buildUrl(path, config?.params), {
    method: 'GET',
    headers: buildHeaders(),
  });

  // Handle token expiry
  if (response.status === 401 && shouldRetry) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      return get<T>(path, config, false);
    }
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(
      data?.detail || response.statusText || 'Request failed'
    );

    (error as any).response = {
      status: response.status,
      data,
    };

    throw error;
  }

  return { data };
}

async function post<T = unknown>(
  path: string,
  body: unknown,
  configOrRetry?: { headers?: Record<string, string> } | boolean,
  retry = true,
): Promise<{ data: T }> {
  const shouldRetry = typeof configOrRetry === 'boolean' ? configOrRetry : retry;
  const isFormData = isFormDataBody(body);

  let response = await fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers: buildHeaders(!isFormData),
    body: buildBody(body),
  });

  // 🔥 Handle expiry
  if (response.status === 401 && shouldRetry) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      // ✅ retry ONLY ONCE via recursion
      return post<T>(path, body, false);
    }
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data };
}

async function patch<T = unknown>(
  path: string,
  body: unknown,
  _config?: { headers?: Record<string, string> },
): Promise<{ data: T }> {
  const isFormData = isFormDataBody(body);

  const response = await fetch(`${baseURL}${path}`, {
    method: 'PATCH',
    headers: buildHeaders(!isFormData),
    body: buildBody(body),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data };
}

async function del<T = null>(path: string): Promise<{ data: T | null }> {
  const response = await fetch(`${baseURL}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data: null };
}

async function download(path: string) {
  const response = await fetch(`${baseURL}${path}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  const blob = await response.blob();
  return { blob };
}

const api = {
  defaults: { baseURL },
  get,
  post,
  patch,
  delete: del,
  download,
};

export default api;
