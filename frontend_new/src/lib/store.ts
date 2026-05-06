import { useState, useEffect } from "react";
import { getCurrentUser } from "./auth";

// Types
export type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "collected" | "completed" | "cancelled" | "delivered";
export type ItemCategory = "Veg" | "Non-Veg" | "Beverages" | "Desserts" | "Snacks";
export type ItemType = "Breakfast" | "Lunch" | "Dinner" | "Snacks" | "Beverages" | "Meal" | "Dessert" | "Other";
export type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ItemCategory;
  type: ItemType;
  available: boolean;
  image?: string;
  rating?: number;
  reviews?: number;
}

export interface Slot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: "active" | "upcoming" | "expired";
  date: string;
  maxOrders?: number;
}

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  price: number;
  slotId?: string;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  slotId?: string;
  slotName?: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  walletBalance: number;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: "credit" | "debit";
  reason: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  expiresAt?: string;
  priority?: "low" | "medium" | "high";
}

// Constants
export const ALL_DAYS: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Mock data
const mockMenuItems: MenuItem[] = [
  { id: "1", name: "Idli", description: "South Indian steamed cake", price: 30, category: "Veg", type: "Breakfast", available: true },
  { id: "2", name: "Dosa", description: "Crispy rice pancake", price: 50, category: "Veg", type: "Breakfast", available: true },
  { id: "3", name: "Biryani", description: "Fragrant rice dish", price: 120, category: "Non-Veg", type: "Lunch", available: true },
  { id: "4", name: "Paneer Tikka", description: "Grilled cottage cheese", price: 100, category: "Veg", type: "Dinner", available: true },
];

const mockSlots: Slot[] = [
  { id: "breakfast", name: "Breakfast", startTime: "08:00", endTime: "10:00", status: "active", date: new Date().toISOString().split("T")[0] },
  { id: "lunch", name: "Lunch", startTime: "12:00", endTime: "14:00", status: "upcoming", date: new Date().toISOString().split("T")[0] },
  { id: "dinner", name: "Dinner", startTime: "18:00", endTime: "20:00", status: "upcoming", date: new Date().toISOString().split("T")[0] },
];

const mockCustomers: Customer[] = [
  { id: "cust-1", name: "Raj Kumar", department: "IT", email: "raj@company.com", phone: "9876543210", walletBalance: 1000, createdAt: new Date().toISOString() },
];

const mockOrders: Order[] = [];
const mockAnnouncements: Announcement[] = [];
const mockWalletTransactions: WalletTransaction[] = [];

// Simple store implementation without external dependencies
interface StoreState {
  menuItems: MenuItem[];
  slots: Slot[];
  customers: Customer[];
  orders: Order[];
  announcements: Announcement[];
  walletTransactions: WalletTransaction[];
  cart: { items: OrderItem[] };
  currentCustomerId: string | null;
}

// Global store state
let storeState: StoreState = {
  menuItems: mockMenuItems,
  slots: mockSlots,
  customers: mockCustomers,
  orders: mockOrders,
  announcements: mockAnnouncements,
  walletTransactions: mockWalletTransactions,
  cart: { items: [] },
  currentCustomerId: mockCustomers[0]?.id || null,
};

// Subscribers for reactive updates
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback());
};

// Custom hooks
export const useStore = (selector?: (state: StoreState) => any) => {
  const [, setState] = useState(0);

  useEffect(() => {
    const unsubscribe = () => {
      setState((prev: number) => prev + 1);
    };
    subscribers.add(unsubscribe);
    return () => {
      subscribers.delete(unsubscribe);
    };
  }, []);

  if (selector) {
    return selector(storeState);
  }
  return storeState;
};

export const useCart = () => {
  const [, setState] = useState(0);

  useEffect(() => {
    const unsubscribe = () => {
      setState((prev: number) => prev + 1);
    };
    subscribers.add(unsubscribe);
    return () => {
      subscribers.delete(unsubscribe);
    };
  }, []);

  return storeState.cart;
};

export const useEntities = <T,>(type: string): T[] => {
  const [, setState] = useState(0);

  useEffect(() => {
    const unsubscribe = () => {
      setState((prev: number) => prev + 1);
    };
    subscribers.add(unsubscribe);
    return () => {
      subscribers.delete(unsubscribe);
    };
  }, []);

  const key = `${type}s` as keyof StoreState;
  return (storeState[key] as T[]) || [];
};

export const useCurrentCustomer = (): Customer | null => {
  const [, setState] = useState(0);

  useEffect(() => {
    const unsubscribe = () => {
      setState((prev: number) => prev + 1);
    };
    subscribers.add(unsubscribe);
    return () => {
      subscribers.delete(unsubscribe);
    };
  }, []);

  const { currentCustomerId, customers } = storeState;
  return currentCustomerId ? customers.find((c) => c.id === currentCustomerId) || null : null;
};

