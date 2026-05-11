// import React, { createContext, useContext, useEffect, useState } from "react";

// export type Role = "employee" | "kitchen" | "admin";

// export interface AuthClaims {
//   user_id: string;
//   username: string;
//   full_name?: string;
//   role_type: string;
//   email?: string;
//   company_id?: string;
//   employee_id?: string;
//   canteen_id?: string;
//   device_user_id?: string;
//   display_name?: string;
// }

// export interface AuthState {
//   isAuthenticated: boolean;
//   token: string | null;
//   claims: AuthClaims | null;
//   role: Role | null;
//   loading: boolean;
// }

// interface AuthContextType extends AuthState {
//   setToken: (token: string | null, claims?: AuthClaims | null) => void;
//   clearAuth: () => void;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// const ACCESS_KEY = "canteen_access_token";
// const REFRESH_KEY = "canteen_refresh_token";
// const CLAIMS_KEY = "canteen_auth_claims";

// /**
//  * AuthProvider component - manages authentication state with sessionStorage persistence
//  */
// export function AuthProvider({ children }: { children: React.ReactNode }) {
//   const [auth, setAuth] = useState<AuthState>({
//     isAuthenticated: false,
//     token: null,
//     claims: null,
//     role: null,
//     loading: true,
//   });

//   // Initialize from sessionStorage on mount
//   useEffect(() => {
//     try {
//       const token = sessionStorage.getItem(STORAGE_KEY);
//       const claimsJson = sessionStorage.getItem(CLAIMS_KEY);

//       if (token && claimsJson) {
//         const claims = JSON.parse(claimsJson) as AuthClaims;
//         const role = mapRoleFromClaims(claims);
//         setAuth({
//           isAuthenticated: true,
//           token,
//           claims,
//           role,
//           loading: false,
//         });
//       } else {
//         setAuth((prev) => ({ ...prev, loading: false }));
//       }
//     } catch (error) {
//       console.error("Failed to initialize auth from sessionStorage:", error);
//       setAuth((prev) => ({ ...prev, loading: false }));
//     }
//   }, []);

//   const setToken = (access: string | null, refresh?: string | null, claims?: AuthClaims | null) => {
//     if (access && refresh) {
//       sessionStorage.setItem(ACCESS_KEY, access);
//       sessionStorage.setItem(REFRESH_KEY, refresh);

//       if (claims) {
//         sessionStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
//       }

//       setAuth({
//         isAuthenticated: true,
//         token: access,
//         claims,
//         role: claims ? mapRoleFromClaims(claims) : null,
//         loading: false,
//       });
//     } else {
//       clearAuth();
//     }
//   };

//   const clearAuth = () => {
//     sessionStorage.removeItem(STORAGE_KEY);
//     sessionStorage.removeItem(CLAIMS_KEY);
//     setAuth({
//       isAuthenticated: false,
//       token: null,
//       claims: null,
//       role: null,
//       loading: false,
//     });
//   };

//   return (
//     <AuthContext.Provider value={{ ...auth, setToken, clearAuth }}>{children}</AuthContext.Provider>
//   );
// }

// /**
//  * Hook to access auth context
//  */
// export function useAuth(): AuthContextType {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error("useAuth must be used within AuthProvider");
//   }
//   return context;
// }

// /**
//  * Maps JWT claims to frontend Role type
//  */
// function mapRoleFromClaims(claims: AuthClaims): Role {
//   const roleType = claims.role_type || "";
//   if (roleType.includes("KITCHEN")) return "kitchen";
//   if (roleType.includes("COUNTER")) return "kitchen"; // Counter uses same role on frontend
//   if (roleType.includes("ADMIN") || roleType.includes("COMPANY_ADMIN")) return "admin";
//   return "employee";
// }

// /**
//  * Get token from sessionStorage
//  */
// export function getTokenFromStorage(): string | null {
//   if (typeof window === "undefined") return null;
//   return sessionStorage.getItem(STORAGE_KEY);
// }

// /**
//  * Get claims from sessionStorage
//  */
// export function getClaimsFromStorage(): AuthClaims | null {
//   if (typeof window === "undefined") return null;
//   try {
//     const claimsJson = sessionStorage.getItem(CLAIMS_KEY);
//     return claimsJson ? JSON.parse(claimsJson) : null;
//   } catch {
//     return null;
//   }
// }

// export function getRefreshToken(): string | null {
//   return sessionStorage.getItem(REFRESH_KEY);
// }


import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getAccessToken,
  getRefreshToken as getRefreshTokenStorage,
  getClaims,
  saveAccessToken,
  saveRefreshToken,
  saveClaims,
  clearAllAuthStorage,
} from './authStorage';

export type Role = 'employee' | 'kitchen' | 'admin';

export interface AuthClaims {
  user_id: string;
  username: string;
  full_name?: string;
  role_type: string;
  email?: string;
  company_id?: string;
  employee_id?: string;
  canteen_id?: string;
  device_user_id?: string;
  display_name?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;   // access token
  claims: AuthClaims | null;
  role: Role | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  setToken: (access: string | null, refresh?: string | null, claims?: AuthClaims | null) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    claims: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    try {
      const access = getAccessToken();
      const claims = getClaims<AuthClaims>();

      if (access && claims) {
        const role = mapRoleFromClaims(claims);

        setAuth({
          isAuthenticated: true,
          token: access,
          claims,
          role,
          loading: false,
        });
      } else {
        setAuth((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Auth init failed', err);
      setAuth((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const setToken = (
    access: string | null,
    refresh?: string | null,
    claims?: AuthClaims | null
  ) => {
    if (access) {
      saveAccessToken(access);

      if (refresh) {
        saveRefreshToken(refresh);
      }

      if (claims) {
        saveClaims(claims);
      }

      const role = claims ? mapRoleFromClaims(claims) : auth.role;

      setAuth({
        isAuthenticated: true,
        token: access,
        claims: claims || auth.claims,
        role,
        loading: false,
      });
    } else {
      clearAuth();
    }
  };

  const clearAuth = () => {
    clearAllAuthStorage();

    setAuth({
      isAuthenticated: false,
      token: null,
      claims: null,
      role: null,
      loading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...auth, setToken, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Role mapper (unchanged)
 */
function mapRoleFromClaims(claims: AuthClaims): Role {
  const roleType = claims.role_type || '';
  if (roleType.includes('KITCHEN')) return 'kitchen';
  if (roleType.includes('COUNTER')) return 'kitchen';
  if (roleType.includes('ADMIN') || roleType.includes('COMPANY_ADMIN')) return 'admin';
  return 'employee';
}

/**
 * 🔥 UPDATED HELPERS
 */
export function getTokenFromStorage(): string | null {
  return getAccessToken();
}

export function getRefreshToken(): string | null {
  return getRefreshTokenStorage();
}

export function getClaimsFromStorage(): AuthClaims | null {
  return getClaims<AuthClaims>();
}