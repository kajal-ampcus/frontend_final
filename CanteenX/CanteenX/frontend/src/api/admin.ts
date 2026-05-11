/**
 * Admin API endpoints for dashboard, orders, and reports.
 */

import api from './client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  slotCounts: Array<{ slotId: string; slot: string; orders: number }>;
  statusCounts: {
    pending: number;
    preparing: number;
    ready: number;
    delivered: number;
  };
  activeUsers: number;
  avgProcessingTime: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  price: number;
  totalPrice: number;
  slotId: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  department: string;
  empId: string;
  slotId: string;
  slotName: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  totalAmount: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  results: AdminOrder[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OrdersParams {
  status?: string;
  slot_id?: string;
  date_from?: string;
  date_to?: string;
  range?: 'today' | '7d' | '30d' | 'all';
  search?: string;
  live_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface SalesRow {
  slot: string;
  item: string;
  quantity: number;
  revenue: number;
}

export interface SalesReportResponse {
  results: SalesRow[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalUnits: number;
  totalRevenue: number;
}

export interface SalesReportParams {
  date_from?: string;
  date_to?: string;
  range?: 'today' | '7d' | '30d' | 'all';
  page?: number;
  page_size?: number;
}

export interface CustomerRow {
  id: string;
  name: string;
  empId: string;
  department: string;
  email: string;
  phone: string;
  walletBalance: number;
  orderCount: number;
  meals: number;
  total: number;
  createdAt: string;
}

export interface CustomerReportResponse {
  results: CustomerRow[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRevenue: number;
  lifetimeRevenue: number;
}

export interface CustomerReportParams {
  date_from?: string;
  date_to?: string;
  range?: 'month' | '30d' | 'all';
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CustomerOrdersResponse {
  customer: {
    id: string;
    name: string;
    empId: string;
    department: string;
  };
  results: AdminOrder[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalSpent: number;
  totalMeals: number;
}

export interface WalletFundRequest {
  employee_id?: string;
  emp_id?: string;
  amount: number;
  reason?: string;
}

export interface WalletFundResponse {
  success: boolean;
  employee: {
    id: string;
    name: string;
    empId: string;
  };
  amount: number;
  newBalance: number;
}

export interface EmployeeSearchResponse {
  found: boolean;
  employee: {
    id: string;
    name: string;
    empId: string;
    department: string;
    email: string;
    walletBalance: number;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch dashboard statistics.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/cms/admin/dashboard/');
  return data;
}

/**
 * Fetch admin orders list with filters.
 */
export async function fetchAdminOrders(params?: OrdersParams): Promise<OrdersResponse> {
  const { data } = await api.get<OrdersResponse>('/cms/admin/orders/', { params });
  return data;
}

/**
 * Fetch sales report.
 */
export async function fetchSalesReport(params?: SalesReportParams): Promise<SalesReportResponse> {
  const { data } = await api.get<SalesReportResponse>('/cms/admin/reports/sales/', { params });
  return data;
}

/**
 * Fetch customer report.
 */
export async function fetchCustomerReport(params?: CustomerReportParams): Promise<CustomerReportResponse> {
  const { data } = await api.get<CustomerReportResponse>('/cms/admin/reports/customers/', { params });
  return data;
}

/**
 * Fetch customer order history.
 */
export async function fetchCustomerOrders(
  customerId: string,
  params?: CustomerReportParams
): Promise<CustomerOrdersResponse> {
  const { data } = await api.get<CustomerOrdersResponse>(
    `/cms/admin/reports/customers/${customerId}/orders/`,
    { params }
  );
  return data;
}

/**
 * Add funds to employee wallet.
 */
export async function addWalletFund(request: WalletFundRequest): Promise<WalletFundResponse> {
  const { data } = await api.post<WalletFundResponse>('/cms/admin/wallet/fund/', request);
  return data;
}

/**
 * Search employee by employee code.
 */
export async function searchEmployee(empId: string): Promise<EmployeeSearchResponse> {
  const { data } = await api.get<EmployeeSearchResponse>('/cms/admin/employees/search/', {
    params: { emp_id: empId }
  });
  return data;
}
