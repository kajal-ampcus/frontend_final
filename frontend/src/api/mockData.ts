/**
 * Mock data for front-end visualisation — no backend required.
 * Every hook in useCanteen.ts reads from these constants.
 */

// ─── Shared constants ────────────────────────────────────────────────────────

export const TODAY = new Date().toISOString().split('T')[0];
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

// Stable IDs used across multiple mock objects
const LOC_1 = 'loc-1';
const LOC_2 = 'loc-2';
const CAT_BFST = 'cat-bfst';
const CAT_LUNCH = 'cat-lunch';
const CAT_SNACK = 'cat-snack';
const CAT_BEV = 'cat-bev';
const ST_MEAL = 'st-meal';
const ST_TEA = 'st-tea';
const ST_SNACK = 'st-snack';
export const TS_BFST = 'ts-bfst';
export const TS_LUNCH = 'ts-lunch';
export const TS_EVE = 'ts-eve';

// ─── Canteen Locations (old API — CanteenLocation) ───────────────────────────

export const MOCK_LOCATIONS = [
  {
    id: LOC_1,
    name: 'Main Cafeteria',
    building: 'Block A',
    floor: 'Ground Floor',
    is_active: true,
    operating_hours_start: '08:00:00',
    operating_hours_end: '20:00:00',
    pre_order_cutoff_minutes: 30,
    max_orders_per_slot: 100,
  },
  {
    id: LOC_2,
    name: 'Executive Dining',
    building: 'Block B',
    floor: '3rd Floor',
    is_active: true,
    operating_hours_start: '09:00:00',
    operating_hours_end: '18:00:00',
    pre_order_cutoff_minutes: 20,
    max_orders_per_slot: 30,
  },
];

// ─── CMS Locations (CmsLocation) ─────────────────────────────────────────────

export const MOCK_CMS_LOCATIONS = [
  {
    id: LOC_1,
    name: 'Main Cafeteria',
    address: 'Block A, Ground Floor',
    capacity: 150,
    operating_hours_start: '08:00',
    operating_hours_end: '20:00',
    is_active: true,
    contact_person: 'Rajan Kumar',
    contact_mobile: '9876543210',
  },
  {
    id: LOC_2,
    name: 'Executive Dining',
    address: 'Block B, 3rd Floor',
    capacity: 30,
    operating_hours_start: '09:00',
    operating_hours_end: '18:00',
    is_active: true,
    contact_person: 'Sunita Verma',
    contact_mobile: '9876500011',
  },
];

// ─── Menu Categories ──────────────────────────────────────────────────────────

export const MOCK_CATEGORIES = [
  { id: CAT_BFST,  name: 'Breakfast', display_order: 1, icon: '🍳', is_active: true, canteen: LOC_1 },
  { id: CAT_LUNCH, name: 'Lunch',     display_order: 2, icon: '🍱', is_active: true, canteen: LOC_1 },
  { id: CAT_SNACK, name: 'Snacks',    display_order: 3, icon: '🥨', is_active: true, canteen: LOC_1 },
  { id: CAT_BEV,   name: 'Beverages', display_order: 4, icon: '☕', is_active: true, canteen: LOC_1 },
];

// ─── Menu Items ───────────────────────────────────────────────────────────────

