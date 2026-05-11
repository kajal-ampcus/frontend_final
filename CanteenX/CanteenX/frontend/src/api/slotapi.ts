/**
 * src/api/slotapi.ts
 *
 * Slot API integration layer.
 *
 * Bridges the gap between:
 *   - Frontend  : Slot / MenuItem shapes used in admin-slots.tsx (camelCase, legacy fields)
 *   - Backend   : MealSlot / SlotMenuItem shapes from the Django REST API (snake_case, UUID ids)
 *
 * All mapping between the two shapes lives here so the rest of the app stays untouched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Mapping summary
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Backend field           │ Frontend field
 * ─────────────────────────┼────────────────────────────────────────────────
 *  id (UUID string)        │ id
 *  name                    │ name
 *  label                   │ label
 *  date                    │ date
 *  start_time              │ startTime
 *  end_time                │ endTime
 *  capacity                │ capacity
 *  meal_type               │ type
 *  is_active               │ active
 *  occupancy_count         │ currentOccupancy
 *  occupancy_percentage    │ (computed locally in admin-slots.tsx — not stored)
 *  slot_items[].menu_item_id  │ menuItemIds[]
 *  slot_items[].is_enabled=F  │ disabledItemIds[]
 *  —                       │ displayTime  (formatted "HH:MM — HH:MM", built here)
 *  —                       │ status       (derived from label in admin-slots.tsx)
 *  —                       │ defaultCategory  (first selected category, frontend-only)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Removed fields (backend no longer has them)
 * ─────────────────────────────────────────────────────────────────────────────
 *  categories (JSONField)  → removed from backend (FIX 4). SlotPayload no
 *                            longer sends it. admin-slots.tsx still manages
 *                            category filtering locally using MenuItem data.
 */

import { getTokenFromStorage } from '@/lib/authContext';
import type { Slot } from '@/lib/store';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.BACKEND_URL ?? 'http://localhost:8000/api/v1') + '/slots';

// ─────────────────────────────────────────────────────────────────────────────
// Backend response shapes (what the API actually returns)
// ─────────────────────────────────────────────────────────────────────────────

export interface BackendSlotItem {
  menu_item_id: string;   // UUID
  is_enabled: boolean;
  max_qty_per_order: number;
}

