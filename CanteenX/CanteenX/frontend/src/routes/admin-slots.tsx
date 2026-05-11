import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Clock, Plus, Pencil, X, Calendar, Check, Eye, Trash2 } from "lucide-react";
import { AdminLayout } from "./admin-orders";
import {
  type ItemCategory,
  type ItemType,
  type Slot,
  type MenuItem,
  formatINR,
  formatTimeRange,
} from "@/lib/store";
import { fetchSlots, fetchSlotById, createSlot, updateSlot, deleteSlot, toggleSlotItem } from '@/api/slotapi';
import { canteenApi, menuItemApi, type ApiMenuItem } from "@/api/menu";

export const Route = createFileRoute("/admin-slots")({ component: AdminSlots });

const CATEGORIES_BY_TYPE: Partial<Record<ItemType, ItemCategory[]>> = {
  Breakfast: ["Beverages", "Veg"],
  Meal: ["Veg", "Non-Veg", "Beverages"],
  Lunch: ["Veg", "Non-Veg", "Beverages"],
  Dinner: ["Veg", "Non-Veg", "Beverages"],
  Snacks: ["Veg", "Beverages", "Snacks"],
  Dessert: ["Desserts", "Veg"],
  Beverages: ["Beverages"],
  Other: ["Veg", "Non-Veg", "Beverages"],
};

function normalizeCategory(value: string): ItemCategory {
  const normal = value.trim().toLowerCase();
  if (normal.includes("non")) return "Non-Veg";
  if (normal.includes("beverage") || normal.includes("drink")) return "Beverages";
  if (normal.includes("dessert") || normal.includes("sweet")) return "Desserts";
  if (normal.includes("snack")) return "Snacks";
  return "Veg";
}

function toSlotMenuItem(item: ApiMenuItem): MenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.base_price),
    category: normalizeCategory(item.category_name || item.category?.name || ""),
    type: item.item_type === "BREAKFAST" ? "Breakfast" : "Meal",
    available: item.is_available && item.is_active,
    image: item.photo_url,
    tag: item.display_tag,
  };
}