export const MOCK_ITEMS = [
  {
    id: 'item-1', category: CAT_BFST, category_name: 'Breakfast', canteen: LOC_1,
    name: 'Idli Sambar (2 pcs)', description: 'Soft idlis with sambar & coconut chutney',
    item_type: 'VEG' as const, price: 30, employee_price: 20, effective_price: 20,
    company_subsidy_per_item: 10, is_available: true, image: null,
    calories: 180, preparation_time_minutes: 5, is_featured: true, daily_quota: null,
  },
  {
    id: 'item-2', category: CAT_BFST, category_name: 'Breakfast', canteen: LOC_1,
    name: 'Poha with Sev', description: 'Flattened rice with onions, peas and sev topping',
    item_type: 'VEG' as const, price: 25, employee_price: 15, effective_price: 15,
    company_subsidy_per_item: 10, is_available: true, image: null,
    calories: 160, preparation_time_minutes: 5, is_featured: false, daily_quota: null,
  },
  {
    id: 'item-3', category: CAT_BFST, category_name: 'Breakfast', canteen: LOC_1,
    name: 'Masala Dosa', description: 'Crispy dosa with spiced potato filling',
    item_type: 'VEG' as const, price: 40, employee_price: 25, effective_price: 25,
    company_subsidy_per_item: 15, is_available: true, image: null,
    calories: 220, preparation_time_minutes: 8, is_featured: true, daily_quota: 50,
  },
  {
    id: 'item-4', category: CAT_LUNCH, category_name: 'Lunch', canteen: LOC_1,
    name: 'Dal Rice + Salad', description: 'Yellow dal with steamed rice and fresh salad',
    item_type: 'VEG' as const, price: 55, employee_price: 35, effective_price: 35,
    company_subsidy_per_item: 20, is_available: true, image: null,
    calories: 450, preparation_time_minutes: 5, is_featured: false, daily_quota: null,
  },
  {
    id: 'item-5', category: CAT_LUNCH, category_name: 'Lunch', canteen: LOC_1,
    name: 'Chicken Curry + Rice', description: 'Spicy chicken curry with basmati rice',
    item_type: 'NON_VEG' as const, price: 80, employee_price: 55, effective_price: 55,
    company_subsidy_per_item: 25, is_available: true, image: null,
    calories: 620, preparation_time_minutes: 5, is_featured: true, daily_quota: null,
  },
  {
    id: 'item-6', category: CAT_LUNCH, category_name: 'Lunch', canteen: LOC_1,
    name: 'Paneer Butter Masala', description: 'Creamy paneer in rich tomato gravy with 3 rotis',
    item_type: 'VEG' as const, price: 75, employee_price: 50, effective_price: 50,
    company_subsidy_per_item: 25, is_available: true, image: null,
    calories: 540, preparation_time_minutes: 8, is_featured: true, daily_quota: null,
  },
  {
    id: 'item-7', category: CAT_LUNCH, category_name: 'Lunch', canteen: LOC_1,
    name: 'Veg Biryani', description: 'Aromatic basmati rice with mixed vegetables',
    item_type: 'VEGAN' as const, price: 65, employee_price: 40, effective_price: 40,
    company_subsidy_per_item: 25, is_available: true, image: null,
    calories: 480, preparation_time_minutes: 5, is_featured: false, daily_quota: 80,
  },
  {
    id: 'item-8', category: CAT_LUNCH, category_name: 'Lunch', canteen: LOC_1,
    name: 'Egg Curry + Rice', description: 'Two boiled eggs in spiced curry with rice',
    item_type: 'EGG' as const, price: 60, employee_price: 40, effective_price: 40,
    company_subsidy_per_item: 20, is_available: true, image: null,
    calories: 520, preparation_time_minutes: 5, is_featured: false, daily_quota: null,
  },
  {
    id: 'item-9', category: CAT_SNACK, category_name: 'Snacks', canteen: LOC_1,
    name: 'Samosa (2 pcs)', description: 'Crispy fried pastry with spiced potato filling',
    item_type: 'VEG' as const, price: 20, employee_price: 12, effective_price: 12,
    company_subsidy_per_item: 8, is_available: true, image: null,
    calories: 240, preparation_time_minutes: 3, is_featured: false, daily_quota: null,
  },
  {
    id: 'item-10', category: CAT_SNACK, category_name: 'Snacks', canteen: LOC_1,
    name: 'Bread Pakora', description: 'Spiced potato stuffed bread fritters',
    item_type: 'VEG' as const, price: 25, employee_price: 15, effective_price: 15,
    company_subsidy_per_item: 10, is_available: true, image: null,
    calories: 280, preparation_time_minutes: 5, is_featured: false, daily_quota: null,
  },
  {
    id: 'item-11', category: CAT_BEV, category_name: 'Beverages', canteen: LOC_1,
    name: 'Masala Chai', description: 'Freshly brewed spiced tea with milk',
    item_type: 'VEG' as const, price: 10, employee_price: 5, effective_price: 5,
    company_subsidy_per_item: 5, is_available: true, image: null,
    calories: 80, preparation_time_minutes: 3, is_featured: false, daily_quota: null,
  },
  {
    id: 'item-12', category: CAT_BEV, category_name: 'Beverages', canteen: LOC_1,
    name: 'Filter Coffee', description: 'South Indian filter coffee with fresh milk',
    item_type: 'VEG' as const, price: 15, employee_price: 8, effective_price: 8,
    company_subsidy_per_item: 7, is_available: true, image: null,
    calories: 90, preparation_time_minutes: 3, is_featured: false, daily_quota: null,
  },
];

