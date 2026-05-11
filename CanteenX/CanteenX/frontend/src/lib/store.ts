import { useEffect, useState } from "react";

// Types
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "collected"
  | "completed"
  | "cancelled"
  | "delivered";
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
  image?: string | null;
  rating?: number;
  reviews?: number;
  quantity?: number;
  slot?: string;
  slotId?: string;
  days?: Day[];
  tag?: string;
  live?: boolean;
}

export interface Slot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: "active" | "upcoming" | "expired";
  date: string;
  maxOrders?: number;
  displayTime?: string;
  type?: ItemType;
  defaultCategory?: ItemCategory;
  active?: boolean;
  capacity?: number;
  currentOccupancy?: number;
  label?: string;
  menuItemIds?: string[];
  disabledItemIds?: string[];
}

export interface OrderItem {
  id?: string;
  orderId?: string;
  menuItemId: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
  slotId?: string;
  name?: string;
  image?: string | null;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  slotId?: string;
  slotName?: string;
  notes?: string;
  orderNumber?: string;
  customerName?: string;
  department?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  totalAmount?: number;
  paymentMethod?: string;
}

export interface Customer {
  id: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  walletBalance: number;
  createdAt: string;
  empId?: string;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: "credit" | "debit";
  reason: string;
  description?: string;
  reference?: string;
  orderId?: string | null;
  balance?: number;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  expiresAt?: string;
  priority?: "low" | "medium" | "high";
  active?: boolean;
  date?: string;
  fromTime?: string;
  toTime?: string;
  specialDish?: string;
}

export const ALL_DAYS: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface StoreState {
  menuItems: MenuItem[];
  customCategories: string[];
  slots: Slot[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  announcements: Announcement[];
  walletTransactions: WalletTransaction[];
  cart: { items: OrderItem[] };
  currentCustomerId: string | null;
}

const STORAGE_KEY = "canteen-store-v2";
const RESET_SLOTS_FLAG_KEY = "canteen-slots-reset-v1";

const defaultState = (): StoreState => {
  const now = new Date().toISOString();
  return {
    menuItems: [
    ],
    customCategories: [],
    // Start with empty slots so admin can create custom slots
    slots: [],
    customers: [],
    orders: [],
    orderItems: [],
    announcements: [],
    walletTransactions: [],
    cart: { items: [] },
    currentCustomerId: null,
  };
};

function normalizeState(input: Partial<StoreState> | null | undefined): StoreState {
  const base = defaultState();
  const raw = input ?? {};
  const normalizedCartItems = raw.cart?.items
    ?.map((item) => ({
      ...item,
      quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(1, Number(item.quantity)) : 1,
      price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
    }))
    .filter((item) => item.menuItemId) ?? [];
  return {
    menuItems: Array.isArray(raw.menuItems) ? raw.menuItems : base.menuItems,
    customCategories: Array.isArray(raw.customCategories) ? raw.customCategories : [],
    slots: Array.isArray(raw.slots) ? raw.slots : [],
    customers: Array.isArray(raw.customers) ? raw.customers : base.customers,
    orders: Array.isArray(raw.orders) ? raw.orders : [],
    orderItems: Array.isArray(raw.orderItems) ? raw.orderItems : [],
    announcements: Array.isArray(raw.announcements) ? raw.announcements : [],
    walletTransactions: Array.isArray(raw.walletTransactions) ? raw.walletTransactions : [],
    cart: { items: normalizedCartItems },
    currentCustomerId: raw.currentCustomerId ?? base.currentCustomerId,
  };
}

function loadInitialState(): StoreState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const hasReset = window.localStorage.getItem(RESET_SLOTS_FLAG_KEY) === "1";
    if (!raw) {
      const fresh = defaultState();
      window.localStorage.setItem(RESET_SLOTS_FLAG_KEY, "1");
      return fresh;
    }
    const parsed = normalizeState(JSON.parse(raw));
    if (!hasReset) {
      parsed.slots = [];
      window.localStorage.setItem(RESET_SLOTS_FLAG_KEY, "1");
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

let storeState: StoreState = loadInitialState();
const subscribers = new Set<() => void>();

const persistState = () => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storeState));
};

const notifySubscribers = () => {
  persistState();
  subscribers.forEach((callback) => callback());
};

let storageListenerBound = false;
function ensureStorageSync() {
  if (storageListenerBound || typeof window === "undefined") return;
  storageListenerBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      storeState = normalizeState(JSON.parse(event.newValue));
      subscribers.forEach((callback) => callback());
    } catch {
      // ignore malformed storage event payload
    }
  });
}

