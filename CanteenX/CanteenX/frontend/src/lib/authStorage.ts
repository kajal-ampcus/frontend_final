export const ACCESS_KEY = 'canteen_access_token';
export const REFRESH_KEY = 'canteen_refresh_token';
export const CLAIMS_KEY = 'canteen_auth_claims';
export const SESSION_KEY = 'canteen_auth_session';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_KEY);
}

export function getTokenFromStorage(): string | null {
  return getAccessToken();
}

export function getClaimsFromStorage<T = any>(): T | null {
  return getClaims<T>();
}

export function getClaims<T = any>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const json = sessionStorage.getItem(CLAIMS_KEY);
    return json ? (JSON.parse(json) as T) : null;
  } catch {
    return null;
  }
}

export function getUserSession<T = any>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const json = sessionStorage.getItem(SESSION_KEY);
    return json ? (JSON.parse(json) as T) : null;
  } catch {
    return null;
  }
}

export function saveAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACCESS_KEY, token);
}

export function saveRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(REFRESH_KEY, token);
}

export function saveClaims(claims: unknown): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
}

export function saveUserSession(value: unknown): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
}

export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(CLAIMS_KEY);
}

export function clearUserSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function clearAllAuthStorage(): void {
  clearAuthStorage();
  clearUserSession();
}