// ─── Break Slots (old API) ────────────────────────────────────────────────────

export const MOCK_BREAK_SLOTS = [
  { id: 'bs-1', canteen: LOC_1, name: 'Breakfast',     slot_start: '08:30:00', slot_end: '09:00:00', max_orders: null, is_active: true },
  { id: 'bs-2', canteen: LOC_1, name: 'Lunch',         slot_start: '13:00:00', slot_end: '14:00:00', max_orders: null, is_active: true },
  { id: 'bs-3', canteen: LOC_1, name: 'Evening Snack', slot_start: '17:00:00', slot_end: '17:30:00', max_orders: 50,   is_active: true },
];

// ─── Slot Types ───────────────────────────────────────────────────────────────

export const MOCK_SLOT_TYPES = [
  { id: ST_MEAL,  name: 'Meal',       category: 'MEAL'      as const, default_order_deadline_mins: 60, default_cancel_window_mins: 15, is_active: true },
  { id: ST_TEA,   name: 'Tea Break',  category: 'TEA_BREAK' as const, default_order_deadline_mins: 30, default_cancel_window_mins: 10, is_active: true },
  { id: ST_SNACK, name: 'Snack',      category: 'SNACK'     as const, default_order_deadline_mins: 30, default_cancel_window_mins: 10, is_active: true },
];

// ─── Time Slots (CMS) ─────────────────────────────────────────────────────────

export const MOCK_TIME_SLOTS = [
  {
    id: TS_BFST, canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot_type: ST_MEAL, slot_type_name: 'Meal', slot_type_category: 'MEAL',
    name: 'Breakfast', start_time: '08:00:00', end_time: '09:30:00',
    ordering_opens_at: '07:00:00', ordering_deadline_time: '08:00:00',
    cancellation_deadline_time: '07:45:00', max_orders: 100,
    applicable_days: [1, 2, 3, 4, 5], display_color: '#f59e0b',
    is_active: true, is_ordering_open: true, current_order_count: 23,
  },
  {
    id: TS_LUNCH, canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot_type: ST_MEAL, slot_type_name: 'Meal', slot_type_category: 'MEAL',
    name: 'Lunch', start_time: '12:30:00', end_time: '14:00:00',
    ordering_opens_at: '10:00:00', ordering_deadline_time: '12:00:00',
    cancellation_deadline_time: '11:45:00', max_orders: 150,
    applicable_days: [1, 2, 3, 4, 5], display_color: '#3b82f6',
    is_active: true, is_ordering_open: true, current_order_count: 67,
  },
  {
    id: TS_EVE, canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot_type: ST_TEA, slot_type_name: 'Tea Break', slot_type_category: 'TEA_BREAK',
    name: 'Evening Tea', start_time: '16:30:00', end_time: '17:30:00',
    ordering_opens_at: '15:00:00', ordering_deadline_time: '16:00:00',
    cancellation_deadline_time: '15:45:00', max_orders: 50,
    applicable_days: [1, 2, 3, 4, 5], display_color: '#8b5cf6',
    is_active: true, is_ordering_open: false, current_order_count: 12,
  },
];

// ─── Helper: build a CmsOrderItem ────────────────────────────────────────────

function oi(id: string, menuItem: string, name: string, qty: number, price: number) {
  return {
    id, menu_item: menuItem, item_name_snapshot: name,
    unit_price: String(price), base_price_snapshot: String(price),
    pricing_rule: null as string | null,
    quantity: qty, line_total: String(qty * price),
  };
}

// ─── CMS Orders ───────────────────────────────────────────────────────────────