export const useStore = <T = StoreState>(selector?: (state: StoreState) => T): T | StoreState => {
  const [, setTick] = useState(0);
  useEffect(() => {
    ensureStorageSync();
    const callback = () => setTick((n) => n + 1);
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  }, []);
  return selector ? selector(storeState) : storeState;
};

export const useCart = () => {
  const value = useStore((state) => state.cart) as { items: OrderItem[] };
  return value;
};

const ENTITY_KEY_MAP: Record<string, keyof StoreState> = {
  menuItem: "menuItems",
  menuItems: "menuItems",
  slot: "slots",
  slots: "slots",
  customer: "customers",
  customers: "customers",
  order: "orders",
  orders: "orders",
  orderItem: "orderItems",
  orderItems: "orderItems",
  announcement: "announcements",
  announcements: "announcements",
  walletTransaction: "walletTransactions",
  walletTransactions: "walletTransactions",
};

function resolveEntityKey(type: string): keyof StoreState {
  return ENTITY_KEY_MAP[type] ?? (`${type}s` as keyof StoreState);
}

export const useEntities = <T,>(type: string): T[] => {
  const key = resolveEntityKey(type);
  const list = useStore((state) => (state[key] as T[]) ?? []) as T[];
  return list;
};

export const useCurrentCustomer = (): Customer | null => {
  const { currentCustomerId, customers } = useStore((state) => ({
    currentCustomerId: state.currentCustomerId,
    customers: state.customers,
  })) as { currentCustomerId: string | null; customers: Customer[] };
  return currentCustomerId ? customers.find((entry) => entry.id === currentCustomerId) ?? null : null;
};

function ensureOrderDefaults(order: Order): Order {
  const total = Number(order.total ?? order.totalAmount ?? 0);
  const normalizedOrderNumber = order.orderNumber ?? `ORD-${Date.now().toString().slice(-5)}`;
  return {
    ...order,
    orderNumber: normalizedOrderNumber,
    total,
    totalAmount: total,
    createdAt: order.createdAt ?? new Date().toISOString(),
    updatedAt: order.updatedAt ?? new Date().toISOString(),
    items: Array.isArray(order.items) ? order.items : [],
  };
}

