/**
 * Authentication initialization and management
 */

export type Role = "employee" | "kitchen" | "admin";

export interface User {
  id: string;
  name: string;
  pin: string;
  role: Role;
  department?: string;
}

/**
 * Mock users for demo purposes
 */
export const MOCK_USERS: User[] = [
  { id: "EMP-1234", name: "John Employee", pin: "1234", role: "employee", department: "employee" },
  { id: "CHEF-001", name: "Chef Maria", pin: "0001", role: "kitchen", department: "kitchen" },
  { id: "ADM-001", name: "Admin Alex", pin: "9999", role: "admin", department: "admin" },
];

// Session key for localStorage
const AUTH_SESSION_KEY = "canteen_auth_session";

/**
 * Login user with role, ID, and PIN
 */
export async function login(role: Role, id: string, pin: string): Promise<User> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 500));

  const user = MOCK_USERS.find(
    (u) => u.role === role && u.id.toLowerCase() === id.toLowerCase() && u.pin === pin
  );

  if (!user) {
    throw new Error("Invalid credentials");
  }

  // Store session in localStorage
  if (typeof window !== "undefined") {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  }

  return user;
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
    const sessionData = sessionStorage.getItem(AUTH_SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    console.error("Failed to parse session data:", error);
    return null;
  }
}

/**
 * Logout the current user
 */
export function logout(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  }
}

/**
 * Reset password for a user
 */
export function resetPassword(id: string, newPin: string): void {
  const user = MOCK_USERS.find((u) => u.id.toLowerCase() === id.toLowerCase());
  if (!user) {
    throw new Error("User not found");
  }

  // In a real app, this would call an API
  user.pin = newPin;
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