export interface BackendSlot {
  id: string;             // UUID
  name: string;
  label: string;
  date: string;           // "YYYY-MM-DD"
  start_time: string;     // "HH:MM:SS"
  end_time: string;       // "HH:MM:SS"
  capacity: number;
  meal_type: string;      // "BREAKFAST" | "MEAL"
  is_active: boolean;
  occupancy_count: number;
  occupancy_percentage: number;
  created_at: string;
  updated_at: string;
  // Only present on detail endpoint (GET /slots/{id}/)
  items?: BackendSlotItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Write payload (what we POST / PUT to the backend)
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotWritePayload {
  name: string;
  label: string;
  date: string;           // "YYYY-MM-DD"
  start_time: string;     // "HH:MM"
  end_time: string;       // "HH:MM"
  capacity: number;
  meal_type: string;      // "BREAKFAST" | "MEAL"
  is_active: boolean;
  menu_item_ids: string[]; // UUID strings — no integers, no categories
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers — backend ↔ frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise "HH:MM:SS" (Django TimeField) to "HH:MM" for display and inputs.
 */
function trimTime(t: string): string {
  return t?.slice(0, 5) ?? '';
}

/**
 * Convert a backend MealSlot response into the frontend Slot shape.
 * Merges slot_items into menuItemIds and disabledItemIds so admin-slots.tsx
 * can drive its UI without knowing about the backend's SlotMenuItem model.
 */
function toFrontendSlot(b: BackendSlot): Slot {
  const start = trimTime(b.start_time);
  const end   = trimTime(b.end_time);

  const allItemIds     = (b.items ?? []).map((i) => i.menu_item_id);
  const disabledItemIds = (b.items ?? [])
    .filter((i) => !i.is_enabled)
    .map((i) => i.menu_item_id);

  // Map backend meal_type ("BREAKFAST" | "MEAL") to the frontend ItemType
  // used in admin-slots.tsx ("Breakfast" | "Meal").
  const typeMap: Record<string, string> = {
    BREAKFAST: 'Breakfast',
    MEAL:      'Meal',
  };

  return {
    id:               b.id,
    name:             b.name,
    label:            b.label,
    date:             b.date,
    startTime:        start,
    endTime:          end,
    displayTime:      `${start} — ${end}`,
    capacity:         b.capacity,
    type:             (typeMap[b.meal_type] ?? b.meal_type) as Slot['type'],
    active:           b.is_active,
    status:           b.label.toLowerCase() as Slot['status'],  // refined by computedSlots in UI
    currentOccupancy: b.occupancy_count ?? 0,
    menuItemIds:      allItemIds,
    disabledItemIds,
    // defaultCategory is frontend-only — not returned by the backend.
    // admin-slots.tsx sets it when the user edits a slot.
    defaultCategory:  undefined,
  };
}

/**
 * Convert the frontend Slot partial (from SlotModal's handleSave) into the
 * write payload the backend expects.
 */
function toBackendPayload(data: Partial<Slot>, fallback?: Slot): SlotWritePayload {
  const mealTypeMap: Record<string, string> = {
    Breakfast: 'BREAKFAST',
    Meal:      'MEAL',
  };

  const type     = data.type     ?? fallback?.type     ?? 'Meal';
  const isActive = data.active   ?? fallback?.active   ?? true;

  return {
    name:          data.name       ?? fallback?.name       ?? '',
    label:         data.label      ?? fallback?.label      ?? 'NEW SESSION',
    date:          data.date       ?? fallback?.date       ?? new Date().toISOString().slice(0, 10),
    start_time:    data.startTime  ?? fallback?.startTime  ?? '09:00',
    end_time:      data.endTime    ?? fallback?.endTime    ?? '11:00',
    capacity:      data.capacity   ?? fallback?.capacity   ?? 100,
    meal_type:     mealTypeMap[type] ?? type.toUpperCase(),
    is_active:     isActive,
    // categories removed (backend FIX 4) — not sent
    menu_item_ids: data.menuItemIds ?? fallback?.menuItemIds ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getTokenFromStorage();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data as any)?.detail ?? res.statusText ?? 'Request failed';
    const err = new Error(msg) as Error & { status: number; data: unknown };
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data as T;
}

async function http<T>(method: string, path: string, body?: unknown): Promise<{ data: T }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: buildHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // 204 No Content (DELETE) — return null
  if (res.status === 204) return { data: null as unknown as T };
  const data = await parseResponse<T>(res);
  return { data };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — returns mapped frontend types so admin-slots.tsx needs no changes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /slots/
 * Returns all slots as frontend Slot[].
 * Note: list endpoint does NOT include items[] — menuItemIds will be empty
 * until fetchSlotById() or fetchSlotItems() is called for that slot.
 */
export async function fetchSlots(): Promise<{ data: Slot[] }> {
  const { data } = await http<BackendSlot[]>('GET', '/');
  return { data: (data ?? []).map(toFrontendSlot) };
}

/**
 * GET /slots/{id}/
 * Returns a single slot with its items[] populated.
 * Use this when opening the Edit modal to get menuItemIds.
 */
export async function fetchSlotById(id: string): Promise<{ data: Slot }> {
  const { data } = await http<BackendSlot>('GET', `/${id}/`);
  return { data: toFrontendSlot(data) };
}

/**
 * POST /slots/
 * Creates a new slot. Accepts the partial Slot shape from SlotModal.
 * Returns the created slot mapped to the frontend Slot shape.
 */
export async function createSlot(data: Partial<Slot>): Promise<{ data: Slot }> {
  const payload = toBackendPayload(data);
  const { data: created } = await http<BackendSlot>('POST', '/', payload);
  return { data: toFrontendSlot(created) };
}

/**
 * PUT /slots/{id}/
 * Full update of an existing slot.
 * `fallback` is the existing slot — used to fill fields that the modal
 * didn't touch (avoids sending undefined values).
 */
export async function updateSlot(
  id: string,
  data: Partial<Slot>,
  fallback?: Slot,
): Promise<{ data: Slot }> {
  const payload = toBackendPayload(data, fallback);
  const { data: updated } = await http<BackendSlot>('PUT', `/${id}/`, payload);
  return { data: toFrontendSlot(updated) };
}

/**
 * DELETE /slots/{id}/
 * Returns null on success (204 No Content).
 */
export async function deleteSlot(id: string): Promise<{ data: null }> {
  return http<null>('DELETE', `/${id}/`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot Item Availability
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotItemRow {
  menu_item_id: string;
  is_enabled: boolean;
  max_qty_per_order: number;
}

/**
 * GET /slots/{slotId}/items/
 * Returns the raw SlotMenuItem list (not mapped to Slot — used to refresh
 * the availability modal independently of the slot list).
 */
export async function fetchSlotItems(slotId: string): Promise<{ data: SlotItemRow[] }> {
  return http<SlotItemRow[]>('GET', `/${slotId}/items/`);
}

/**
 * PATCH /slots/{slotId}/items/{itemId}/
 * Toggles is_enabled for one item in the slot.
 *
 * admin-slots.tsx passes the itemId as a UUID string.
 * The backend URL regex accepts [0-9a-f-]+ (updated from \d+ in the viewset).
 */
export async function toggleSlotItem(
  slotId: string,
  itemId: string,
  is_enabled: boolean,
): Promise<{ data: SlotItemRow }> {
  return http<SlotItemRow>('PATCH', `/${slotId}/items/${itemId}/`, { is_enabled });
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience endpoints (wrappers around /slots/today/ and /slots/upcoming/)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /slots/today/
 * Returns today's slots mapped to the frontend Slot shape.
 */
export async function fetchTodaySlots(): Promise<{ data: Slot[] }> {
  const { data } = await http<BackendSlot[]>('GET', '/today/');
  return { data: (data ?? []).map(toFrontendSlot) };
}

/**
 * GET /slots/upcoming/
 * Returns upcoming slots (date >= today) mapped to the frontend Slot shape.
 */
export async function fetchUpcomingSlots(): Promise<{ data: Slot[] }> {
  const { data } = await http<BackendSlot[]>('GET', '/upcoming/');
  return { data: (data ?? []).map(toFrontendSlot) };
}
