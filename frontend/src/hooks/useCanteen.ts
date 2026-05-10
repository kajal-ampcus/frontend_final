import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import * as mock from '@/api/mockData';
import {
  canteenApi,
  categoryApi,
  menuItemApi,
  type ApiCategory,
  type ApiCanteen,
  type ApiMenuItem,
} from '@/api/menu';

// ─── Types ───────────────────────────────────────

export interface CanteenLocation {
  id: string;
  name: string;
  building: string;
  floor: string;
  is_active: boolean;
  operating_hours_start: string;
  operating_hours_end: string;
  pre_order_cutoff_minutes: number;
  max_orders_per_slot: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  display_order: number;
  icon: string;
  is_active: boolean;
  canteen: string;
}

export interface MenuItem {
  id: string;
  category: string;
  category_name: string;
  canteen: string;
  name: string;
  description: string;
  item_type: 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
  price: number;
  employee_price: number | null;
  effective_price: number;
  company_subsidy_per_item: number;
  is_available: boolean;
  image: string | null;
  calories: number | null;
  preparation_time_minutes: number;
  is_featured: boolean;
  daily_quota: number | null;
}

export interface CanteenBreakSlot {
  id: string;
  canteen: string;
  name: string;
  slot_start: string;
  slot_end: string;
  max_orders: number | null;
  is_active: boolean;
}

export interface CanteenOrderItem {
  id: string;
  menu_item: string;
  item_name: string;
  item_type: string;
  quantity: number;
  unit_price: number;
  unit_subsidy: number;
  special_instructions: string;
  line_total: number;
}

export interface CanteenOrder {
  id: string;
  order_number: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  canteen: string;
  canteen_name: string;
  break_slot: string | null;
  break_slot_name: string | null;
  order_date: string;
  status: 'DRAFT' | 'PLACED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COLLECTED' | 'CANCELLED' | 'REFUNDED';
  payment_mode: string;
  subtotal: number;
  discount_amount: number;
  company_subsidy: number;
  employee_payable: number;
  placed_at: string | null;
  pickup_token: string;
  special_instructions: string;
  items: CanteenOrderItem[];
  created_at: string;
}

export interface CanteenWallet {
  id: string;
  employee: string;
  balance: number;
  last_recharged_at: string | null;
  is_active: boolean;
}

export interface WalletTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference: string;
  notes: string;
  created_at: string;
}

export interface PlaceOrderPayload {
  canteen: string;
  break_slot?: string | null;
  payment_mode?: string;
  special_instructions?: string;
  items: { menu_item: string; quantity: number; special_instructions?: string }[];
}

// ─── New domain types ─────────────────────────────────────────────────────────

export interface OrderingRule {
  id: string;
  canteen: string;
  canteen_name: string;
  min_quantity_per_item: number;
  max_quantity_per_item: number;
  max_orders_per_day: number;
  order_buffer_minutes: number;
  preparation_time_minutes: number;
  cancellation_window_minutes: number;
  require_admin_approval: boolean;
  auto_accept: boolean;
}

export interface GuestMeal {
  id: string;
  canteen: string;
  canteen_name: string;
  guest_name: string;
  guest_organisation: string;
  meal_description: string;
  slot: string | null;
  slot_name: string | null;
  custom_meal_time: string | null;
  meal_date: string;
  guest_count: number;
  estimated_cost: string | null;
  notes: string;
  logged_by: string;
  logged_by_name: string;
  created_at: string;
}

export interface GuestMealPayload {
  canteen: string;
  guest_name: string;
  guest_organisation?: string;
  meal_description: string;
  slot?: string | null;
  custom_meal_time?: string | null;
  meal_date: string;
  guest_count: number;
  estimated_cost?: string | null;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  employee_code: string;
  email: string;
  department: string;
  designation: string;
  is_active: boolean;
  created_at: string;
}

// ─── Hooks ───────────────────────────────────────

function inferLegacyItemType(item: ApiMenuItem): MenuItem['item_type'] {
  if (!item.is_veg) return 'NON_VEG';
  if (item.category_name.toLowerCase().includes('vegan')) return 'VEGAN';
  return 'VEG';
}

function mapApiCanteen(location: ApiCanteen): CanteenLocation {
  return {
    id: location.id,
    name: location.name,
    building: '',
    floor: '',
    is_active: true,
    operating_hours_start: '',
    operating_hours_end: '',
    pre_order_cutoff_minutes: 0,
    max_orders_per_slot: 0,
  };
}

function mapApiCategory(category: ApiCategory, canteenId: string): MenuCategory {
  return {
    id: category.id,
    name: category.name,
    display_order: 0,
    icon: '',
    is_active: category.is_active,
    canteen: canteenId,
  };
}

function mapApiMenuItem(item: ApiMenuItem): MenuItem {
  const price = Number(item.base_price ?? 0);
  return {
    id: item.id,
    category: item.category.id,
    category_name: item.category_name,
    canteen: item.canteen_id,
    name: item.name,
    description: item.description,
    item_type: inferLegacyItemType(item),
    price,
    employee_price: null,
    effective_price: price,
    company_subsidy_per_item: 0,
    is_available: item.is_available,
    image: item.photo_url,
    calories: null,
    preparation_time_minutes: 0,
    is_featured: Boolean(item.display_tag),
    daily_quota: item.max_qty_per_day,
  };
}

