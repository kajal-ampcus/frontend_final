import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Pencil, X, UploadCloud, Trash2 } from "lucide-react";
import { AdminLayout } from "./admin-orders";
import { formatINR } from "@/lib/store";
import { useCategories, useMenuItems } from "@/hooks/useMenu";
import type {
  ApiCategory,
  ApiMenuItem,
  CreateMenuItemPayload,
} from "@/api/menu";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-menu")({ component: AdminMenu });

type ItemType = "Breakfast" | "Meal";

function AdminMenu() {
  const {
    categories,
    isLoading: categoriesLoading,
    createCategory,
    removeCategory,
    refetch: refetchCategories,
  } = useCategories();
  const { items, isLoading, error, createItem, updateItem, removeItem, bulkImport } = useMenuItems();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ApiMenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 10;

  const tabs = useMemo(
    () => ["All", ...categories.map((c) => c.name)],
    [categories],
  );

  const visible = useMemo(() => {
    let list = items;
    if (tab !== "All") list = list.filter((i) => i.category_name === tab);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [tab, query]);

  const openAdd = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (item: ApiMenuItem) => {
    setEditing(item);
    setShowForm(true);
  };

  const remove = async (item: ApiMenuItem) => {
    if (confirm(`Delete "${item.name}"?`)) {
      await removeItem(item.id);
    }
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file.");
      return;
    }
    await bulkImport(file);
    refetchCategories();
    if (bulkFileRef.current) bulkFileRef.current.value = "";
  };

  const downloadSampleCsv = () => {
    const csv = [
      "name,base_price,max_qty_per_day,category,item_type,description,display_tag,unit,max_qty_per_order,is_available",
      "Masala Dosa,60,100,Veg,BREAKFAST,Crispy dosa with potato masala,POPULAR,plate,3,true",
      "Chicken Thali,180,50,Non-veg,MEAL,Complete meal with chicken curry,,plate,2,true",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "menu-items-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout crumb="Menu & Items">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Menu & Items Management</h1>
          <p className="text-xs text-muted-foreground">Configure your daily canteen offerings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={bulkFileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => importCsv(event.target.files?.[0])}
          />
          <button
            onClick={downloadSampleCsv}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download className="h-3 w-3" /> Sample CSV
          </button>
          <button
            onClick={() => bulkFileRef.current?.click()}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <UploadCloud className="h-3 w-3" /> Bulk Import
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> Add New Item
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-border bg-card p-1 text-xs">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-4 py-1.5 transition ${
                tab === t
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
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

      <div>
        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading menu items...
          </div>
        )}
        {error && !isLoading && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && paginatedItems.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedItems.map((it) => {
              const itemName = it.name || "Item";
              const itemCategory = it.category_name || "Unknown";
              const availabilityClass = it.is_available
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-muted text-muted-foreground";

              return (
                <article
                  key={it.id}
                  className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-36 overflow-hidden bg-muted/60">
                    {it.photo_url ? (
                      <>
                        <img
                          src={it.photo_url}
                          alt={it.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted/40 px-4 text-center text-xs font-medium text-muted-foreground transition-transform duration-500 group-hover:scale-105">
                        No image uploaded
                      </div>
                    )}
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {it.display_tag && (
                        <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                          {it.display_tag}
                        </span>
                      )}
                      <span className="rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-foreground shadow-sm">
                        {it.item_type}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold">{itemName}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <span>{itemCategory}</span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${availabilityClass}`}
                          >
                            {it.is_available ? "Available" : "Unavailable"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-base font-extrabold text-primary">
                        {formatINR(Number(it.base_price))}
                      </div>
                    </div>

                    {it.description && (
                      <p className="line-clamp-2 min-h-8 text-[11px] leading-relaxed text-muted-foreground">
                        {it.description}
                      </p>
                    )}

                    {it.slot_configs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {it.slot_configs.map((slot) => (
                          <span
                            key={slot.id}
                            className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {slot.slot_name || slot.slot_id}: {slot.quantity_per_slot}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 border-t border-border/70 pt-2">
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
                </article>
              );
            })}
          </div>
        )}

        {!isLoading && !error && paginatedItems.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No items match this filter.
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, visible.length)} of {visible.length}{" "}
              items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
                      className={`rounded-md px-3 py-1 text-xs ${
                        currentPage === pageNum
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
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <ItemFormModal
          initial={editing}
          categories={categories}
          categoriesLoading={categoriesLoading}
          createCategory={createCategory}
          removeCategory={removeCategory}
          createItem={createItem}
          updateItem={updateItem}
          onClose={() => setShowForm(false)}
        />
      )}
    </AdminLayout>
  );
}

function ItemFormModal({
  initial,
  categories,
  categoriesLoading,
  createCategory,
  removeCategory,
  createItem,
  updateItem,
  onClose,
}: {
  initial: ApiMenuItem | null;
  categories: ApiCategory[];
  categoriesLoading: boolean;
  createCategory: (name: string) => Promise<ApiCategory | null>;
  removeCategory: (id: string) => Promise<void>;
  createItem: (payload: CreateMenuItemPayload) => Promise<ApiMenuItem | null>;
  updateItem: (id: string, payload: Partial<CreateMenuItemPayload>) => Promise<ApiMenuItem | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<string>(initial ? String(initial.base_price) : "");
  const [categoryId, setCategoryId] = useState<string>(initial?.category?.id ?? "");
  const [type, setType] = useState<ItemType>(
    initial?.item_type === "BREAKFAST" ? "Breakfast" : "Meal",
  );
  const [imagePreview, setImagePreview] = useState<string | undefined>(initial?.photo_url ?? undefined);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [tag, setTag] = useState<string>(initial?.display_tag ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be <= 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setImageFile(file);
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Item name is required");
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return toast.error("Enter a valid price");
    if (!categoryId) return toast.error("Select or create a category");

    const payload: CreateMenuItemPayload = {
      name: name.trim(),
      description: description.trim(),
      base_price: priceNum,
      category_id: categoryId,
      item_type: type === "Breakfast" ? "BREAKFAST" : "MEAL",
      is_available: initial?.is_available ?? true,
      display_tag: tag.trim() || undefined,
      photo: imageFile,
    };

    let saved: ApiMenuItem | null = null;
    try {
      saved = initial ? await updateItem(initial.id, payload) : await createItem(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save item.");
      return;
    }

    if (saved) onClose();
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
          <div className="text-xs text-muted-foreground">Description and image are optional.</div>
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

          <Field label="Price (INR) *">
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

          <Field label="Category *">
            <CategorySelect
              value={categoryId}
              categories={categories}
              isLoading={categoriesLoading}
              onChange={setCategoryId}
              onCreate={createCategory}
              onRemove={removeCategory}
            />
          </Field>

          <Field label="Item Type *">
            <div className="flex gap-1 rounded-md border border-border p-1">
              {(["Breakfast", "Meal"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition ${
                    type === t
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
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
            <Field label="Description (optional)">
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
            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Base item setup stays simple here. Slot-wise quantity and limit rules are now managed
              from the Slots screen after the item is created.
            </div>
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
              {imagePreview ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-input/20 p-2">
                  <img src={imagePreview} alt="preview" className="h-16 w-16 rounded-md object-cover" />
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
                    onClick={() => {
                      setImagePreview(undefined);
                      setImageFile(undefined);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
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

function CategorySelect({
  value,
  categories,
  isLoading,
  onChange,
  onCreate,
  onRemove,
}: {
  value: string;
  categories: ApiCategory[];
  isLoading: boolean;
  onChange: (v: string) => void;
  onCreate: (name: string) => Promise<ApiCategory | null>;
  onRemove: (id: string) => Promise<void>;
}) {
  const selectedName = categories.find((c) => c.id === value)?.name ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selectedName);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(selectedName);
  }, [selectedName]);

  useEffect(() => {
    if (value) return;
    const exactMatch = categories.find(
      (category) => category.name.trim().toLowerCase() === inputValue.trim().toLowerCase(),
    );
    if (exactMatch) {
      onChange(exactMatch.id);
      setInputValue(exactMatch.name);
    }
  }, [categories, inputValue, onChange, value]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputValue(selectedName);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [selectedName]);

  const isTyping = isOpen && inputValue !== selectedName;
  const filtered = isTyping
    ? categories.filter((c) => c.name.toLowerCase().includes(inputValue.toLowerCase()))
    : categories;
  const matchingCategory = categories.find(
    (c) => c.name.toLowerCase() === inputValue.trim().toLowerCase(),
  );
  const showAdd = inputValue.trim().length > 0 && !matchingCategory && !isLoading;

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none transition-colors focus:ring-1 focus:ring-primary"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (value) onChange("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search or add category..."
      />

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-md">
          {isLoading && categories.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading categories...</div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-sm hover:bg-muted"
            >
              <button
                type="button"
                className="min-w-0 flex-1 px-2 py-1.5 text-left text-sm"
                onClick={() => {
                  onChange(c.id);
                  setInputValue(c.name);
                  setIsOpen(false);
                }}
              >
                {c.name}
              </button>
              <button
                type="button"
                className="mr-1 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${c.name}`}
                onClick={async (event) => {
                  event.stopPropagation();
                  const ok = confirm(
                    `Warning: Delete category "${c.name}"?\n\nThis category will be removed from the dropdown. Existing menu items may still keep their old category reference.`,
                  );
                  if (!ok) return;
                  await onRemove(c.id);
                  if (value === c.id) {
                    onChange("");
                    setInputValue("");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {matchingCategory && !isLoading && (
            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
              onClick={() => {
                onChange(matchingCategory.id);
                setInputValue(matchingCategory.name);
                setIsOpen(false);
              }}
            >
              Use existing category "{matchingCategory.name}"
            </button>
          )}
          {showAdd && (
            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
              onClick={async () => {
                const created = await onCreate(inputValue.trim());
                if (!created) return;
                onChange(created.id);
                setInputValue(created.name);
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
