import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { Plus, Pencil, X, UploadCloud, Trash2 } from "lucide-react";
import { AdminLayout } from "./admin-orders";
import {
  useStore,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  formatINR,
  ALL_DAYS,
  type Day,
  type ItemCategory,
  type ItemType,
  type MenuItem,
  useAllCategories,
  addCustomCategory,
} from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-menu")({ component: AdminMenu });

const TABS: Array<"All" | ItemCategory> = ["All", "Veg", "Non-Veg", "Beverages"];
const SLOTS = ["Breakfast", "Lunch", "Snacks", "Dinner"] as const;

function AdminMenu() {
  const items = useStore((s) => s.menuItems ?? []);
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const visible = useMemo(() => {
    let list = items;
    if (tab !== "All") list = list.filter((i) => i.category === tab);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, tab, query]);

  const totalPages = Math.ceil(visible.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = visible.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tab, query]);

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setShowForm(true);
  };

  const remove = (item: MenuItem) => {
    if (confirm(`Delete "${item.name}"?`)) {
      deleteMenuItem(item.id);
      toast.success("Item deleted");
    }
  };

  const toggleLive = (item: MenuItem) => {
    updateMenuItem(item.id, { live: !item.live });
  };

  return (
    <AdminLayout crumb="Menu & Items">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu & Items Management</h1>
          <p className="text-xs text-muted-foreground">Configure your daily canteen offerings.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3 w-3" /> Add New Item
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-4 py-1.5 transition ${tab === t ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search menu..."
          className="w-56 rounded-md border border-border bg-input/40 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {paginatedItems.map((it, idx) => {
          const itemName = it.name ?? "Item";
          const itemType = (it.type ?? "Other").toUpperCase();
          const itemCategory = (it.category ?? "Unknown").toUpperCase();
          const itemSlot = (it.slot ?? "NA").toUpperCase();
          const itemDays = Array.isArray(it.days) ? it.days : [];
          const avatarText = itemName.slice(0, 2).toUpperCase();

          return (
            <div
              key={String(it.id ?? `${itemName}-${idx}`)}
              className={`flex items-center gap-3 p-3 sm:gap-4 sm:p-4 ${idx !== visible.length - 1 ? "border-b border-border/60" : ""}`}
            >
              {it.image ? (
                <img
                  src={it.image}
                  alt={it.name}
                  className="h-14 w-14 flex-shrink-0 rounded-md object-cover sm:h-16 sm:w-16"
                />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground sm:h-16 sm:w-16">
                  {avatarText}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-semibold">{itemName}</div>
                  {it.tag && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      {it.tag}
                    </span>
                  )}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                    {itemType}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                  {it.description}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
                  <span>{itemCategory}</span>
                  <span>·</span>
                  <span>{itemSlot}</span>
                  <span>·</span>
                  <span>{itemDays.length === 7 ? "ALL DAYS" : itemDays.join(", ")}</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                <div className="text-right font-bold text-primary">{formatINR(it.price)}</div>
                <button
                  onClick={() => openEdit(it)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(it)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {paginatedItems.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No items match this filter.
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <div className="text-xs text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, visible.length)} of {visible.length}{" "}
              items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`rounded-md px-3 py-1 text-xs ${currentPage === pageNum
                          ? "bg-primary text-primary-foreground"
                          : "border border-border hover:bg-muted"
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && <ItemFormModal initial={editing} onClose={() => setShowForm(false)} />}
    </AdminLayout>
  );
}

function ItemFormModal({ initial, onClose }: { initial: MenuItem | null; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<string>(initial ? String(initial.price) : "");
  const [quantity, setQuantity] = useState<string>(
    initial?.quantity != null ? String(initial.quantity) : "",
  );
  const [category, setCategory] = useState<string>(initial?.category ?? "Veg");
  const [type, setType] = useState<ItemType>(initial?.type ?? "Meal");
  const [slot, setSlot] = useState<string>(initial?.slot ?? "Lunch");
  const [days, setDays] = useState<Day[]>(initial?.days ?? [...ALL_DAYS]);
  const [image, setImage] = useState<string | undefined>(initial?.image);
  const [tag, setTag] = useState<string>(initial?.tag ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleDay = (d: Day) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be ≤ 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!name.trim()) return toast.error("Item name is required");
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return toast.error("Enter a valid price");
    const quantityNum = Number(quantity);
    if (!Number.isInteger(quantityNum) || quantityNum <= 0)
      return toast.error("Enter a valid quantity");
    if (!description.trim()) return toast.error("Description is required");
    if (days.length === 0) return toast.error("Select at least one day");

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      quantity: quantityNum,
      category: category as ItemCategory,
      type,
      slot,
      days,
      image,
      tag: tag.trim() || undefined,
      live: initial?.live ?? true,
    };

    if (initial) {
      updateMenuItem(initial.id, payload);
      toast.success("Item updated");
    } else {
      createMenuItem(payload);
      toast.success("Item created");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <div className="text-lg font-bold">{initial ? "Edit Item" : "Add New Item"}</div>
          <div className="text-xs text-muted-foreground">All fields except image are required.</div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Item Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Veg Thali"
              className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field label="Price (₹) *">
            <input
              value={price}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d*\.?\d*$/.test(v)) setPrice(v);
              }}
              inputMode="decimal"
              placeholder="180"
              className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field label="Quantity to be Served *">
            <input
              value={quantity}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d*$/.test(v)) setQuantity(v);
              }}
              inputMode="numeric"
              placeholder="e.g. 50"
              className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field label="Category *">
            <CategorySelect value={category} onChange={setCategory} />
          </Field>

          <Field label="Item Type *">
            <div className="flex gap-1 rounded-md border border-border p-1">
              {(["Breakfast", "Meal"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition ${type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Display Tag (optional)">
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. POPULAR"
              className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description *">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Ingredients & preparation..."
                className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Available Days *">
              <div className="flex flex-wrap gap-2">
                {ALL_DAYS.map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted/40"}`}
                    >
                      {d}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setDays([...ALL_DAYS])}
                  className="ml-auto rounded-md px-2 py-1 text-[10px] text-primary hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setDays([])}
                  className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Item Image (optional)">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => onPickFile(e.target.files?.[0])}
                className="hidden"
              />
              {image ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-input/20 p-2">
                  <img src={image} alt="preview" className="h-16 w-16 rounded-md object-cover" />
                  <div className="flex-1 text-xs text-muted-foreground">Image selected</div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setImage(undefined)}
                    className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-[88px] w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-input/20 text-center hover:bg-input/40"
                >
                  <UploadCloud className="mb-1 h-5 w-5 text-primary" />
                  <div className="text-xs text-primary">Click to upload</div>
                  <div className="text-[10px] text-muted-foreground">PNG, JPG up to 5MB</div>
                </button>
              )}
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-md bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            {initial ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const categories = useAllCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputValue(value);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [value]);

  const isTyping = isOpen && inputValue !== value;
  const filtered = isTyping
    ? categories.filter((c) => c.toLowerCase().includes(inputValue.toLowerCase()))
    : categories;
  const exactMatch = categories.some((c) => c.toLowerCase() === inputValue.trim().toLowerCase());
  const showAdd = inputValue.trim().length > 0 && !exactMatch;

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none transition-colors focus:ring-1 focus:ring-primary"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search or add category..."
      />
      
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-md">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange(c);
                setIsOpen(false);
              }}
            >
              {c}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
              onClick={() => {
                const newCat = inputValue.trim();
                addCustomCategory(newCat);
                onChange(newCat);
                setIsOpen(false);
              }}
            >
              + Add new category "{inputValue.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showAdd && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No categories found.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