function inferBackendMealType(
  legacyType: MenuItem['item_type'],
  categoryId: string,
  categories: ApiCategory[],
): 'BREAKFAST' | 'MEAL' {
  const categoryName = categories.find((category) => category.id === categoryId)?.name?.toLowerCase() ?? '';
  if (categoryName.includes('breakfast')) return 'BREAKFAST';
  return legacyType === 'VEG' && categoryName.includes('morning') ? 'BREAKFAST' : 'MEAL';
}

export function useCanteenLocations() {
  return useQuery({
    queryKey: ['canteen', 'locations'],
    queryFn: async () => {
      const data = await canteenApi.list();
      return data.results.map(mapApiCanteen) as CanteenLocation[];
    },
  });
}

export function useMenuCategories(canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'categories', canteenId],
    queryFn: async () => {
      if (!canteenId) return [] as MenuCategory[];
      const data = await categoryApi.list(canteenId);
      return data.results.map((category) => mapApiCategory(category, canteenId)) as MenuCategory[];
    },
    enabled: !!canteenId,
  });
}

export function useMenuItems(canteenId?: string, categoryId?: string) {
  return useQuery({
    queryKey: ['canteen', 'items', canteenId, categoryId],
    queryFn: async () => {
      if (!canteenId) return [] as MenuItem[];
      const data = await menuItemApi.list(canteenId, categoryId ? { category_id: categoryId } : undefined);
      return data.results.map(mapApiMenuItem) as MenuItem[];
    },
    enabled: !!canteenId,
  });
}

export interface GuestOrderItem {
  id?: string;
  menu_item?: string | null;
  item_name_snapshot?: string;
  name?: string;
  price: number;
  quantity?: number;
  qty?: number;
  total_price?: number;
  is_custom?: boolean;
}

export interface GuestOrder {
  id: string;
  order_number?: string;
  guest_id?: string;
  guest_name: string;
  guest_email?: string;
  phone: string | null;
  organisation?: string | null;
  status: 'pending' | 'accepted' | 'preparing' | 'prepared' | 'collected' | 'cancelled';
  created_at: string;
  updated_at?: string;
  estimated_time: string | null;
  special_instructions?: string;
  total: number;
  items: GuestOrderItem[];
}

export interface GuestOrderPayload {
  guest_name: string;
  phone?: string;
  organisation?: string;
  estimated_time?: string;
  special_instructions?: string;
  items: Array<{
    menu_item_id?: string | null;
    name?: string;
    price?: number;
    qty: number;
  }>;
}

export interface GuestOrderStats {
  total_guests: number;
  active_orders: number;
  todays_revenue: number;
  average_order: number;
}

const guestOrderQueryKey = ['guest-orders'];

interface ApiGuestOrder {
  id: string;
  order_number?: string;
  guest_name: string;
  guest_email?: string;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  estimated_time: string | null;
  special_instructions?: string;
  total: string | number;
  items: Array<{
    name?: string;
    item_name_snapshot?: string;
    price: string | number;
    qty?: number;
    quantity?: number;
    is_custom?: boolean;
  }>;
}

function mapGuestOrder(order: ApiGuestOrder): GuestOrder {
  return {
    id: order.id,
    order_number: order.order_number,
    guest_name: order.guest_name,
    guest_email: order.guest_email,
    phone: order.phone,
    status: order.status.toLowerCase() as GuestOrder['status'],
    created_at: order.created_at,
    updated_at: order.updated_at,
    estimated_time: order.estimated_time,
    special_instructions: order.special_instructions,
    total: Number(order.total),
    items: order.items.map(item => ({
      name: item.name || item.item_name_snapshot,
      item_name_snapshot: item.item_name_snapshot || item.name,
      price: Number(item.price),
      qty: item.qty ?? item.quantity,
      quantity: item.quantity ?? item.qty,
      is_custom: item.is_custom,
    })),
  };
}

export function useGuestOrders(params?: { status?: string; search?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: [...guestOrderQueryKey, params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);
      if (params?.page) query.append('page', String(params.page));
      if (params?.page_size) query.append('page_size', String(params.page_size));
      const { data } = await api.get<{ results?: ApiGuestOrder[] } | ApiGuestOrder[]>(`/guest-orders/?${query.toString()}`);
      const orders = Array.isArray(data) ? data : (data.results ?? []);
      return orders.map(mapGuestOrder);
    },
  });
}

export function useGuestOrderStats() {
  return useQuery({
    queryKey: ['guest-order-stats'],
    queryFn: async () => {
      const { data } = await api.get('/guest-orders/stats/');
      return data as GuestOrderStats;
    },
    staleTime: 30000,
  });
}

export function useGuestOrder(id?: string) {
  return useQuery({
    queryKey: ['guest-orders', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get(`/guest-orders/${id}/`);
      return data as GuestOrder;
    },
  });
}

export function useCreateGuestOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GuestOrderPayload): Promise<GuestOrder> => {
      const { data } = await api.post('/guest-orders/', payload);
      return data as GuestOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: guestOrderQueryKey });
      qc.invalidateQueries({ queryKey: ['guest-order-stats'] });
    },
  });
}

