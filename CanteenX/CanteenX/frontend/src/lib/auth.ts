/**
 * Authentication initialization and management
 * Integrates with backend endpoints:
 * - Employee/Admin: POST /api/v1/auth/login/
 * - Kitchen/Counter: POST /api/v1/cms/auth/device-login/
 */

import api from "@/api/client";
import { AuthClaims } from "./authContext";
import {
  saveAccessToken,
  saveRefreshToken,
  saveClaims,
  saveUserSession,
  getUserSession,
  clearAllAuthStorage,
} from "./authStorage";

export type Role = "employee" | "kitchen" | "admin";

export interface User {
  id: string;
  name: string;
  pin: string;
  role: Role;
  department?: string;
}

/**
 * Login user with role, ID, and PIN/password
 * Calls appropriate backend endpoint based on role
 */
export async function login(role: Role, id: string, pin: string): Promise<User> {
  let response: any;

  try {
    if (role === "kitchen") {
      response = await api.post("/cms/auth/device-login/", {
        username: id,
        pin: pin,
      });
    } else {
      response = await api.post("/auth/login/", {
        login_id: id,
        password: pin,
        role: role,
      });
    }

    // 🔥 Extract BOTH tokens
    const access = response.data.access;
    const refresh = response.data.refresh; // ✅ NEW

    const claims: AuthClaims = {
      user_id: response.data.user_id,
      username: response.data.username,
      full_name: response.data.full_name,
      role_type: response.data.role_type,
      email: response.data.email,
      company_id: response.data.company_id,
      employee_id: response.data.employee_id,
    };

    if (role === "kitchen") {
      claims.canteen_id = response.data.canteen_id;
      claims.device_user_id = response.data.device_user_id;
      claims.display_name = response.data.display_name;
    }

    // 🔥 FIXED STORAGE (aligned with new system)
    if (typeof window !== "undefined") {
      saveAccessToken(access);

      if (refresh) {
        saveRefreshToken(refresh);
      }

      saveClaims(claims);
    }

    const user: User = {
      id: response.data.user_id,
      name: response.data.full_name || response.data.username,
      pin: pin,
      role: role,
      department: role,
    };

    // ✅ keep existing session logic in a centralized helper
    if (typeof window !== "undefined") {
      saveUserSession(user);
    }

    return user;
  } catch (error: any) {
    const message = error.response?.data?.detail || error.message || "Login failed";
    throw new Error(message);
  }
}

/**
 * Get the home route for a given role
 */
export function homeRouteFor(role: Role): string {
  const routes: Record<Role, string> = {
    employee: "/dashboard",
    kitchen: "/kitchen",
    admin: "/admin",
  };
  return routes[role];
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return getUserSession<User>();
  } catch (error) {
    console.error("Failed to parse session data:", error);
    return null;
  }
}

/**
 * Logout the current user and clear auth storage
 */
export function logout(): void {
  if (typeof window !== "undefined") {
    clearAllAuthStorage();
  }
}

/**
 * Ensures that authentication is initialized.
 * This function checks and initializes any auth state needed for the app.
 */
export async function ensureAuthInitialized(): Promise<void> {
  try {
    // Check if user is already authenticated
    const currentUser = getCurrentUser();

    if (!currentUser && typeof window !== "undefined") {
      // User not authenticated, redirect to login will happen in route guards
      // This is just initialization, actual redirect happens in route components
    }
  } catch (error) {
    console.error("Failed to initialize auth:", error);
  }
}

