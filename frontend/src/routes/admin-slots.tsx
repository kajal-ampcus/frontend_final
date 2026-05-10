import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Eye, Trash2, Pencil, X, Check } from "lucide-react";
import { AdminLayout } from "./admin-orders";
import { formatINR } from "@/lib/store";
import { useMenuItems } from "@/hooks/useMenu";
import {
  useAdminTimeSlots,
  useCanteenLocations,
  useCreateTimeSlot,
  useDeleteTimeSlot,
  useUpdateTimeSlot,
  type CanteenLocation,
  type TimeSlot,
} from "@/hooks/useCanteen";
import type { ApiMenuItem, ReplaceMenuItemSlotConfigPayload } from "@/api/menu";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-slots")({ component: AdminSlots });

const DAY_OPTIONS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

type EditableSlot = Partial<TimeSlot> & { id?: string; canteen: string; slot_type: string };
type TimeParts = { hour: string; minute: string; meridiem: "AM" | "PM" };
type SlotItemDraft = {
  itemId: string;
  itemName: string;
  price: string;
  quantity_per_slot: string;
  max_qty_per_order: string;
  max_qty_per_person: string;
  max_qty_per_day: string;
};

function AdminSlots() {
  const { data: canteens = [] } = useCanteenLocations();
  const [selectedCanteenId, setSelectedCanteenId] = useState("");
  const { data: slots = [], isLoading } = useAdminTimeSlots(selectedCanteenId || undefined);
  const { items, isLoading: itemsLoading, saveItemSlotConfigs } = useMenuItems(
    undefined,
    selectedCanteenId || undefined,
  );
  const createSlot = useCreateTimeSlot();
  const updateSlot = useUpdateTimeSlot();
  const deleteSlot = useDeleteTimeSlot();
  const [now, setNow] = useState(new Date());
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [managingSlot, setManagingSlot] = useState<TimeSlot | null>(null);

  useEffect(() => {
    if (!selectedCanteenId && canteens[0]?.id) {
      setSelectedCanteenId(canteens[0].id);
    }
  }, [canteens, selectedCanteenId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const computedSlots = useMemo(() => {
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    return slots.map((slot) => {
      const [startH, startM] = slot.start_time.split(":").map(Number);
      const [endH, endM] = slot.end_time.split(":").map(Number);
      const startTotalMinutes = startH * 60 + startM;
      const endTotalMinutes = endH * 60 + endM;

      let computedStatus = "upcoming";
      let statusColor = "bg-muted text-muted-foreground";

      if (!slot.is_active || currentTotalMinutes > endTotalMinutes) {
        computedStatus = "expired";
        statusColor = "bg-destructive text-destructive-foreground";
      } else if (currentTotalMinutes >= startTotalMinutes) {
        computedStatus = "active";
        statusColor = "bg-primary text-primary-foreground";
      }

      const capacity = Number(slot.max_orders ?? 0);
      const occupancy = Number(slot.current_order_count ?? 0);
      const pct = capacity > 0 ? Math.min(100, Math.round((occupancy / capacity) * 100)) : 0;
      const barColor =
        pct >= 80 ? "bg-destructive" : pct >= 50 ? "bg-primary" : pct >= 20 ? "bg-info" : "bg-success";

      return {
        ...slot,
        computedStatus,
        statusColor,
        pct,
        barColor,
        occ: capacity > 0 ? `${occupancy}/${capacity}` : `${occupancy}/-`,
        displayStatus:
          computedStatus === "active" ? "ACTIVE" : computedStatus === "upcoming" ? "UPCOMING" : "CLOSED",
      };
    });
  }, [now, slots]);

  const openCreate = () => {
    setEditingSlot(null);
    setShowForm(true);
  };

  const openEdit = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setShowForm(true);
  };

  const handleDelete = async (slot: TimeSlot) => {
    if (!confirm(`Delete slot "${slot.name}"?`)) return;
    try {
      await deleteSlot.mutateAsync(slot.id);
      toast.success(`Slot "${slot.name}" deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete slot.");
    }
  };

  const handleSave = async (payload: EditableSlot) => {
    try {
      if (editingSlot?.id) {
        const updated = await updateSlot.mutateAsync({ id: editingSlot.id, ...payload });
        toast.success("Slot updated.");
        setShowForm(false);
        setEditingSlot(null);
        setManagingSlot(updated);
      } else {
        const created = await createSlot.mutateAsync(payload);
        toast.success("Slot created.");
        setShowForm(false);
        setEditingSlot(null);
        setManagingSlot(created);
        return;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save slot.");
    }
  };

  return (
    <AdminLayout crumb="Time Slots">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meal Slot Management</h1>
          <p className="text-xs text-muted-foreground">Create and manage real backend slots directly from here.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCanteenId}
            onChange={(e) => setSelectedCanteenId(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            {canteens.map((canteen) => (
              <option key={canteen.id} value={canteen.id}>{canteen.name}</option>
            ))}
          </select>
          <button
            onClick={openCreate}
            disabled={!selectedCanteenId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Create Slot
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading slots...
        </div>
      ) : computedSlots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="text-lg font-semibold">No slots found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first real backend slot from this page.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {computedSlots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              items={items}
              onEdit={openEdit}
              onDelete={handleDelete}
              onManageItems={setManagingSlot}
            />
          ))}
        </div>
      )}

      {showForm && (
        <SlotModal
          canteens={canteens}
          selectedCanteenId={selectedCanteenId}
          slot={editingSlot}
          onClose={() => {
            setShowForm(false);
            setEditingSlot(null);
          }}
          onSave={handleSave}
        />
      )}

      {managingSlot && (
        <SlotItemsModal
          slot={managingSlot}
          items={items}
          itemsLoading={itemsLoading}
          onClose={() => setManagingSlot(null)}
          onSave={async (changes) => {
            for (const change of changes) {
              const saved = await saveItemSlotConfigs(change.itemId, { slots: change.slots });
              if (!saved) {
                throw new Error(`Failed to save rules for ${change.itemName}.`);
              }
            }
          }}
        />
      )}
    </AdminLayout>
  );
}

function SlotCard({
  slot,
  items,
  onEdit,
  onDelete,
  onManageItems,
}: {
  slot: TimeSlot & {
    computedStatus: string;
    statusColor: string;
    pct: number;
    barColor: string;
    occ: string;
    displayStatus: string;
  };
  items: ApiMenuItem[];
  onEdit: (slot: TimeSlot) => void;
  onDelete: (slot: TimeSlot) => void;
  onManageItems: (slot: TimeSlot) => void;
}) {
  const assignedCount = items.filter((item) =>
    item.slot_configs.some((config) => config.slot_id === slot.id && config.is_active),
  ).length;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="text-[10px] tracking-widest text-muted-foreground">{slot.slot_type_name || "SESSION"}</div>
        <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${slot.statusColor}`}>{slot.displayStatus}</span>
      </div>
      <div className="mt-1 text-xl font-bold">{slot.name}</div>
      <div className="text-[11px] text-muted-foreground">
        {formatClock(slot.start_time)} - {formatClock(slot.end_time)}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Occupancy</span>
        <span className="font-semibold text-foreground">
          {slot.occ} <span className="text-muted-foreground">({slot.pct}%)</span>
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {assignedCount} item{assignedCount === 1 ? "" : "s"} assigned
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full ${slot.barColor}`} style={{ width: `${slot.pct}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => onManageItems(slot)}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5"
        >
          Manage Items
        </button>
        <div className="flex justify-end gap-2">
        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="View">
          <Eye className="h-3 w-3" />
        </button>
        <button
          onClick={() => onEdit(slot)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => void onDelete(slot)}
          className="rounded p-1 text-muted-foreground hover:bg-red-500/20 hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
        </div>
      </div>
    </div>
  );
}

function SlotItemsModal({
  slot,
  items,
  itemsLoading,
  onClose,
  onSave,
}: {
  slot: TimeSlot;
  items: ApiMenuItem[];
  itemsLoading: boolean;
  onClose: () => void;
  onSave: (
    changes: Array<{ itemId: string; itemName: string; slots: ReplaceMenuItemSlotConfigPayload["slots"] }>,
  ) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, SlotItemDraft>>(() => buildSlotItemDrafts(items, slot.id));
  const [selectedItemIdToAdd, setSelectedItemIdToAdd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(buildSlotItemDrafts(items, slot.id));
  }, [items, slot.id]);

  const selectedItems = useMemo(
    () => items.filter((item) => drafts[item.id]),
    [drafts, items],
  );

  const availableItems = useMemo(
    () => items.filter((item) => !drafts[item.id] && item.is_available),
    [drafts, items],
  );

  useEffect(() => {
    if (availableItems.length === 0) {
      setSelectedItemIdToAdd("");
      return;
    }

    if (!selectedItemIdToAdd || !availableItems.some((item) => item.id === selectedItemIdToAdd)) {
      setSelectedItemIdToAdd(availableItems[0].id);
    }
  }, [availableItems, selectedItemIdToAdd]);

  const toggleItem = (item: ApiMenuItem) => {
    setDrafts((current) => {
      if (current[item.id]) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }

      return {
        ...current,
        [item.id]: {
          itemId: item.id,
          itemName: item.name,
          price: item.base_price,
          quantity_per_slot: "1",
          max_qty_per_order: "1",
          max_qty_per_person: "1",
          max_qty_per_day: "",
        },
      };
    });
  };

  const updateDraft = (itemId: string, field: keyof Omit<SlotItemDraft, "itemId" | "itemName" | "price">, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        [field]: value,
      },
    }));
  };

  const addSelectedItem = () => {
    const item = availableItems.find((entry) => entry.id === selectedItemIdToAdd);
    if (!item) {
      toast.error("Select an available item first.");
      return;
    }
    toggleItem(item);
  };

  const submit = async () => {
    const selectedIds = new Set(Object.keys(drafts));
    const touchedItems = items.filter(
      (item) => selectedIds.has(item.id) || item.slot_configs.some((config) => config.slot_id === slot.id && config.is_active),
    );

    const changes: Array<{ itemId: string; itemName: string; slots: ReplaceMenuItemSlotConfigPayload["slots"] }> = [];

    for (const item of touchedItems) {
      const draft = drafts[item.id];
      const otherSlots = item.slot_configs
        .filter((config) => config.is_active && config.slot_id !== slot.id)
        .map((config) => ({
          slot_id: config.slot_id,
          slot_name: config.slot_name,
          slot_start_time: config.slot_start_time,
          slot_end_time: config.slot_end_time,
          quantity_per_slot: config.quantity_per_slot,
          max_qty_per_order: config.max_qty_per_order,
          max_qty_per_person: config.max_qty_per_person,
          max_qty_per_day: config.max_qty_per_day,
          is_active: true,
        }));

      if (!draft) {
        changes.push({ itemId: item.id, itemName: item.name, slots: otherSlots });
        continue;
      }

      const quantityPerSlot = Number(draft.quantity_per_slot);
      const maxQtyPerOrder = Number(draft.max_qty_per_order);
      const maxQtyPerPerson = Number(draft.max_qty_per_person || draft.max_qty_per_order);
      const maxQtyPerDay = draft.max_qty_per_day ? Number(draft.max_qty_per_day) : null;

      if (!Number.isInteger(quantityPerSlot) || quantityPerSlot <= 0) {
        return toast.error(`Enter a valid slot quantity for ${draft.itemName}.`);
      }
      if (!Number.isInteger(maxQtyPerOrder) || maxQtyPerOrder <= 0) {
        return toast.error(`Enter a valid per-order limit for ${draft.itemName}.`);
      }
      if (!Number.isInteger(maxQtyPerPerson) || maxQtyPerPerson <= 0) {
        return toast.error(`Enter a valid per-person limit for ${draft.itemName}.`);
      }
      if (maxQtyPerDay != null && (!Number.isInteger(maxQtyPerDay) || maxQtyPerDay <= 0)) {
        return toast.error(`Enter a valid daily limit for ${draft.itemName}.`);
      }

      changes.push({
        itemId: item.id,
        itemName: item.name,
        slots: [
          ...otherSlots,
          {
            slot_id: slot.id,
            slot_name: slot.name,
            slot_start_time: slot.start_time,
            slot_end_time: slot.end_time,
            quantity_per_slot: quantityPerSlot,
            max_qty_per_order: maxQtyPerOrder,
            max_qty_per_person: maxQtyPerPerson,
            max_qty_per_day: maxQtyPerDay,
            is_active: true,
          },
        ],
      });
    }

    setSaving(true);
    try {
      await onSave(changes);
      toast.success(`Updated item rules for ${slot.name}.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save slot item rules.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex min-h-full items-start justify-center">
        <div className="relative w-full max-w-5xl rounded-2xl border border-border bg-card shadow-xl">
          <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <div className="text-xl font-bold">Manage Items In {slot.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Add menu items to this slot and set limits only for this specific slot.
            </div>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-2 text-sm font-semibold">What these limits mean</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>`Slot quantity`: total stock reserved for this item in this slot.</div>
                <div>`Per order`: max quantity allowed in one checkout.</div>
                <div>`Per person`: max total quantity one employee can order in this slot.</div>
                <div>`Daily limit`: optional extra cap for one employee across the day for this slot item.</div>
              </div>
              <div className="mt-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                Recommended setup: keep `Slot quantity` and `Per order` as the main required rules. Use `Per person` when repeat ordering needs control. Use `Daily limit` only if your business really needs it.
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <Field label="Available Items">
                  <select
                    value={selectedItemIdToAdd}
                    onChange={(e) => setSelectedItemIdToAdd(e.target.value)}
                    className={inputCls}
                    disabled={!availableItems.length}
                  >
                    {availableItems.length === 0 ? (
                      <option value="">No more available items</option>
                    ) : (
                      availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {formatINR(Number(item.base_price))}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={addSelectedItem}
                  disabled={!availableItems.length}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Item To Slot
                </button>
              </div>
            </div>

            {itemsLoading ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Loading items...
              </div>
            ) : (
              <div className="space-y-4">
                {selectedItems.map((item) => {
                  const draft = drafts[item.id];
                  if (!draft) return null;
                  return (
                    <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-base font-semibold">{item.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatINR(Number(item.base_price))} · {item.category_name} · {item.item_type}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleItem(item)}
                          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive transition"
                        >
                          Remove From Slot
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Slot Quantity *">
                          <input
                            value={draft.quantity_per_slot}
                            onChange={(e) => updateDraft(item.id, "quantity_per_slot", e.target.value)}
                            inputMode="numeric"
                            placeholder="Total stock"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Per Order *">
                          <input
                            value={draft.max_qty_per_order}
                            onChange={(e) => updateDraft(item.id, "max_qty_per_order", e.target.value)}
                            inputMode="numeric"
                            placeholder="One checkout max"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Per Person">
                          <input
                            value={draft.max_qty_per_person}
                            onChange={(e) => updateDraft(item.id, "max_qty_per_person", e.target.value)}
                            inputMode="numeric"
                            placeholder="Defaults to per order"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="Daily Limit">
                          <input
                            value={draft.max_qty_per_day}
                            onChange={(e) => updateDraft(item.id, "max_qty_per_day", e.target.value)}
                            inputMode="numeric"
                            placeholder="Optional"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}

                {!selectedItems.length && (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    No items added to this slot yet. Select an item from the dropdown above to assign it here.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Slot Items"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotModal({
  canteens,
  selectedCanteenId,
  slot,
  onClose,
  onSave,
}: {
  canteens: CanteenLocation[];
  selectedCanteenId: string;
  slot: TimeSlot | null;
  onClose: () => void;
  onSave: (payload: EditableSlot) => Promise<void>;
}) {
  const [canteen, setCanteen] = useState(slot?.canteen ?? selectedCanteenId);
  const [name, setName] = useState(slot?.name ?? "");
  const [slotType, setSlotType] = useState(slot?.slot_type ?? "MEAL");
  const [startTime, setStartTime] = useState<TimeParts>(() => parseTimeParts(slot?.start_time, "07:00"));
  const [endTime, setEndTime] = useState<TimeParts>(() => parseTimeParts(slot?.end_time, "09:00"));
  const [orderingOpensAt, setOrderingOpensAt] = useState<TimeParts>(() =>
    parseTimeParts(slot?.ordering_opens_at, "06:00"),
  );
  const [orderingDeadline, setOrderingDeadline] = useState<TimeParts>(() =>
    parseTimeParts(slot?.ordering_deadline_time ?? slot?.start_time, "07:00"),
  );
  const [cancellationDeadline, setCancellationDeadline] = useState<TimeParts>(() =>
    parseTimeParts(slot?.cancellation_deadline_time ?? slot?.start_time, "07:00"),
  );
  const [maxOrders, setMaxOrders] = useState(slot?.max_orders != null ? String(slot.max_orders) : "");
  const [displayColor, setDisplayColor] = useState(slot?.display_color ?? "#3b82f6");
  const [isActive, setIsActive] = useState(slot?.is_active ?? true);
  const [applicableDays, setApplicableDays] = useState<number[]>(slot?.applicable_days?.length ? slot.applicable_days : [1, 2, 3, 4, 5, 6, 7]);

  const toggleDay = (value: number) => {
    setApplicableDays((current) =>
      current.includes(value) ? current.filter((day) => day !== value) : [...current, value].sort(),
    );
  };

  const handleSave = async () => {
    if (!canteen) return toast.error("Select a canteen.");
    if (!name.trim()) return toast.error("Slot name is required.");
    if (!startTime || !endTime) return toast.error("Start and end time are required.");

    await onSave({
      canteen,
      name: name.trim(),
      slot_type: slotType,
      start_time: to24HourTime(startTime),
      end_time: to24HourTime(endTime),
      ordering_opens_at: orderingOpensAt ? to24HourTime(orderingOpensAt) : null,
      ordering_deadline_time: to24HourTime(orderingDeadline),
      cancellation_deadline_time: to24HourTime(cancellationDeadline),
      max_orders: maxOrders ? Number(maxOrders) : null,
      applicable_days: applicableDays,
      display_color: displayColor,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex min-h-full items-start justify-center">
        <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-card shadow-xl">
          <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="border-b border-border px-5 py-5 sm:px-6">
            <div className="text-xl font-bold">{slot ? "Edit Slot" : "Create Slot"}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Create a real backend slot with clear timing, limits, and day availability.
            </div>
            {!slot && (
              <div className="mt-3 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                Item assignment happens in the next step. After you save this slot, the item dropdown will open automatically.
              </div>
            )}
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <section className="rounded-2xl border border-border bg-background/40 p-4 sm:p-5">
              <div className="mb-4 text-sm font-semibold">Basic Details</div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Canteen">
                  <select value={canteen} onChange={(e) => setCanteen(e.target.value)} className={inputCls}>
                    {canteens.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Slot Type">
                  <select value={slotType} onChange={(e) => setSlotType(e.target.value)} className={inputCls}>
                    <option value="BREAKFAST">Breakfast</option>
                    <option value="MEAL">Meal</option>
                    <option value="SNACK">Snack</option>
                  </select>
                </Field>
                <Field label="Slot Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="Breakfast"
                  />
                </Field>
                <Field label="Max Orders">
                  <input
                    type="number"
                    min="1"
                    value={maxOrders}
                    onChange={(e) => setMaxOrders(e.target.value)}
                    className={inputCls}
                    placeholder="100"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background/40 p-4 sm:p-5">
              <div className="mb-1 text-sm font-semibold">Time Windows</div>
              <p className="mb-4 text-xs text-muted-foreground">
                Pick hour, minute, and AM or PM for each stage of the slot.
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Start Time">
                  <TimePicker value={startTime} onChange={setStartTime} />
                </Field>
                <Field label="End Time">
                  <TimePicker value={endTime} onChange={setEndTime} />
                </Field>
                <Field label="Ordering Opens">
                  <TimePicker value={orderingOpensAt} onChange={setOrderingOpensAt} />
                </Field>
                <Field label="Ordering Deadline">
                  <TimePicker value={orderingDeadline} onChange={setOrderingDeadline} />
                </Field>
                <Field label="Cancel Deadline">
                  <TimePicker value={cancellationDeadline} onChange={setCancellationDeadline} />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background/40 p-4 sm:p-5">
              <div className="mb-4 text-sm font-semibold">Display and Availability</div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Color">
                  <div className="rounded-xl border border-border bg-card p-2">
                    <input
                      type="color"
                      value={displayColor}
                      onChange={(e) => setDisplayColor(e.target.value)}
                      className="h-11 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />
                  </div>
                </Field>
                <Field label="Active Status">
                  <label className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card px-4">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    <span className="text-sm font-medium">{isActive ? "Active and visible" : "Inactive and hidden"}</span>
                  </label>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Applicable Days">
                  <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
                    {DAY_OPTIONS.map((day) => {
                      const selected = applicableDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm"
            >
              {slot ? "Update Slot" : "Create Slot"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimePicker({
  value,
  onChange,
}: {
  value: TimeParts;
  onChange: (next: TimeParts) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_92px] gap-2 sm:grid-cols-[1fr_1fr_104px]">
      <select
        value={value.hour}
        onChange={(e) => onChange({ ...value, hour: e.target.value })}
        className={inputCls}
      >
        {Array.from({ length: 12 }, (_, index) => {
          const hour = String(index + 1).padStart(2, "0");
          return (
            <option key={hour} value={hour}>
              {hour}
            </option>
          );
        })}
      </select>
      <select
        value={value.minute}
        onChange={(e) => onChange({ ...value, minute: e.target.value })}
        className={inputCls}
      >
        {Array.from({ length: 60 }, (_, index) => {
          const minute = String(index).padStart(2, "0");
          return (
            <option key={minute} value={minute}>
              {minute}
            </option>
          );
        })}
      </select>
      <select
        value={value.meridiem}
        onChange={(e) => onChange({ ...value, meridiem: e.target.value as "AM" | "PM" })}
        className={inputCls}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

function parseTimeParts(value: string | null | undefined, fallback: string): TimeParts {
  const normalized = normalizeTimeValue(value, fallback);
  const [rawHour = "00", minute = "00"] = normalized.split(":");
  const hourNumber = Number(rawHour);
  const meridiem: "AM" | "PM" = hourNumber >= 12 ? "PM" : "AM";
  const hour12 = hourNumber % 12 || 12;

  return {
    hour: String(hour12).padStart(2, "0"),
    minute,
    meridiem,
  };
}

function normalizeTimeValue(value: string | null | undefined, fallback: string) {
  const source = value?.trim() || fallback;
  const parts = source.split(":");
  const hour = parts[0] ?? "00";
  const minute = parts[1] ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function to24HourTime(value: TimeParts) {
  const baseHour = Number(value.hour) % 12;
  const hour = value.meridiem === "PM" ? baseHour + 12 : baseHour;
  return `${String(hour).padStart(2, "0")}:${value.minute}:00`;
}

function formatClock(value: string) {
  const [hour = "00", minute = "00"] = value.split(":");
  const parsed = new Date();
  parsed.setHours(Number(hour), Number(minute), 0, 0);
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function buildSlotItemDrafts(items: ApiMenuItem[], slotId: string) {
  const next: Record<string, SlotItemDraft> = {};

  items.forEach((item) => {
    const config = item.slot_configs.find((entry) => entry.slot_id === slotId && entry.is_active);
    if (!config) return;

    next[item.id] = {
      itemId: item.id,
      itemName: item.name,
      price: item.base_price,
      quantity_per_slot: String(config.quantity_per_slot),
      max_qty_per_order: String(config.max_qty_per_order),
      max_qty_per_person: String(config.max_qty_per_person),
      max_qty_per_day: config.max_qty_per_day != null ? String(config.max_qty_per_day) : "",
    };
  });

  return next;
}

const inputCls =
  "min-w-0 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