export function useUpdateGuestOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }): Promise<GuestOrder> => {
      const { data } = await api.patch(`/guest-orders/${id}/status/`, { status });
      return data as GuestOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: guestOrderQueryKey });
      qc.invalidateQueries({ queryKey: ['guest-order-stats'] });
    },
  });
}

export function useDeleteGuestOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/guest-orders/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: guestOrderQueryKey });
      qc.invalidateQueries({ queryKey: ['guest-order-stats'] });
    },
  });
}

export interface AvailableMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  slot: string;
  tag: string | null;
  live: boolean;
  days: string[];
}

export function useMenuAvailable(params?: { slot?: string; category?: string; search?: string; day?: string }) {
  return useQuery({
    queryKey: ['menu', 'available', params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (params?.slot) query.append('slot', params.slot);
      if (params?.category) query.append('category', params.category);
      if (params?.search) query.append('search', params.search);
      if (params?.day) query.append('day', params.day);
      const { data } = await api.get<{ results?: AvailableMenuItem[] } | AvailableMenuItem[]>(`/menu/available/?${query.toString()}`);
      return (Array.isArray(data) ? data : (data.results ?? [])) as AvailableMenuItem[];
    },
  });
}

export function useMenuSlots() {
  return useQuery({
    queryKey: ['menu', 'slots'],
    queryFn: async () => {
      const { data } = await api.get<{ slots?: string[] }>('/menu/slots/');
      return (data.slots ?? []) as string[];
    },
    staleTime: 60000,
  });
}

export function useBreakSlots(canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'break-slots', canteenId],
    queryFn: async () => mock.MOCK_BREAK_SLOTS as CanteenBreakSlot[],
    enabled: !!canteenId,
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['canteen', 'my-orders'],
    queryFn: async () => mock.MOCK_MY_ORDERS as CanteenOrder[],
  });
}

export function useAllOrders() {
  return useQuery({
    queryKey: ['canteen', 'all-orders'],
    queryFn: async () => mock.MOCK_MY_ORDERS as CanteenOrder[],
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_payload: PlaceOrderPayload): Promise<CanteenOrder> => ({} as CanteenOrder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'my-orders'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'wallet'] });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { orderId: string; reason?: string }): Promise<CanteenOrder> => ({} as CanteenOrder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { orderId: string; status: string }): Promise<CanteenOrder> => ({} as CanteenOrder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen'] });
    },
  });
}

export function useMyWallet() {
  return useQuery({
    queryKey: ['canteen', 'wallet', 'me'],
    queryFn: async () => {
      const response = await api.get<ApiWallet>('/wallet/me/');
      return mapWallet(response.data);
    },
  });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ['canteen', 'wallet', 'transactions'],
    queryFn: async () => {
      const response = await api.get<ApiWalletTransaction[]>('/wallet/transactions/');
      return response.data.map(mapWalletTransaction);
    },
  });
}

export function useRechargeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      amount: number;
      method: 'UPI' | 'SALARY';
      upi_ref?: string;
    }): Promise<CanteenWallet> => {
      const response = await api.post<ApiWallet>('/wallet/recharge/', params);
      return mapWallet(response.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'wallet'] });
    },
  });
}

export function useKitchenDashboard(canteenId?: string) {
  void canteenId;
  return useQuery({
    queryKey: ['canteen', 'kitchen', canteenId],
    queryFn: async () =>
      mock.MOCK_KITCHEN_DASHBOARD as unknown as Record<string, { label: string; count: number; orders: CanteenOrder[] }>,
    refetchInterval: 15000,
  });
}

// ─── Admin: Menu Management ────────────────────

export interface MenuItemPayload {
  canteen: string;
  category: string;
  name: string;
  description?: string;
  item_type: 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
  price: number;
  employee_price?: number | null;
  company_subsidy_per_item?: number;
  is_available?: boolean;
  calories?: number | null;
  preparation_time_minutes?: number;
  is_featured?: boolean;
  daily_quota?: number | null;
}

export interface MenuCategoryPayload {
  canteen: string;
  name: string;
  display_order?: number;
  icon?: string;
  is_active?: boolean;
}