// Store action functions - exported with correct names
const createEntityInternal = <T extends MenuItem | Slot | Customer | Order | Announcement | WalletTransaction>(
  type: string,
  entity: T
) => {
  const key = `${type}s` as keyof StoreState;
  const items = storeState[key] as any[];
  storeState[key] = [...items, entity] as any;
  notifySubscribers();
};

const updateEntityInternal = <T extends MenuItem | Slot | Customer | Order | Announcement | WalletTransaction>(
  type: string,
  id: string,
  updates: Partial<T>
) => {
  const key = `${type}s` as keyof StoreState;
  const items = storeState[key] as any[];
  storeState[key] = items.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  ) as any;
  notifySubscribers();
};

const deleteEntityInternal = (type: string, id: string) => {
  const key = `${type}s` as keyof StoreState;
  const items = storeState[key] as any[];
  storeState[key] = items.filter((item) => item.id !== id) as any;
  notifySubscribers();
};

const addToCartInternal = (item: OrderItem) => {
  const existingItem = storeState.cart.items.find(
    (i) => i.menuItemId === item.menuItemId && i.slotId === item.slotId
  );
  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    storeState.cart.items.push(item);
  }
  notifySubscribers();
};

const removeFromCartInternal = (menuItemId: string, slotId?: string) => {
  storeState.cart.items = storeState.cart.items.filter(
    (item) => !(item.menuItemId === menuItemId && item.slotId === slotId)
  );
  notifySubscribers();
};

const updateCartQuantityInternal = (menuItemId: string, quantity: number, slotId?: string) => {
  const item = storeState.cart.items.find(
    (i) => i.menuItemId === menuItemId && i.slotId === slotId
  );
  if (item) {
    item.quantity = Math.max(0, quantity);
  }
  notifySubscribers();
};

const addToWalletInternal = (customerId: string, amount: number, reason: string) => {
  const customer = storeState.customers.find((c) => c.id === customerId);
  if (customer) {
    customer.walletBalance += amount;
  }
  storeState.walletTransactions.push({
    id: `txn-${Date.now()}`,
    customerId,
    amount,
    type: "credit",
    reason,
    createdAt: new Date().toISOString(),
  });
  notifySubscribers();
};

const deductFromWalletInternal = (customerId: string, amount: number, reason: string) => {
  const customer = storeState.customers.find((c) => c.id === customerId);
  if (customer && customer.walletBalance >= amount) {
    customer.walletBalance -= amount;
  }
  storeState.walletTransactions.push({
    id: `txn-${Date.now()}`,
    customerId,
    amount,
    type: "debit",
    reason,
    createdAt: new Date().toISOString(),
  });
  notifySubscribers();
};

const updateOrderStatusInternal = (orderId: string, status: OrderStatus) => {
  updateEntityInternal("order", orderId, { status, updatedAt: new Date().toISOString() } as any);
};

// Utility functions
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);
};

export const downloadCSV = (data: any[], filename: string): void => {
  if (data.length === 0) {
    console.warn("No data to download");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const escaped = typeof value === "string" && value.includes(",") ? `"${value}"` : value;
          return escaped;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// Entity-specific functions
export const createMenuItem = (menuItem: MenuItem) => {
  createEntityInternal("menuItem", menuItem);
};

export const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
  updateEntityInternal("menuItem", id, updates);
};

export const deleteMenuItem = (id: string) => {
  deleteEntityInternal("menuItem", id);
};

export const createAnnouncement = (announcement: Announcement) => {
  createEntityInternal("announcement", announcement);
};

export const updateAnnouncement = (id: string, updates: Partial<Announcement>) => {
  updateEntityInternal("announcement", id, updates);
};

export const deleteAnnouncement = (id: string) => {
  deleteEntityInternal("announcement", id);
};

export const addToWallet = (customerId: string, amount: number, reason: string = "Add funds") => {
  addToWalletInternal(customerId, amount, reason);
};

export const deductFromWallet = (customerId: string, amount: number, reason: string) => {
  deductFromWalletInternal(customerId, amount, reason);
};

export const addToCustomerWallet = (customerId: string, amount: number) => {
  addToWalletInternal(customerId, amount, "Admin credit");
};

export const updateOrderStatus = (orderId: string, status: OrderStatus) => {
  updateOrderStatusInternal(orderId, status);
};

export const createEntity = <T extends MenuItem | Slot | Customer | Order | Announcement | WalletTransaction>(
  type: string,
  entity: T
) => {
  createEntityInternal(type, entity);
};

export const updateEntity = <T extends MenuItem | Slot | Customer | Order | Announcement | WalletTransaction>(
  type: string,
  id: string,
  updates: Partial<T>
) => {
  updateEntityInternal(type, id, updates);
};

export const deleteEntity = (type: string, id: string) => {
  deleteEntityInternal(type, id);
};

export const addToCart = (item: OrderItem) => {
  addToCartInternal(item);
};

export const removeFromCart = (menuItemId: string, slotId?: string) => {
  removeFromCartInternal(menuItemId, slotId);
};

export const updateCartQuantity = (menuItemId: string, quantity: number, slotId?: string) => {
  updateCartQuantityInternal(menuItemId, quantity, slotId);
};