function AdminSlots() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewItemsSlot, setViewItemsSlot] = useState<Slot | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadSlots();
    loadMenuItems();
  }, []);

  const loadSlots = async () => {
    try {
      const response = await fetchSlots();
      setSlots(response.data || []);
    } catch (error) {
      console.error("Failed to fetch slots:", error);
    }
  };

  const loadMenuItems = async () => {
    try {
      const canteens = await canteenApi.list();
      const selectedCanteenId =
        sessionStorage.getItem("canteen_selected_id") ||
        canteens.results[0]?.id ||
        "";

      if (!selectedCanteenId) {
        setMenuItems([]);
        return;
      }

      sessionStorage.setItem("canteen_selected_id", selectedCanteenId);
      const response = await menuItemApi.list(selectedCanteenId, { is_available: true });
      setMenuItems(response.results.map(toSlotMenuItem));
    } catch (error) {
      console.error("Failed to fetch menu items:", error);
      setMenuItems([]);
    }
  };

  const computedSlots = useMemo(() => {
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    return slots.map((s) => {
      const [startH, startM] = s.startTime.split(":").map(Number);
      const [endH, endM] = s.endTime.split(":").map(Number);
      const startTotalMinutes = startH * 60 + startM;
      const endTotalMinutes = endH * 60 + endM;

      let computedStatus = s.status;
      let statusColor = "bg-muted text-muted-foreground";

      if (!s.active) {
        computedStatus = "expired";
        statusColor = "bg-destructive text-destructive-foreground";
      } else if (currentTotalMinutes > endTotalMinutes) {
        computedStatus = "expired";
        statusColor = "bg-destructive text-destructive-foreground";
      } else if (currentTotalMinutes >= startTotalMinutes) {
        computedStatus = "active";
        statusColor = "bg-primary text-primary-foreground";
      } else {
        computedStatus = "upcoming";
        statusColor = "bg-muted text-muted-foreground";
      }

      const capacity = Number(s.capacity ?? 0);
      const occupancy = Number(s.currentOccupancy ?? 0);
      const pct = capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0;
      const barColor =
        pct >= 80 ? "bg-destructive" : pct >= 50 ? "bg-primary" : pct >= 20 ? "bg-info" : "bg-success";

      return {
        ...s,
        computedStatus,
        statusColor,
        pct,
        barColor,
        occ: `${occupancy}/${capacity}`,
        displayStatus:
          computedStatus === "active" ? "● ACTIVE" : computedStatus === "upcoming" ? "UPCOMING" : "CLOSED",
      };
    });
  }, [slots, now]);

  const handleEditSlot = async (slot: Slot) => {
    try {
      const response = await fetchSlotById(slot.id);
      setEditingSlot(response.data);
      setShowAdd(true);
    } catch (error) {
      console.error("Failed to load slot details:", error);
    }
  };

  const handleViewSlotItems = async (slot: Slot) => {
    try {
      const response = await fetchSlotById(slot.id);
      setViewItemsSlot(response.data);
    } catch (error) {
      console.error("Failed to load slot items:", error);
    }
  };

  const handleToggleSlotItem = async (slotId: string, itemId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    const disabledItemIds = slot.disabledItemIds ?? [];
    const isCurrentlyDisabled = disabledItemIds.includes(itemId);
    const isEnabled = isCurrentlyDisabled;

    try {
      await toggleSlotItem(slotId, itemId, isEnabled);
      
      // Update local state
      const updatedDisabled = isCurrentlyDisabled
        ? disabledItemIds.filter((id) => id !== itemId)
        : [...disabledItemIds, itemId];

      // Update slots list
      setSlots(slots.map((s) => 
        s.id === slotId ? { ...s, disabledItemIds: updatedDisabled } : s
      ));

      // Update viewItemsSlot if it's the same slot
      if (viewItemsSlot?.id === slotId) {
        setViewItemsSlot({ ...slot, disabledItemIds: updatedDisabled });
      }
    } catch (error) {
      console.error("Failed to toggle slot item:", error);
    }
  };

  const handleDeleteSlot = async (slotId: string, slotName: string) => {
    if (confirm(`Are you sure you want to delete the "${slotName}" slot?`)) {
      try {
        await deleteSlot(slotId);
        setSlots(slots.filter((s) => s.id !== slotId));
      } catch (error) {
        console.error("Failed to delete slot:", error);
      }
    }
  };

  const handleSaveSlot = async (data: Partial<Slot>) => {
    try {
      if (editingSlot) {
        const response = await updateSlot(editingSlot.id, data, editingSlot);
        setSlots(slots.map((s) => (s.id === editingSlot.id ? response.data : s)));
      } else {
        const response = await createSlot(data);
        setSlots([...slots, response.data]);
      }
      setShowAdd(false);
      setEditingSlot(null);
    } catch (error) {
      console.error("Failed to save slot:", error);
    }
  };

  return (
    <AdminLayout crumb="Time Slots">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Meal Slot Management</h1>
        <p className="text-xs text-muted-foreground">Configure operational windows and assign menu items per slot.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {computedSlots.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="text-[10px] tracking-widest text-muted-foreground">{s.label}</div>
              <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${s.statusColor}`}>{s.displayStatus}</span>
            </div>
            <div className="mt-1 text-xl font-bold">{s.name}</div>
            <div className="text-[11px] text-muted-foreground">{s.displayTime}</div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Occupancy</span>
              <span className="font-semibold text-foreground">
                {s.occ} <span className="text-muted-foreground">({s.pct}%)</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className={`h-1.5 rounded-full ${s.barColor}`} style={{ width: `${s.pct}%` }} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => handleViewSlotItems(s)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="View slot items"
              >
                <Eye className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleEditSlot(s)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Edit slot"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleDeleteSlot(s.id, s.name)}
                className="rounded p-1 text-muted-foreground hover:bg-red-500/20 hover:text-red-500"
                title="Delete slot"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => {
            setEditingSlot(null);
            setShowAdd(true);
          }}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card/40 p-6 text-center hover:border-primary hover:bg-card/60 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
            <Plus className="h-5 w-5" />
          </div>
        </button>
      </div>

      {showAdd && (
        <SlotModal
          onClose={() => {
            setShowAdd(false);
            setEditingSlot(null);
          }}
          slot={editingSlot}
          onSave={handleSaveSlot}
          menuItems={menuItems}
        />
      )}
      {viewItemsSlot && (
        <SlotItemsModal
          slot={viewItemsSlot}
          menuItems={menuItems}
          onClose={() => setViewItemsSlot(null)}
          onToggleItem={handleToggleSlotItem}
        />
      )}
    </AdminLayout>
  );
}

function SlotModal({
  onClose,
  slot,
  onSave,
  menuItems,
}: {
  onClose: () => void;
  slot: Slot | null;
  onSave: (data: Partial<Slot>) => void;
  menuItems: MenuItem[];
}) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(slot?.date ?? new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState(slot?.startTime ?? "07:00");
  const [end, setEnd] = useState(slot?.endTime ?? "09:00");
  const [active, setActive] = useState(slot?.active ?? true);
  const [mealType, setMealType] = useState<ItemType>(slot?.type ?? "Meal");
  const [selectedCategories, setSelectedCategories] = useState<ItemCategory[]>(
    slot?.defaultCategory ? [slot.defaultCategory as ItemCategory] : ["Veg"]
  );
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(slot?.menuItemIds ?? []);
  const [slotName, setSlotName] = useState(slot?.name ?? "");
  const [label, setLabel] = useState(slot?.label ?? "NEW SESSION");
  const [capacity, setCapacity] = useState(slot?.capacity ?? 100);

  useEffect(() => {
    if (slot) {
      setDate(slot.date ?? new Date().toISOString().slice(0, 10));
      setStart(slot.startTime ?? "07:00");
      setEnd(slot.endTime ?? "09:00");
      setActive(slot.active ?? true);
      setMealType(slot.type ?? "Meal");
      setSelectedCategories(slot.defaultCategory ? [slot.defaultCategory as ItemCategory] : ["Veg"]);
      setSelectedItemIds(slot.menuItemIds ?? []);
      setSlotName(slot.name);
      setLabel(slot.label ?? "NEW SESSION");
      setCapacity(slot.capacity ?? 100);
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setStart("07:00");
      setEnd("09:00");
      setActive(true);
      setMealType("Meal");
      setSelectedCategories(["Veg"]);
      setSelectedItemIds([]);
      setSlotName("");
      setLabel("NEW SESSION");
      setCapacity(100);
    }
  }, [slot]);

  const liveItemsForMealType = useMemo(
    () =>
      menuItems.filter((item) => {
        if (!item.available) return false;
        const itemType = (item.type ?? "Other") as ItemType;
        // Keep breakfast strict, but allow all other slot types to pick from full available menu.
        if (mealType === "Breakfast") {
          return itemType === "Breakfast";
        }
        return true;
      }),
    [menuItems, mealType]
  );

  const validCategories = useMemo(() => {
    const configuredCategories = CATEGORIES_BY_TYPE[mealType] ?? ["Veg", "Non-Veg", "Beverages"];
    const categoriesFromItems = Array.from(
      new Set(liveItemsForMealType.map((item) => item.category).filter(Boolean))
    ) as ItemCategory[];

    if (categoriesFromItems.length === 0) {
      return configuredCategories;
    }

    const intersected = configuredCategories.filter((configuredCategory) =>
      categoriesFromItems.includes(configuredCategory)
    );

    return intersected.length > 0 ? intersected : categoriesFromItems;
  }, [mealType, liveItemsForMealType]);

  useEffect(() => {
    if (selectedCategories.length === 0 && validCategories.length > 0) {
      setSelectedCategories([validCategories[0]]);
    }
  }, [mealType, validCategories, selectedCategories]);

  const filteredItems = useMemo(
    () => liveItemsForMealType.filter((item) => selectedCategories.includes(item.category)),
    [liveItemsForMealType, selectedCategories]
  );

  const handleSave = () => {
    onSave({
      name: slotName,
      label,
      date,
      startTime: start,
      endTime: end,
      displayTime: formatTimeRange(start, end),
      active,
      type: mealType,
      defaultCategory: selectedCategories[0] || "Veg",
      menuItemIds: selectedItemIds,
      capacity,
    });
  };

  const toggleItem = (itemId: string) =>
    setSelectedItemIds((cur) =>
      cur.includes(itemId) ? cur.filter((id) => id !== itemId) : [...cur, itemId]
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground"><X className="h-4 w-4" /></button>
        <div className="mb-4">
          <div className="text-lg font-bold">{slot ? "Edit Slot" : "Add New Slot"}</div>
          <div className="text-xs text-muted-foreground">{slot ? "Modify the dining window and menu" : "Configure a dining window and assign its menu"}</div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Slot Name</Label>
              <input
                placeholder="e.g., Breakfast"
                value={slotName}
                onChange={(e) => setSlotName(e.target.value)}
                className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <Label>Label</Label>
              <input
                placeholder="e.g., MORNING SESSION"
                value={label}
                onChange={(e) => setLabel(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <Label>Capacity</Label>
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time</Label>
              <label className="relative block cursor-pointer" onClick={() => startInputRef.current?.showPicker?.()}>
                <input
                  ref={startInputRef}
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>
            <div>
              <Label>End Time</Label>
              <label className="relative block cursor-pointer" onClick={() => endInputRef.current?.showPicker?.()}>
                <input
                  ref={endInputRef}
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>
          </div>

          <div>
            <Label>Meal Type</Label>
            <div className="flex gap-3">
              {(["Breakfast", "Meal"] as const).map((t) => (
                <label key={t} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${mealType === t ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"}`}>
                  <input
                    type="radio"
                    name="mealType"
                    value={t}
                    checked={mealType === t}
                    onChange={() => { 
                      setMealType(t); 
                      setSelectedItemIds([]); 
                      setSelectedCategories(["Veg"]);
                    }}
                    className="accent-primary"
                  />
                  <span className="font-semibold">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2 rounded-md border border-border bg-input/20 p-2">
              {validCategories.map((c) => {
                const isSelected = selectedCategories.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setSelectedCategories((prev) =>
                        prev.includes(c)
                          ? prev.length > 1 ? prev.filter((cat) => cat !== c) : prev
                          : [...prev, c]
                      );
                    }}
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold transition ${
                      isSelected
                        ? "bg-primary text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Select one or more categories.</div>
          </div>

          <div>
            <Label>
              Assign Menu Items{" "}
              <span className="ml-1 text-muted-foreground">({filteredItems.length} matching)</span>
            </Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border bg-input/20 p-2">
              {filteredItems.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No items match this Meal Type & Category.
                </div>
              )}
              {filteredItems.map((it) => {
                const checked = selectedItemIds.includes(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggleItem(it.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                      checked ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/40"
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{it.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {it.category} · {it.type} · {formatINR(it.price)}
                      </div>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedItemIds.length > 0 && (
              <div className="mt-2 text-[11px] text-primary">{selectedItemIds.length} item(s) selected</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-xs text-muted-foreground">Cancel</button>
          <button onClick={handleSave} className="rounded-md bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground">{slot ? "Update Slot" : "Create Slot"}</button>
        </div>
      </div>
    </div>
  );
}

function SlotItemsModal({
  slot,
  menuItems,
  onClose,
  onToggleItem,
}: {
  slot: Slot;
  menuItems: MenuItem[];
  onClose: () => void;
  onToggleItem: (slotId: string, itemId: string) => void;
}) {
  const itemEntries = (slot.menuItemIds ?? []).map((itemId) => {
    const item = menuItems.find((it) => it.id === itemId);
    return item
      ? {
          id: item.id,
          name: item.name,
          category: item.category,
          type: item.type,
          price: item.price,
        }
      : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <div className="text-lg font-bold">Slot Item Availability</div>
          <div className="text-xs text-muted-foreground">
            View items for this slot and enable or disable them individually.
          </div>
        </div>

        {itemEntries.length === 0 ? (
          <div className="rounded-2xl bg-slate-100/90 p-5 text-center text-sm text-muted-foreground dark:bg-slate-900/90">
            No items have been assigned to this slot yet.
          </div>
        ) : (
          <div className="space-y-3">
            {itemEntries.map((item) => {
              const isDisabled = (slot.disabledItemIds ?? []).includes(item.id);
              return (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.category} · {item.type} · {formatINR(item.price)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleItem(slot.id, item.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      isDisabled ? "bg-border" : "bg-orange-500"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                        isDisabled ? "translate-x-0.5" : "translate-x-5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground">{children}</div>;
}