export function useAllMenuItems(canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'admin-items', canteenId],
    queryFn: async () => {
      if (!canteenId) return [] as MenuItem[];
      const data = await menuItemApi.list(canteenId);
      return data.results.map(mapApiMenuItem) as MenuItem[];
    },
    enabled: !!canteenId,
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MenuItemPayload): Promise<MenuItem> => {
      const categoryData = await categoryApi.list(payload.canteen);
      const created = await menuItemApi.create(payload.canteen, {
        name: payload.name,
        description: payload.description ?? '',
        base_price: payload.price,
        max_qty_per_day: payload.daily_quota ?? 1,
        category_id: payload.category,
        item_type: inferBackendMealType(payload.item_type, payload.category, categoryData.results),
        is_available: payload.is_available ?? true,
        display_tag: payload.is_featured ? 'FEATURED' : undefined,
      });
      return mapApiMenuItem(created);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'items'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'admin-items'] });
    },
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Partial<MenuItemPayload> & { id: string }): Promise<MenuItem> => {
      if (!params.canteen) throw new Error('Canteen is required.');

      let categoryList: ApiCategory[] = [];
      if (params.category || params.item_type) {
        const categoryData = await categoryApi.list(params.canteen);
        categoryList = categoryData.results;
      }

      const updated = await menuItemApi.update(params.canteen, params.id, {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.description !== undefined && { description: params.description }),
        ...(params.price !== undefined && { base_price: params.price }),
        ...(params.daily_quota !== undefined && { max_qty_per_day: params.daily_quota ?? undefined }),
        ...(params.category !== undefined && { category_id: params.category }),
        ...((params.item_type !== undefined || params.category !== undefined) && {
          item_type: inferBackendMealType(
            params.item_type ?? 'VEG',
            params.category ?? '',
            categoryList,
          ),
        }),
        ...(params.is_available !== undefined && { is_available: params.is_available }),
        ...(params.is_featured !== undefined && { display_tag: params.is_featured ? 'FEATURED' : '' }),
      });

      return mapApiMenuItem(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'items'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'admin-items'] });
    },
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, canteenId }: { id: string; canteenId: string }): Promise<void> => {
      await menuItemApi.remove(canteenId, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'items'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'admin-items'] });
    },
  });
}

export function useCreateMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MenuCategoryPayload): Promise<MenuCategory> => {
      const created = await categoryApi.create(payload.canteen, { name: payload.name });
      return mapApiCategory(created, payload.canteen);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'categories'] });
    },
  });
}

export function useDeleteMenuCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, canteenId }: { id: string; canteenId: string }): Promise<void> => {
      await categoryApi.remove(canteenId, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'categories'] });
    },
  });
}

// ════════════════════════════════════════════════════════════════
//  CMS PRODUCTION TYPES
// ════════════════════════════════════════════════════════════════

export type CmsOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'PREPARED'
  | 'COLLECTED'
  | 'CANCELLED';

export interface SlotType {
  id: string;
  name: string;
  category: 'MEAL' | 'TEA_BREAK' | 'SNACK';
  default_order_deadline_mins: number;
  default_cancel_window_mins: number;
  is_active: boolean;
}

export interface TimeSlot {
  id: string;
  canteen: string;
  canteen_name: string;
  slot_type: string;
  slot_type_name: string;
  slot_type_category: string;
  name: string;
  start_time: string;
  end_time: string;
  ordering_opens_at: string | null;
  ordering_deadline_time: string;
  cancellation_deadline_time: string;
  max_orders: number | null;
  applicable_days: number[];
  display_color: string;
  is_active: boolean;
  is_ordering_open: boolean;
  current_order_count?: number;
}

export interface CmsOrderItem {
  id: string;
  menu_item: string;
  item_name_snapshot: string;
  unit_price: string;
  base_price_snapshot: string;
  pricing_rule: string | null;
  quantity: number;
  line_total: string;
}

export interface CmsOrder {
  id: string;
  order_code: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  canteen: string;
  canteen_name: string;
  slot: string;
  slot_name: string;
  slot_start: string;
  slot_end: string;
  order_date: string;
  status: CmsOrderStatus;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  deduction_amount: string;
  placed_at: string | null;
  accepted_at: string | null;
  prepared_at: string | null;
  collected_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  billing_period: string;
  is_billed: boolean;
  can_cancel: boolean;
  order_items: CmsOrderItem[];
  created_at: string;
}

export interface SlotMenuItem extends MenuItem {
  applied_rule: string | null;
}

export interface BillingSummary {
  id: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  department: string;
  billing_month: string;
  total_orders: number;
  total_amount: string;
  total_reversals: string;
  net_deduction: string;
  status: 'DRAFT' | 'FINALISED' | 'PROCESSED';
  finalised_at: string | null;
  processed_at: string | null;
}

export interface CmsPlaceOrderPayload {
  canteen_id?: string;
  slot_id: string;
  payment_mode?: 'WALLET' | 'SALARY' | 'CASH';
  items: { menu_item_id: string; quantity: number }[];
}

type ApiCmsOrderItem = {
  id: string;
  menu_item: string;
  item_name_snapshot: string;
  unit_price: string;
  base_price_snapshot: string;
  pricing_rule: string;
  quantity: number;
  line_total: string;
};

type ApiCmsOrder = {
  id: string;
  order_code: string;
  employee: string;
  employee_name: string;
  employee_code: string;
  department?: string;
  canteen: string;
  canteen_name: string;
  slot_id: string;
  slot_name: string;
  slot_start: string | null;
  slot_end: string | null;
  order_date: string;
  status: CmsOrderStatus;
  payment_mode: 'WALLET' | 'SALARY' | 'CASH';
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  deduction_amount: string;
  placed_at: string | null;
  accepted_at: string | null;
  prepared_at: string | null;
  collected_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  billing_period: string;
  is_billed: boolean;
  can_cancel: boolean;
  order_items: ApiCmsOrderItem[];
  created_at: string;
};

type ApiWallet = {
  id: string;
  employee: string;
  balance: string | number;
  last_recharged_at: string | null;
  is_active: boolean;
};

