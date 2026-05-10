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

type RequestOptions = {
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
};

function buildUrl(path: string, params?: RequestOptions['params']) {
  const url = new URL(`${baseURL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.append(key, String(value));
    });
  }
  return url.toString();
}

function buildHeaders(extraHeaders?: Record<string, string>, body?: unknown) {
  const headers: Record<string, string> = {
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  return headers;
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
async function get<T = unknown>(path: string, options?: RequestOptions, retry = true) {
  let response = await fetch(buildUrl(path, options?.params), {
    method: 'GET',
    headers: buildHeaders(options?.headers),
  });

  // Handle token expiry
  if (response.status === 401 && retry) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      return get<T>(path, options, false);
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

  return { data: data as T };
}

async function post<T = unknown>(path: string, body: unknown, options?: RequestOptions, retry = true) {
  let response = await fetch(buildUrl(path, options?.params), {
    method: 'POST',
    headers: buildHeaders(options?.headers, body),
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  // 🔥 Handle expiry
  if (response.status === 401 && retry) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      // ✅ retry ONLY ONCE via recursion
      return post<T>(path, body, options, false);
    }
  }

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data: data as T };
}

async function patch<T = unknown>(path: string, body: unknown, options?: RequestOptions) {
  const response = await fetch(buildUrl(path, options?.params), {
    method: 'PATCH',
    headers: buildHeaders(options?.headers, body),
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data: data as T };
}

async function put<T = unknown>(path: string, body: unknown, options?: RequestOptions) {
  const response = await fetch(buildUrl(path, options?.params), {
    method: 'PUT',
    headers: buildHeaders(options?.headers, body),
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data: data as T };
}

async function del<T = unknown>(path: string, options?: RequestOptions) {
  const response = await fetch(buildUrl(path, options?.params), {
    method: 'DELETE',
    headers: buildHeaders(options?.headers),
  });

  if (!response.ok) {
    const data = await parseJsonResponse(response);
    const error = new Error(data?.detail || response.statusText || 'Request failed');
    (error as any).response = { status: response.status, data };
    throw error;
  }

  return { data: null as T };
}

async function download(path: string, options?: RequestOptions) {
  const response = await fetch(buildUrl(path, options?.params), {
    method: 'GET',
    headers: buildHeaders(options?.headers),
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
  put,
  delete: del,
  download,
};

export default api;