function createEntityInternal<T extends object>(type: string, entity: Partial<T> & { id?: string }): T {
  const key = resolveEntityKey(type);
  const created = {
    id: entity.id ?? `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: (entity as any).createdAt ?? new Date().toISOString(),
    updatedAt: (entity as any).updatedAt ?? new Date().toISOString(),
    ...entity,
  } as T;

  const normalized = key === "orders" ? (ensureOrderDefaults(created as unknown as Order) as unknown as T) : created;
  const items = (storeState[key] as T[]) ?? [];
  storeState = { ...storeState, [key]: [...items, normalized] };
  notifySubscribers();
  return normalized;
}

function updateEntityInternal<T extends object>(type: string, id: string, updates: Partial<T>): T | null {
  const key = resolveEntityKey(type);
  const items = (storeState[key] as T[]) ?? [];
  let updatedEntity: T | null = null;

  const updatedItems = items.map((item: any) => {
    if (item.id !== id) return item;
    updatedEntity = { ...item, ...updates, updatedAt: new Date().toISOString() } as T;
    if (key === "orders") {
      updatedEntity = ensureOrderDefaults(updatedEntity as unknown as Order) as unknown as T;
    }
    return updatedEntity;
  });

  storeState = { ...storeState, [key]: updatedItems };
  notifySubscribers();
  return updatedEntity;
}

function deleteEntityInternal(type: string, id: string) {
  const key = resolveEntityKey(type);
  const items = (storeState[key] as any[]) ?? [];
  storeState = { ...storeState, [key]: items.filter((item) => item.id !== id) };
  notifySubscribers();
}

export const formatINR = (amount: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount || 0);

/**
 * Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (e.g., "13:00", "09:30")
 * @returns Time in 12-hour format (e.g., "1:00 PM", "9:30 AM")
 */
export const formatTime12Hour = (time24: string): string => {
  if (!time24) return "";
  const [hoursStr, minutesStr] = time24.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || "00";

  if (isNaN(hours)) return time24;

  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Convert 0 to 12 for midnight, and 13-23 to 1-11

  return `${hours}:${minutes} ${period}`;
};

/**
 * Format a time range with AM/PM
 * @param startTime - Start time in 24-hour format
 * @param endTime - End time in 24-hour format
 * @returns Formatted time range (e.g., "9:00 AM - 11:00 AM")
 */
export const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
};

export const downloadCSV = (data: any[], filename: string): void => {
  if (!Array.isArray(data) || data.length === 0 || typeof window === "undefined") return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const asText = value == null ? "" : String(value);
          return asText.includes(",") ? `"${asText}"` : asText;
        })
        .join(","),
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

export const createMenuItem = (menuItem: Partial<MenuItem>) =>
  createEntityInternal<MenuItem>("menuItem", {
    available: true,
    live: true,
    days: [...ALL_DAYS],
    ...menuItem,
  });

export const updateMenuItem = (id: string, updates: Partial<MenuItem>) => updateEntityInternal<MenuItem>("menuItem", id, updates);
export const deleteMenuItem = (id: string) => deleteEntityInternal("menuItem", id);

export const createAnnouncement = (announcement: Partial<Announcement>) => createEntityInternal<Announcement>("announcement", announcement);
export const updateAnnouncement = (id: string, updates: Partial<Announcement>) =>
  updateEntityInternal<Announcement>("announcement", id, updates);
export const deleteAnnouncement = (id: string) => deleteEntityInternal("announcement", id);

export const addToWallet = (customerId: string, amount: number, reason: string = "Add funds") => {
  if (amount <= 0) return false;
  const customer = storeState.customers.find((entry) => entry.id === customerId);
  if (!customer) return false;
  customer.walletBalance += amount;
  createEntityInternal<WalletTransaction>("walletTransaction", {
    customerId,
    amount,
    type: "credit",
    reason,
    createdAt: new Date().toISOString(),
  });
  notifySubscribers();
  return true;
};

export const deductFromWallet = (customerId: string, amount: number, reason: string) => {
  if (amount <= 0) return false;
  const customer = storeState.customers.find((entry) => entry.id === customerId);
  if (!customer || customer.walletBalance < amount) return false;
  customer.walletBalance -= amount;
  createEntityInternal<WalletTransaction>("walletTransaction", {
    customerId,
    amount,
    type: "debit",
    reason,
    createdAt: new Date().toISOString(),
  });
  notifySubscribers();
  return true;
};

export const addToCustomerWallet = (customerId: string, amount: number) => addToWallet(customerId, amount, "Admin credit");
export const updateOrderStatus = (orderId: string, status: OrderStatus) =>
  updateEntityInternal<Order>("order", orderId, { status } as Partial<Order>);

export const createEntity = <T extends object>(type: string, entity: Partial<T> & { id?: string }): T =>
  createEntityInternal<T>(type, entity);
export const updateEntity = <T extends object>(type: string, id: string, updates: Partial<T>): T | null =>
  updateEntityInternal<T>(type, id, updates);
export const deleteEntity = (type: string, id: string) => deleteEntityInternal(type, id);

export const addToCart = (item: OrderItem) => {
  const normalizedQuantity = Number.isFinite(Number(item.quantity)) ? Math.max(1, Number(item.quantity)) : 1;
  const normalizedPrice = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
  const existing = storeState.cart.items.find((entry) => entry.menuItemId === item.menuItemId && entry.slotId === item.slotId);
  if (existing) {
    const currentQty = Number.isFinite(Number(existing.quantity)) ? Number(existing.quantity) : 0;
    existing.quantity = currentQty + normalizedQuantity;
    if (existing.price == null) {
      existing.price = normalizedPrice;
    }
  } else {
    storeState.cart.items = [...storeState.cart.items, { ...item, quantity: normalizedQuantity, price: normalizedPrice }];
  }
  notifySubscribers();
};

export const removeFromCart = (menuItemId: string, slotId?: string) => {
  storeState.cart.items = storeState.cart.items.filter(
    (item) => !(item.menuItemId === menuItemId && item.slotId === slotId),
  );
  notifySubscribers();
};

export const updateCartQuantity = (menuItemId: string, quantity: number, slotId?: string) => {
  storeState.cart.items = storeState.cart.items.map((item) =>
    item.menuItemId === menuItemId && item.slotId === slotId ? { ...item, quantity: Math.max(1, quantity) } : item,
  );
  notifySubscribers();
};

export const useAllCategories = (): string[] => {
  const categories = useStore((state) => {
    const builtIn = ["Veg", "Non-Veg", "Beverages", "Desserts", "Snacks"];
    const fromItems = state.menuItems.map((item) => item.category).filter(Boolean);
    return Array.from(new Set([...builtIn, ...state.customCategories, ...fromItems]));
  }) as string[];
  return categories;
};

export const addCustomCategory = (category: string) => {
  const normalized = category.trim();
  if (!normalized) return;
  if (storeState.customCategories.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) return;
  storeState.customCategories = [...storeState.customCategories, normalized];
  notifySubscribers();
};