type ApiWalletTransaction = {
  id: string;
  transaction_type: string;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  reference: string;
  notes: string;
  created_at: string;
};

function mapCmsOrder(order: ApiCmsOrder): CmsOrder {
  return {
    id: order.id,
    order_code: order.order_code,
    employee: order.employee,
    employee_name: order.employee_name,
    employee_code: order.employee_code,
    canteen: order.canteen,
    canteen_name: order.canteen_name,
    slot: order.slot_id,
    slot_name: order.slot_name,
    slot_start: order.slot_start ?? '',
    slot_end: order.slot_end ?? '',
    order_date: order.order_date,
    status: order.status,
    subtotal: order.subtotal,
    tax_amount: order.tax_amount,
    total_amount: order.total_amount,
    deduction_amount: order.deduction_amount,
    placed_at: order.placed_at,
    accepted_at: order.accepted_at,
    prepared_at: order.prepared_at,
    collected_at: order.collected_at,
    cancelled_at: order.cancelled_at,
    cancellation_reason: order.cancellation_reason,
    billing_period: order.billing_period,
    is_billed: order.is_billed,
    can_cancel: order.can_cancel,
    order_items: order.order_items.map((item) => ({
      id: item.id,
      menu_item: item.menu_item,
      item_name_snapshot: item.item_name_snapshot,
      unit_price: item.unit_price,
      base_price_snapshot: item.base_price_snapshot,
      pricing_rule: item.pricing_rule || null,
      quantity: item.quantity,
      line_total: item.line_total,
    })),
    created_at: order.created_at,
  };
}

function mapWallet(wallet: ApiWallet): CanteenWallet {
  return {
    id: wallet.id,
    employee: wallet.employee,
    balance: Number(wallet.balance),
    last_recharged_at: wallet.last_recharged_at,
    is_active: wallet.is_active,
  };
}

function mapWalletTransaction(tx: ApiWalletTransaction): WalletTransaction {
  return {
    id: tx.id,
    transaction_type: tx.transaction_type,
    amount: Number(tx.amount),
    balance_before: Number(tx.balance_before),
    balance_after: Number(tx.balance_after),
    reference: tx.reference,
    notes: tx.notes,
    created_at: tx.created_at,
  };
}

// ════════════════════════════════════════════════════════════════
//  CMS PRODUCTION HOOKS
// ════════════════════════════════════════════════════════════════

// ── ESS ──────────────────────────────────────────────────────────

export function useEssDashboard() {
  return useQuery({
    queryKey: ['canteen', 'ess', 'dashboard'],
    queryFn: async () => mock.MOCK_ESS_DASHBOARD,
  });
}

export function useAvailableSlots(canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'ess', 'slots', canteenId],
    queryFn: async () => {
      const response = await api.get<TimeSlot[]>('/slots/', {
        params: canteenId ? { canteen_id: canteenId } : undefined,
      });
      return response.data;
    },
  });
}

export function useSlotMenu(slotId: string | null, canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'ess', 'slot-menu', canteenId, slotId],
    queryFn: async () => {
      if (!slotId) return [] as SlotMenuItem[];
      const response = await api.get<ApiMenuItem[]>('/slots/menu/', {
        params: {
          slot_id: slotId,
          ...(canteenId ? { canteen_id: canteenId } : {}),
        },
      });
      return response.data.map((item) => ({
        ...mapApiMenuItem(item),
        applied_rule: null as string | null,
      })) as SlotMenuItem[];
    },
    enabled: !!slotId,
  });
}

export function useCmsPlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CmsPlaceOrderPayload): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>('/orders/', payload);
      return mapCmsOrder(response.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'ess'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'kitchen'] });
    },
  });
}

export function useCmsCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { orderId: string; reason?: string }): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${params.orderId}/cancel/`, {
        reason: params.reason ?? '',
      });
      return mapCmsOrder(response.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canteen', 'ess'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['canteen', 'kitchen'] });
    },
  });
}

export function useCmsOrderHistory(params?: {
  date_from?: string;
  date_to?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['canteen', 'ess', 'history', params],
    queryFn: async () => {
      const response = await api.get<ApiCmsOrder[]>('/orders/', {
        params: {
          ...(params?.status ? { status: params.status } : {}),
        },
      });
      return response.data.map(mapCmsOrder);
    },
  });
}

// ── Admin ─────────────────────────────────────────────────────────

export function useAdminOrders(params?: {
  canteen?: string;
  slot?: string;
  status?: string;
  date?: string;
  department?: string;
}) {
  return useQuery({
    queryKey: ['canteen', 'admin', 'orders', params],
    queryFn: async () => {
      const response = await api.get<ApiCmsOrder[]>('/orders/', {
        params: {
          ...(params?.canteen ? { canteen_id: params.canteen } : {}),
          ...(params?.slot ? { slot_id: params.slot } : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.date ? { date: params.date } : {}),
        },
      });
      return response.data.map(mapCmsOrder);
    },
    refetchInterval: 5000,
  });
}

export function useAcceptOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${orderId}/accept/`, {});
      return mapCmsOrder(response.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen'] }); },
  });
}