export const MOCK_CMS_ORDERS = [
  {
    id: 'ord-1', order_code: 'CX-2026-0001',
    employee: 'emp-1', employee_name: 'Priya Sharma', employee_code: 'AMP001',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_LUNCH, slot_name: 'Lunch', slot_start: '12:30:00', slot_end: '14:00:00',
    order_date: TODAY, status: 'ACCEPTED' as const,
    subtotal: '60.00', tax_amount: '0.00', total_amount: '60.00', deduction_amount: '60.00',
    placed_at: new Date().toISOString(), accepted_at: new Date().toISOString(),
    prepared_at: null, collected_at: null, cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: false,
    order_items: [oi('oi-1a', 'item-5', 'Chicken Curry + Rice', 1, 55), oi('oi-1b', 'item-11', 'Masala Chai', 1, 5)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-2', order_code: 'CX-2026-0002',
    employee: 'emp-2', employee_name: 'Rahul Patil', employee_code: 'AMP002',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_LUNCH, slot_name: 'Lunch', slot_start: '12:30:00', slot_end: '14:00:00',
    order_date: TODAY, status: 'PREPARING' as const,
    subtotal: '50.00', tax_amount: '0.00', total_amount: '50.00', deduction_amount: '50.00',
    placed_at: new Date().toISOString(), accepted_at: new Date().toISOString(),
    prepared_at: null, collected_at: null, cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: false,
    order_items: [oi('oi-2a', 'item-6', 'Paneer Butter Masala', 1, 50)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-3', order_code: 'CX-2026-0003',
    employee: 'emp-3', employee_name: 'Anita Desai', employee_code: 'AMP003',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_LUNCH, slot_name: 'Lunch', slot_start: '12:30:00', slot_end: '14:00:00',
    order_date: TODAY, status: 'PREPARED' as const,
    subtotal: '40.00', tax_amount: '0.00', total_amount: '40.00', deduction_amount: '40.00',
    placed_at: new Date().toISOString(), accepted_at: new Date().toISOString(),
    prepared_at: new Date().toISOString(), collected_at: null, cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: false,
    order_items: [oi('oi-3a', 'item-7', 'Veg Biryani', 1, 40)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-4', order_code: 'CX-2026-0004',
    employee: 'emp-4', employee_name: 'Suresh Nair', employee_code: 'AMP004',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_LUNCH, slot_name: 'Lunch', slot_start: '12:30:00', slot_end: '14:00:00',
    order_date: TODAY, status: 'COLLECTED' as const,
    subtotal: '35.00', tax_amount: '0.00', total_amount: '35.00', deduction_amount: '35.00',
    placed_at: new Date().toISOString(), accepted_at: new Date().toISOString(),
    prepared_at: new Date().toISOString(), collected_at: new Date().toISOString(), cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: false,
    order_items: [oi('oi-4a', 'item-4', 'Dal Rice + Salad', 1, 35)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-5', order_code: 'CX-2026-0005',
    employee: 'emp-5', employee_name: 'Meera Joshi', employee_code: 'AMP005',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_BFST, slot_name: 'Breakfast', slot_start: '08:00:00', slot_end: '09:30:00',
    order_date: TODAY, status: 'PENDING' as const,
    subtotal: '25.00', tax_amount: '0.00', total_amount: '25.00', deduction_amount: '25.00',
    placed_at: new Date().toISOString(), accepted_at: null,
    prepared_at: null, collected_at: null, cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: true,
    order_items: [oi('oi-5a', 'item-1', 'Idli Sambar (2 pcs)', 1, 20), oi('oi-5b', 'item-11', 'Masala Chai', 1, 5)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-6', order_code: 'CX-2026-0006',
    employee: 'emp-6', employee_name: 'Kiran Reddy', employee_code: 'AMP006',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_LUNCH, slot_name: 'Lunch', slot_start: '12:30:00', slot_end: '14:00:00',
    order_date: TODAY, status: 'PENDING' as const,
    subtotal: '50.00', tax_amount: '0.00', total_amount: '50.00', deduction_amount: '50.00',
    placed_at: new Date().toISOString(), accepted_at: null,
    prepared_at: null, collected_at: null, cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: true,
    order_items: [oi('oi-6a', 'item-6', 'Paneer Butter Masala', 1, 50)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-7', order_code: 'CX-2026-0007',
    employee: 'emp-1', employee_name: 'Priya Sharma', employee_code: 'AMP001',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_BFST, slot_name: 'Breakfast', slot_start: '08:00:00', slot_end: '09:30:00',
    order_date: TODAY, status: 'CANCELLED' as const,
    subtotal: '20.00', tax_amount: '0.00', total_amount: '20.00', deduction_amount: '0.00',
    placed_at: new Date().toISOString(), accepted_at: null,
    prepared_at: null, collected_at: null, cancelled_at: new Date().toISOString(), cancellation_reason: 'Changed my mind',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: false,
    order_items: [oi('oi-7a', 'item-2', 'Poha with Sev', 1, 15), oi('oi-7b', 'item-11', 'Masala Chai', 1, 5)],
    created_at: new Date().toISOString(),
  },
  {
    id: 'ord-8', order_code: 'CX-2026-0008',
    employee: 'emp-7', employee_name: 'Deepak Singh', employee_code: 'AMP007',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    slot: TS_LUNCH, slot_name: 'Lunch', slot_start: '12:30:00', slot_end: '14:00:00',
    order_date: TODAY, status: 'ACCEPTED' as const,
    subtotal: '75.00', tax_amount: '0.00', total_amount: '75.00', deduction_amount: '75.00',
    placed_at: new Date().toISOString(), accepted_at: new Date().toISOString(),
    prepared_at: null, collected_at: null, cancelled_at: null, cancellation_reason: '',
    billing_period: CURRENT_MONTH, is_billed: false, can_cancel: false,
    order_items: [oi('oi-8a', 'item-6', 'Paneer Butter Masala', 1, 50), oi('oi-8b', 'item-12', 'Filter Coffee', 1, 8), oi('oi-8c', 'item-9', 'Samosa (2 pcs)', 1, 12)],
    created_at: new Date().toISOString(),
  },
];

// ─── Kitchen Board ────────────────────────────────────────────────────────────

export const MOCK_KITCHEN_BOARD = {
  accepted: [MOCK_CMS_ORDERS[0], MOCK_CMS_ORDERS[7]],
  preparing: [MOCK_CMS_ORDERS[1]],
  prepared:  [MOCK_CMS_ORDERS[2]],
  timestamp: new Date().toISOString(),
};

// ─── Old-API kitchen dashboard (KitchenView component) ───────────────────────

export const MOCK_KITCHEN_DASHBOARD: Record<string, { label: string; count: number; orders: typeof MOCK_CMS_ORDERS }> = {
  PLACED:    { label: 'New',       count: 2, orders: [MOCK_CMS_ORDERS[4], MOCK_CMS_ORDERS[5]] as typeof MOCK_CMS_ORDERS },
  CONFIRMED: { label: 'Confirmed', count: 2, orders: [MOCK_CMS_ORDERS[0], MOCK_CMS_ORDERS[7]] as typeof MOCK_CMS_ORDERS },
  PREPARING: { label: 'Preparing', count: 1, orders: [MOCK_CMS_ORDERS[1]] as typeof MOCK_CMS_ORDERS },
  READY:     { label: 'Ready',     count: 1, orders: [MOCK_CMS_ORDERS[2]] as typeof MOCK_CMS_ORDERS },
};

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const MOCK_WALLET = {
  id: 'wallet-1',
  employee: 'emp-1',
  balance: 450.00,
  last_recharged_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  is_active: true,
};

// ─── Wallet Transactions ──────────────────────────────────────────────────────

export const MOCK_TRANSACTIONS = [
  {
    id: 'txn-1', transaction_type: 'CREDIT_RECHARGE', amount: 500,
    balance_before: 0, balance_after: 500,
    reference: 'UPI-GPay-2026042401', notes: 'Wallet recharge via Google Pay',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'txn-2', transaction_type: 'DEBIT_ORDER', amount: 90,
    balance_before: 500, balance_after: 410,
    reference: 'CX-2026-PREV-001', notes: 'Lunch — Chicken Curry + Chai',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'txn-3', transaction_type: 'DEBIT_ORDER', amount: 35,
    balance_before: 410, balance_after: 375,
    reference: 'CX-2026-PREV-002', notes: 'Breakfast — Idli Sambar',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'txn-4', transaction_type: 'CREDIT_SUBSIDY', amount: 100,
    balance_before: 375, balance_after: 475,
    reference: 'SUBSIDY-APR-2026', notes: 'Monthly canteen subsidy',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'txn-5', transaction_type: 'DEBIT_ORDER', amount: 25,
    balance_before: 475, balance_after: 450,
    reference: 'CX-2026-0005', notes: 'Breakfast — Poha + Chai',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

// ─── Old-API orders (employee history) ───────────────────────────────────────

export const MOCK_MY_ORDERS = [
  {
    id: 'old-1', order_number: 'ORD-2026-001',
    employee: 'emp-1', employee_name: 'Priya Sharma', employee_code: 'AMP001',
    canteen: LOC_1, canteen_name: 'Main Cafeteria',
    break_slot: 'bs-2', break_slot_name: 'Lunch', order_date: TODAY,
    status: 'COLLECTED' as const, payment_mode: 'WALLET',
    subtotal: 55, discount_amount: 0, company_subsidy: 20, employee_payable: 35,
    placed_at: new Date().toISOString(), pickup_token: 'A12', special_instructions: '',
    items: [{ id: 'oi-old-1', menu_item: 'item-4', item_name: 'Dal Rice + Salad', item_type: 'VEG', quantity: 1, unit_price: 55, unit_subsidy: 20, special_instructions: '', line_total: 55 }],
    created_at: new Date().toISOString(),
  },
];

// ─── ESS Order History (CMS orders) ──────────────────────────────────────────

export const MOCK_ORDER_HISTORY = [
  MOCK_CMS_ORDERS[3],
  MOCK_CMS_ORDERS[6],
  {
    ...MOCK_CMS_ORDERS[0],
    id: 'ord-hist-1', order_code: 'CX-2026-PREV-001',
    order_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    status: 'COLLECTED' as const, total_amount: '60.00',
  },
  {
    ...MOCK_CMS_ORDERS[1],
    id: 'ord-hist-2', order_code: 'CX-2026-PREV-002',
    order_date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    status: 'COLLECTED' as const, total_amount: '50.00',
  },
  {
    ...MOCK_CMS_ORDERS[4],
    id: 'ord-hist-3', order_code: 'CX-2026-PREV-003',
    order_date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
    status: 'COLLECTED' as const, total_amount: '25.00',
  },
];

// ─── ESS Dashboard ────────────────────────────────────────────────────────────

export const MOCK_ESS_DASHBOARD = {
  active_order: MOCK_CMS_ORDERS[4],
  today_slots: MOCK_TIME_SLOTS,
  monthly_spend: '290.00',
  recent_orders: MOCK_ORDER_HISTORY.slice(0, 3),
};

// ─── Slot Menus (keyed by time-slot ID) ──────────────────────────────────────

const withRule = (items: typeof MOCK_ITEMS) =>
  items.map((i) => ({ ...i, applied_rule: null as string | null }));

export const MOCK_SLOT_MENUS: Record<string, ReturnType<typeof withRule>> = {
  [TS_BFST]:  withRule(MOCK_ITEMS.filter((i) => i.category === CAT_BFST || i.category === CAT_BEV)),
  [TS_LUNCH]: withRule(MOCK_ITEMS.filter((i) => i.category === CAT_LUNCH || i.category === CAT_BEV)),
  [TS_EVE]:   withRule(MOCK_ITEMS.filter((i) => i.category === CAT_SNACK || i.category === CAT_BEV)),
};

// ─── Billing Summaries ────────────────────────────────────────────────────────

// ─── Ordering Rules ───────────────────────────────────────────────────────────

export const MOCK_ORDERING_RULES = [
  {
    id: 'rule-1', canteen: LOC_1, canteen_name: 'Main Cafeteria',
    min_quantity_per_item: 1, max_quantity_per_item: 3, max_orders_per_day: 2,
    order_buffer_minutes: 30, preparation_time_minutes: 15,
    cancellation_window_minutes: 20, require_admin_approval: false, auto_accept: true,
  },
  {
    id: 'rule-2', canteen: LOC_2, canteen_name: 'Executive Dining',
    min_quantity_per_item: 1, max_quantity_per_item: 5, max_orders_per_day: 3,
    order_buffer_minutes: 60, preparation_time_minutes: 20,
    cancellation_window_minutes: 30, require_admin_approval: true, auto_accept: false,
  },
];

// ─── Guest Meals ──────────────────────────────────────────────────────────────

const MOCK_GUEST_MEALS_INITIAL = [
  {
    id: 'gm-1', canteen: LOC_1, canteen_name: 'Main Cafeteria',
    guest_name: 'Mr. Ramesh Gupta', guest_organisation: 'Infosys Ltd.',
    meal_description: 'Veg Thali + Gulab Jamun + Masala Chai',
    slot: TS_LUNCH, slot_name: 'Lunch', custom_meal_time: null,
    meal_date: TODAY, guest_count: 2, estimated_cost: '260.00',
    notes: 'Board member visit from Delhi office',
    logged_by: 'kitchen-1', logged_by_name: 'Kitchen Staff',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'gm-2', canteen: LOC_1, canteen_name: 'Main Cafeteria',
    guest_name: 'Ms. Preethi Venkataraman', guest_organisation: 'NASSCOM',
    meal_description: 'Welcome drink + Special Lunch Thali + Dessert',
    slot: null, slot_name: null, custom_meal_time: '14:30:00',
    meal_date: TODAY, guest_count: 5, estimated_cost: '1250.00',
    notes: 'NASSCOM delegation — CTO invited guests',
    logged_by: 'counter-1', logged_by_name: 'Counter Staff',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'gm-3', canteen: LOC_2, canteen_name: 'Executive Dining',
    guest_name: 'Board of Directors', guest_organisation: 'Internal',
    meal_description: 'Executive Lunch: Soup, Salad Bar, Main Course (Veg + Non-Veg), Dessert, Tea/Coffee',
    slot: TS_LUNCH, slot_name: 'Lunch', custom_meal_time: null,
    meal_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    guest_count: 12, estimated_cost: '4800.00',
    notes: 'Quarterly board meeting lunch — H1 review',
    logged_by: 'admin-1', logged_by_name: 'Admin',
    created_at: new Date(Date.now() - 86400000 - 3600000).toISOString(),
  },
];
export let MOCK_GUEST_MEALS_STATE = [...MOCK_GUEST_MEALS_INITIAL];
export function setMockGuestMealsState(
  updater:
    | typeof MOCK_GUEST_MEALS_STATE
    | ((current: typeof MOCK_GUEST_MEALS_STATE) => typeof MOCK_GUEST_MEALS_STATE),
) {
  MOCK_GUEST_MEALS_STATE =
    typeof updater === 'function'
      ? updater(MOCK_GUEST_MEALS_STATE)
      : updater;
}

// ─── Employees (Super Admin) ──────────────────────────────────────────────────

export const MOCK_EMPLOYEES = [
  { id: 'emp-1', name: 'Priya Sharma',    employee_code: 'AMP001', email: 'priya.sharma@ampcus.com',   department: 'Engineering', designation: 'Senior Developer',   is_active: true,  created_at: '2024-01-15T00:00:00Z' },
  { id: 'emp-2', name: 'Rahul Patil',     employee_code: 'AMP002', email: 'rahul.patil@ampcus.com',    department: 'Product',     designation: 'Product Manager',    is_active: true,  created_at: '2024-02-01T00:00:00Z' },
  { id: 'emp-3', name: 'Anita Desai',     employee_code: 'AMP003', email: 'anita.desai@ampcus.com',    department: 'HR',          designation: 'HR Manager',         is_active: true,  created_at: '2024-01-20T00:00:00Z' },
  { id: 'emp-4', name: 'Suresh Nair',     employee_code: 'AMP004', email: 'suresh.nair@ampcus.com',    department: 'Sales',       designation: 'Sales Executive',    is_active: true,  created_at: '2024-03-10T00:00:00Z' },
  { id: 'emp-5', name: 'Meera Joshi',     employee_code: 'AMP005', email: 'meera.joshi@ampcus.com',    department: 'Finance',     designation: 'Finance Analyst',    is_active: true,  created_at: '2024-02-20T00:00:00Z' },
  { id: 'emp-6', name: 'Kiran Reddy',     employee_code: 'AMP006', email: 'kiran.reddy@ampcus.com',    department: 'Design',      designation: 'UX Designer',        is_active: true,  created_at: '2024-04-05T00:00:00Z' },
  { id: 'emp-7', name: 'Deepak Singh',    employee_code: 'AMP007', email: 'deepak.singh@ampcus.com',   department: 'Engineering', designation: 'DevOps Engineer',    is_active: true,  created_at: '2024-03-25T00:00:00Z' },
  { id: 'emp-8', name: 'Neha Kulkarni',   employee_code: 'AMP008', email: 'neha.kulkarni@ampcus.com',  department: 'Marketing',   designation: 'Marketing Manager',  is_active: false, created_at: '2024-01-08T00:00:00Z' },
];
export let MOCK_EMPLOYEES_STATE = [...MOCK_EMPLOYEES];
export function setMockEmployeesState(
  updater:
    | typeof MOCK_EMPLOYEES_STATE
    | ((current: typeof MOCK_EMPLOYEES_STATE) => typeof MOCK_EMPLOYEES_STATE),
) {
  MOCK_EMPLOYEES_STATE =
    typeof updater === 'function'
      ? updater(MOCK_EMPLOYEES_STATE)
      : updater;
}

// ─── Item-Slot Availability (mutable for demo) ────────────────────────────────

export let MOCK_ITEM_SLOT_AVAILABILITY: { item_id: string; slot_id: string }[] = [
  { item_id: 'item-1',  slot_id: TS_BFST  },
  { item_id: 'item-2',  slot_id: TS_BFST  },
  { item_id: 'item-3',  slot_id: TS_BFST  },
  { item_id: 'item-4',  slot_id: TS_LUNCH },
  { item_id: 'item-5',  slot_id: TS_LUNCH },
  { item_id: 'item-6',  slot_id: TS_LUNCH },
  { item_id: 'item-7',  slot_id: TS_LUNCH },
  { item_id: 'item-8',  slot_id: TS_LUNCH },
  { item_id: 'item-9',  slot_id: TS_EVE   },
  { item_id: 'item-10', slot_id: TS_EVE   },
  { item_id: 'item-11', slot_id: TS_BFST  },
  { item_id: 'item-11', slot_id: TS_LUNCH },
  { item_id: 'item-11', slot_id: TS_EVE   },
  { item_id: 'item-12', slot_id: TS_BFST  },
  { item_id: 'item-12', slot_id: TS_LUNCH },
  { item_id: 'item-12', slot_id: TS_EVE   },
];
export function setMockItemSlotAvailability(
  updater:
    | typeof MOCK_ITEM_SLOT_AVAILABILITY
    | ((current: typeof MOCK_ITEM_SLOT_AVAILABILITY) => typeof MOCK_ITEM_SLOT_AVAILABILITY),
) {
  MOCK_ITEM_SLOT_AVAILABILITY =
    typeof updater === 'function'
      ? updater(MOCK_ITEM_SLOT_AVAILABILITY)
      : updater;
}

// ─── Mutable Orders State (live order lifecycle demo) ─────────────────────────

export let MOCK_ORDERS_STATE = [...MOCK_CMS_ORDERS] as typeof MOCK_CMS_ORDERS;
export function setMockOrdersState(
  updater:
    | typeof MOCK_ORDERS_STATE
    | ((current: typeof MOCK_ORDERS_STATE) => typeof MOCK_ORDERS_STATE),
) {
  MOCK_ORDERS_STATE =
    typeof updater === 'function'
      ? updater(MOCK_ORDERS_STATE)
      : updater;
}

// ─── Billing Summaries ────────────────────────────────────────────────────────

export const MOCK_BILLING = [
  {
    id: 'bill-1', employee: 'emp-1', employee_name: 'Priya Sharma', employee_code: 'AMP001',
    department: 'Engineering', billing_month: CURRENT_MONTH,
    total_orders: 18, total_amount: '920.00', total_reversals: '55.00', net_deduction: '865.00',
    status: 'DRAFT' as const, finalised_at: null, processed_at: null,
  },
  {
    id: 'bill-2', employee: 'emp-2', employee_name: 'Rahul Patil', employee_code: 'AMP002',
    department: 'Product', billing_month: CURRENT_MONTH,
    total_orders: 22, total_amount: '1240.00', total_reversals: '0.00', net_deduction: '1240.00',
    status: 'DRAFT' as const, finalised_at: null, processed_at: null,
  },
  {
    id: 'bill-3', employee: 'emp-3', employee_name: 'Anita Desai', employee_code: 'AMP003',
    department: 'HR', billing_month: CURRENT_MONTH,
    total_orders: 15, total_amount: '680.00', total_reversals: '40.00', net_deduction: '640.00',
    status: 'FINALISED' as const,
    finalised_at: new Date(Date.now() - 86400000 * 2).toISOString(), processed_at: null,
  },
  {
    id: 'bill-4', employee: 'emp-4', employee_name: 'Suresh Nair', employee_code: 'AMP004',
    department: 'Sales', billing_month: CURRENT_MONTH,
    total_orders: 20, total_amount: '1100.00', total_reversals: '80.00', net_deduction: '1020.00',
    status: 'PROCESSED' as const,
    finalised_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    processed_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'bill-5', employee: 'emp-5', employee_name: 'Meera Joshi', employee_code: 'AMP005',
    department: 'Finance', billing_month: CURRENT_MONTH,
    total_orders: 12, total_amount: '540.00', total_reversals: '0.00', net_deduction: '540.00',
    status: 'DRAFT' as const, finalised_at: null, processed_at: null,
  },
  {
    id: 'bill-6', employee: 'emp-6', employee_name: 'Kiran Reddy', employee_code: 'AMP006',
    department: 'Design', billing_month: CURRENT_MONTH,
    total_orders: 16, total_amount: '760.00', total_reversals: '20.00', net_deduction: '740.00',
    status: 'DRAFT' as const, finalised_at: null, processed_at: null,
  },
];