export function useRejectOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${orderId}/reject/`, { reason });
      return mapCmsOrder(response.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen'] }); },
  });
}

export function useBillingReport(billingMonth: string) {
  return useQuery({
    queryKey: ['canteen', 'admin', 'billing', billingMonth],
    queryFn: async () => {
      // Fetch orders for the billing period and aggregate by employee
      const response = await api.get<ApiCmsOrder[]>('/orders/', {
        params: { billing_period: billingMonth },
      });

      // Group orders by employee and calculate totals
      const employeeBillings = new Map<string, BillingSummary>();

      for (const order of response.data) {
        const empKey = order.employee || order.employee_name || 'unknown';
        const existing = employeeBillings.get(empKey);

        const amount = Number(order.total_amount) || 0;

        if (existing) {
          existing.total_orders += 1;
          existing.total_amount = String(Number(existing.total_amount) + amount);
          existing.net_deduction = String(Number(existing.net_deduction) + amount);
        } else {
          employeeBillings.set(empKey, {
            id: empKey,
            employee: order.employee || '',
            employee_name: order.employee_name || '',
            employee_code: order.employee_code || '',
            department: order.department || '',
            billing_month: billingMonth,
            total_orders: 1,
            total_amount: String(amount),
            total_reversals: '0',
            net_deduction: String(amount),
            status: 'DRAFT',
            finalised_at: null,
            processed_at: null,
          });
        }
      }

      return Array.from(employeeBillings.values());
    },
    enabled: !!billingMonth,
  });
}

export function useGenerateBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (billingMonth: string) => {
      // Billing is generated from orders - just refetch
      await qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'billing', billingMonth] });
    },
    onSuccess: (_, billingMonth) => {
      qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'billing', billingMonth] });
    },
  });
}

export function useLockBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (billingMonth: string) => {
      // Mark orders as billed for the period
      await api.post('/orders/lock-billing/', { billing_period: billingMonth });
    },
    onSuccess: (_, billingMonth) => {
      qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'billing', billingMonth] });
    },
  });
}

// ── Kitchen ────────────────────────────────────────────────────────

export interface KitchenBoard {
  accepted: CmsOrder[];
  preparing: CmsOrder[];
  prepared: CmsOrder[];
  timestamp: string;
}

export function useKitchenBoard(canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'kitchen', 'board', canteenId],
    queryFn: async () => {
      const response = await api.get<{
        accepted: ApiCmsOrder[];
        preparing: ApiCmsOrder[];
        prepared: ApiCmsOrder[];
        timestamp: string;
      }>('/orders/kitchen-board/', {
        params: canteenId ? { canteen_id: canteenId } : undefined,
      });
      return {
        accepted: response.data.accepted.map(mapCmsOrder),
        preparing: response.data.preparing.map(mapCmsOrder),
        prepared: response.data.prepared.map(mapCmsOrder),
        timestamp: response.data.timestamp,
      } as KitchenBoard;
    },
    refetchInterval: 4000,
  });
}

export function useMarkPreparing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${orderId}/start-preparing/`, {});
      return mapCmsOrder(response.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'kitchen'] }); },
  });
}

export function useMarkPrepared() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${orderId}/mark-prepared/`, {});
      return mapCmsOrder(response.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'kitchen'] }); },
  });
}

// ── Counter ────────────────────────────────────────────────────────

export function useVerifyOrderCode() {
  return useMutation({
    mutationFn: async (orderCode: string): Promise<{ valid: boolean; order: CmsOrder }> => {
      const response = await api.post<{ valid: boolean; order: ApiCmsOrder }>('/orders/verify/', { order_code: orderCode });
      return { valid: response.data.valid, order: mapCmsOrder(response.data.order) };
    },
  });
}

export function useCollectOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string; orderCode?: string }): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${orderId}/collect/`, {});
      return mapCmsOrder(response.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen'] }); },
  });
}

export function useAcceptOrderByCounter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<CmsOrder> => {
      const response = await api.post<ApiCmsOrder>(`/orders/${orderId}/accept/`, {});
      return mapCmsOrder(response.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen'] }); },
  });
}

// ════════════════════════════════════════════════════════════════
//  ADMIN MASTERS HOOKS
// ════════════════════════════════════════════════════════════════

// ── Canteen Locations (CMS) ──────────────────────────────────────

export interface CmsLocation {
  id: string;
  name: string;
  address: string;
  capacity: number | null;
  operating_hours_start: string;
  operating_hours_end: string;
  is_active: boolean;
  contact_person: string;
  contact_mobile: string;
}

export function useCmsLocations() {
  return useQuery({
    queryKey: ['canteen', 'admin', 'locations'],
    queryFn: async () => {
      const data = await canteenApi.list();
      return data.results.map((loc): CmsLocation => ({
        id: loc.id,
        name: loc.name,
        address: '',
        capacity: null,
        operating_hours_start: '',
        operating_hours_end: '',
        is_active: true,
        contact_person: '',
        contact_mobile: '',
      }));
    },
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_data: Partial<CmsLocation>): Promise<CmsLocation> => ({} as CmsLocation),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'locations'] }); },
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: Partial<CmsLocation> & { id: string }): Promise<CmsLocation> => ({} as CmsLocation),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'locations'] }); },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_id: string): Promise<void> => {},
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'locations'] }); },
  });
}

// ── Slot Types ──────────────────────────────────────────────────
// Note: Slot types are hardcoded in the backend (BREAKFAST, MEAL, SNACK)
// There's no API for managing slot types - they are fixed choices

const STATIC_SLOT_TYPES: SlotType[] = [
  { id: 'BREAKFAST', name: 'Breakfast', category: 'MEAL', default_order_deadline_mins: 30, default_cancel_window_mins: 15, is_active: true },
  { id: 'MEAL', name: 'Meal', category: 'MEAL', default_order_deadline_mins: 30, default_cancel_window_mins: 15, is_active: true },
  { id: 'SNACK', name: 'Snack', category: 'SNACK', default_order_deadline_mins: 15, default_cancel_window_mins: 10, is_active: true },
];

export function useSlotTypes() {
  return useQuery({
    queryKey: ['canteen', 'admin', 'slot-types'],
    queryFn: async () => STATIC_SLOT_TYPES,
  });
}

export function useCreateSlotType() {
  return useMutation({
    mutationFn: async (_data: Partial<SlotType>): Promise<SlotType> => {
      throw new Error('Slot types are fixed and cannot be created. Use BREAKFAST, MEAL, or SNACK.');
    },
  });
}

export function useUpdateSlotType() {
  return useMutation({
    mutationFn: async (_params: Partial<SlotType> & { id: string }): Promise<SlotType> => {
      throw new Error('Slot types are fixed and cannot be modified.');
    },
  });
}

export function useDeleteSlotType() {
  return useMutation({
    mutationFn: async (_id: string): Promise<void> => {
      throw new Error('Slot types are fixed and cannot be deleted.');
    },
  });
}

// ── Time Slots ──────────────────────────────────────────────────

export function useAdminTimeSlots(canteenId?: string) {
  return useQuery({
    queryKey: ['canteen', 'admin', 'time-slots', canteenId],
    queryFn: async () => {
      const response = await api.get<TimeSlot[]>('/slots/', {
        params: {
          ...(canteenId ? { canteen_id: canteenId } : {}),
          include_inactive: true,
        },
      });
      return response.data;
    },
  });
}

export function useCreateTimeSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TimeSlot> & { canteen: string; slot_type: string }): Promise<TimeSlot> => {
      const response = await api.post<TimeSlot>('/slots/', {
        canteen_id: data.canteen,
        name: data.name,
        slot_type: data.slot_type,
        start_time: data.start_time,
        end_time: data.end_time,
        ordering_opens_at: data.ordering_opens_at,
        ordering_deadline_time: data.ordering_deadline_time,
        cancellation_deadline_time: data.cancellation_deadline_time,
        max_orders: data.max_orders,
        applicable_days: data.applicable_days,
        display_color: data.display_color,
        is_active: data.is_active,
      });
      return response.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'time-slots'] }); qc.invalidateQueries({ queryKey: ['canteen', 'ess', 'slots'] }); },
  });
}

export function useUpdateTimeSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Partial<TimeSlot> & { id: string }): Promise<TimeSlot> => {
      const response = await api.patch<TimeSlot>(`/slots/${params.id}/`, {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.slot_type !== undefined ? { slot_type: params.slot_type } : {}),
        ...(params.start_time !== undefined ? { start_time: params.start_time } : {}),
        ...(params.end_time !== undefined ? { end_time: params.end_time } : {}),
        ...(params.ordering_opens_at !== undefined ? { ordering_opens_at: params.ordering_opens_at } : {}),
        ...(params.ordering_deadline_time !== undefined ? { ordering_deadline_time: params.ordering_deadline_time } : {}),
        ...(params.cancellation_deadline_time !== undefined ? { cancellation_deadline_time: params.cancellation_deadline_time } : {}),
        ...(params.max_orders !== undefined ? { max_orders: params.max_orders } : {}),
        ...(params.applicable_days !== undefined ? { applicable_days: params.applicable_days } : {}),
        ...(params.display_color !== undefined ? { display_color: params.display_color } : {}),
        ...(params.is_active !== undefined ? { is_active: params.is_active } : {}),
      });
      return response.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'time-slots'] }); qc.invalidateQueries({ queryKey: ['canteen', 'ess', 'slots'] }); },
  });
}

export function useDeleteTimeSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/slots/${id}/`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'time-slots'] }); qc.invalidateQueries({ queryKey: ['canteen', 'ess', 'slots'] }); },
  });
}

// ════════════════════════════════════════════════════════════════
//  ORDERING RULES
// ════════════════════════════════════════════════════════════════

export function useOrderingRules(canteenId?: string) {
  void canteenId;
  return useQuery({
    queryKey: ['canteen', 'admin', 'ordering-rules', canteenId],
    queryFn: async () => {
      if (canteenId) return mock.MOCK_ORDERING_RULES.filter((r) => r.canteen === canteenId) as OrderingRule[];
      return mock.MOCK_ORDERING_RULES as OrderingRule[];
    },
  });
}

export function useUpdateOrderingRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<OrderingRule> & { id: string }): Promise<OrderingRule> => {
      const idx = mock.MOCK_ORDERING_RULES.findIndex((r) => r.id === payload.id);
      if (idx !== -1) Object.assign(mock.MOCK_ORDERING_RULES[idx], payload);
      return mock.MOCK_ORDERING_RULES[idx] as OrderingRule;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'ordering-rules'] }); },
  });
}

// ════════════════════════════════════════════════════════════════
//  GUEST MEALS
// ════════════════════════════════════════════════════════════════

export function useGuestMeals(params?: { date?: string; canteen?: string }) {
  void params;
  return useQuery({
    queryKey: ['canteen', 'guest-meals', params],
    queryFn: async () => mock.MOCK_GUEST_MEALS_STATE as GuestMeal[],
  });
}

export function useCreateGuestMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GuestMealPayload): Promise<GuestMeal> => {
      const newMeal: GuestMeal = {
        id: `gm-${Date.now()}`,
        canteen_name: mock.MOCK_CMS_LOCATIONS.find((l) => l.id === payload.canteen)?.name ?? 'Canteen',
        guest_organisation: payload.guest_organisation ?? '',
        slot_name: mock.MOCK_TIME_SLOTS.find((s) => s.id === payload.slot)?.name ?? null,
        notes: payload.notes ?? '',
        logged_by: 'current-user',
        logged_by_name: 'Current User',
        created_at: new Date().toISOString(),
        ...payload,
      } as GuestMeal;
      mock.setMockGuestMealsState((current) => [newMeal, ...current] as typeof mock.MOCK_GUEST_MEALS_STATE);
      return newMeal;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'guest-meals'] }); },
  });
}

export function useUpdateGuestMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GuestMeal> & { id: string }): Promise<GuestMeal> => {
      const idx = mock.MOCK_GUEST_MEALS_STATE.findIndex((m) => m.id === payload.id);
      if (idx !== -1) Object.assign(mock.MOCK_GUEST_MEALS_STATE[idx], payload);
      return mock.MOCK_GUEST_MEALS_STATE[idx];
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'guest-meals'] }); },
  });
}

export function useDeleteGuestMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      mock.setMockGuestMealsState((current) => current.filter((m) => m.id !== id));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'guest-meals'] }); },
  });
}

// ════════════════════════════════════════════════════════════════
//  ITEM-SLOT AVAILABILITY
// ════════════════════════════════════════════════════════════════

export function useItemSlotIds(itemId?: string) {
  return useQuery({
    queryKey: ['canteen', 'item-slots', itemId],
    queryFn: async () => {
      if (!itemId) return [] as string[];
      return mock.MOCK_ITEM_SLOT_AVAILABILITY.filter((a) => a.item_id === itemId).map((a) => a.slot_id);
    },
    enabled: !!itemId,
  });
}

export function useAssignItemToSlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, slotIds }: { itemId: string; slotIds: string[] }): Promise<void> => {
      mock.setMockItemSlotAvailability((current) => current.filter((a) => a.item_id !== itemId));
      slotIds.forEach((slotId) => mock.MOCK_ITEM_SLOT_AVAILABILITY.push({ item_id: itemId, slot_id: slotId }));
    },
    onSuccess: (_data, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['canteen', 'item-slots', itemId] });
      qc.invalidateQueries({ queryKey: ['canteen', 'ess', 'slot-menu'] });
    },
  });
}

// ════════════════════════════════════════════════════════════════
//  EMPLOYEES (Super Admin)
// ════════════════════════════════════════════════════════════════

export function useEmployees(params?: { page?: number; search?: string; department?: string }) {
  return useQuery({
    queryKey: ['canteen', 'admin', 'employees', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.search) searchParams.append('search', params.search);
      if (params?.department) searchParams.append('department', params.department);

      const response = await api.get<{ results?: any[]; count?: number } | any[]>(
        `/auth/employees/?${searchParams.toString()}`
      );
      const results = Array.isArray(response.data) ? response.data : (response.data.results || []);
      return results.map((emp: any): Employee => ({
        id: emp.id,
        name: emp.fullName || emp.full_name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        employee_code: emp.employeeId || emp.employee_code,
        email: emp.email,
        department: emp.department || '',
        designation: emp.designation || '',
        is_active: emp.is_active ?? true,
        created_at: emp.createdAt || emp.created_at || '',
      }));
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Employee, 'id' | 'created_at'>): Promise<Employee> => {
      const [firstName, ...lastNameParts] = (payload.name || '').split(' ');
      const lastName = lastNameParts.join(' ') || firstName;

      const response = await api.post<Employee>('/auth/employees/', {
        employee_code: payload.employee_code,
        firstName: firstName,
        lastName: lastName,
        email: payload.email,
        designation: payload.designation,
      });
      return response.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'employees'] }); },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Employee> & { id: string }): Promise<Employee> => {
      const [firstName, ...lastNameParts] = (payload.name || '').split(' ');
      const lastName = lastNameParts.join(' ') || firstName;

      const response = await api.patch<Employee>(`/auth/employees/${payload.id}/`, {
        employee_code: payload.employee_code,
        firstName: firstName,
        lastName: lastName,
        email: payload.email,
        designation: payload.designation,
      });
      return response.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['canteen', 'admin', 'employees'] }); },
  });
}
