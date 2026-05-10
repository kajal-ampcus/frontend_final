import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Coffee,
  Leaf,
  Minus,
  Moon,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Sun,
  Sunrise,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAvailableSlots, useSlotMenu, type SlotMenuItem } from "@/hooks/useCanteen";
import { addToCart, formatINR, removeFromCart, updateCartQuantity, useCart } from "@/lib/store/index";

type MenuSearch = {
  slot?: string;
};

type MenuCategoryFilter = "All" | "Veg" | "Non-Veg" | "Vegan" | "Egg";

export const Route = createFileRoute("/menu")({
  component: Menu,
  validateSearch: (search: Record<string, unknown>): MenuSearch => ({
    slot: typeof search.slot === "string" ? search.slot : undefined,
  }),
});

function Menu() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: mealSlots = [] } = useAvailableSlots();
  const cart = useCart();
  const [selectedCategory, setSelectedCategory] = useState<MenuCategoryFilter>("All");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  const selectedSlot = useMemo(() => {
    if (!mealSlots.length) return null;
    return mealSlots.find((slot) => slot.id === selectedSlotId) ?? mealSlots[0];
  }, [mealSlots, selectedSlotId]);

  const { data: slotMenu = [] } = useSlotMenu(selectedSlot?.id ?? null, selectedSlot?.canteen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mealSlots.length) {
      setSelectedSlotId(null);
      return;
    }

    const preferred =
      mealSlots.find((slot) => slot.id === search.slot) ??
      mealSlots.find((slot) => slot.name === search.slot) ??
      mealSlots.find((slot) => slot.is_ordering_open) ??
      mealSlots[0];

    setSelectedSlotId((prev) => prev ?? preferred?.id ?? null);
  }, [mealSlots, search.slot]);

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const categories = useMemo(() => {
    const available = new Set<MenuCategoryFilter>(["All"]);
    slotMenu.forEach((item) => available.add(getCategoryLabel(item)));

    const ordered: MenuCategoryFilter[] = ["All", "Veg", "Non-Veg", "Vegan", "Egg"];
    const icons: Record<MenuCategoryFilter, typeof Leaf> = {
      All: Star,
      Veg: Leaf,
      "Non-Veg": UtensilsCrossed,
      Vegan: Leaf,
      Egg: UtensilsCrossed,
    };

    return ordered
      .filter((value) => available.has(value))
      .map((value) => ({ value, label: value === "All" ? "All Items" : value, icon: icons[value] }));
  }, [slotMenu]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return slotMenu.filter((item) => {
      if (!item.is_available) return false;
      if (selectedCategory !== "All" && getCategoryLabel(item) !== selectedCategory) return false;
      if (!normalizedQuery) return true;

      const searchableText = [item.name, item.description, item.category_name].join(" ").toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [searchQuery, selectedCategory, slotMenu]);

  const handleAddToCart = (item: SlotMenuItem, slotId: string) => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.effective_price ?? item.price ?? 0),
      quantity: 1,
      slotId,
    });

    toast.success(`Added ${item.name} to cart`, {
      description: formatINR(Number(item.effective_price ?? item.price ?? 0)),
      duration: 1800,
    });
  };

  const getCartItemQty = (itemId: string, slotId: string) =>
    cart.items.find((item) => item.menuItemId === itemId && item.slotId === slotId)?.quantity ?? 0;

  return (
    <AppLayout title="Menu">
      <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Today's Menu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedSlot ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <span className={`h-2 w-2 rounded-full ${selectedSlot.is_ordering_open ? "animate-pulse bg-primary" : "bg-muted-foreground"}`} />
                    {selectedSlot.name}
                  </span>
                  {" | "}Order window {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
                </>
              ) : (
                "Check available slots for ordering"
              )}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {cartCount > 0 && (
              <button
                onClick={() => navigate({ to: "/cart" })}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>View Cart</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-primary">
                  {cartCount}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
          {mealSlots.map((slot) => {
            const SlotIcon = getSlotIcon(slot.name);
            const isSelected = selectedSlot?.id === slot.id;

            return (
              <button
                key={slot.id}
                onClick={() => setSelectedSlotId(slot.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : slot.is_ordering_open
                      ? "border-2 border-primary bg-primary/10 text-primary"
                      : "border border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                <SlotIcon className="h-4 w-4" />
                <span>{slot.name}</span>
                {slot.is_ordering_open && !isSelected && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                selectedCategory === category.value
                  ? "bg-primary text-white shadow-md"
                  : "border border-border bg-card hover:bg-muted"
              }`}
            >
              <category.icon className="h-4 w-4" />
              {category.label}
            </button>
          ))}
        </div>

        {selectedSlot && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <Clock className="h-5 w-5 text-primary" />
            <p className="text-sm">
              <span className="font-semibold text-primary">Ordering Tip:</span> This slot closes at{" "}
              {formatTime(selectedSlot.ordering_deadline_time || selectedSlot.end_time)}.
            </p>
          </div>
        )}

        {!selectedSlot ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">No slots available</h3>
            <p className="mt-1 text-sm text-muted-foreground">Ask the admin to configure menu slots first.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">No items found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try changing the category or search.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                {(() => {
                  const SlotIcon = getSlotIcon(selectedSlot.name);
                  return <SlotIcon className="h-4 w-4" />;
                })()}
              </div>
              <h2 className="text-lg font-bold">{selectedSlot.name}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {filteredItems.length} items
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item, index) => {
                const quantity = getCartItemQty(item.id, selectedSlot.id);
                const price = Number(item.effective_price ?? item.price ?? 0);

                return (
                  <div
                    key={`${selectedSlot.id}:${item.id}`}
                    className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={item.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                        {item.category_name && (
                          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                            {item.category_name}
                          </span>
                        )}
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${getCategoryColor(getCategoryLabel(item))}`}>
                          {getCategoryLabel(item) === "Veg" || getCategoryLabel(item) === "Vegan" ? (
                            <Leaf className="h-3 w-3 text-white" />
                          ) : (
                            <UtensilsCrossed className="h-3 w-3 text-white" />
                          )}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                        <h3 className="font-semibold text-white">{item.name}</h3>
                        <span className="rounded-lg bg-white/20 px-3 py-1 text-lg font-bold text-white backdrop-blur-sm">
                          {formatINR(price)}
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="line-clamp-2 text-sm text-muted-foreground">{item.description || "Freshly prepared for this slot."}</p>

                      <div className="mt-4">
                        {quantity > 0 ? (
                          <div className="flex items-center justify-between rounded-xl bg-primary/10 p-1">
                            <button
                              onClick={() => {
                                const nextQuantity = quantity - 1;
                                if (nextQuantity <= 0) {
                                  removeFromCart(item.id, selectedSlot.id);
                                } else {
                                  updateCartQuantity(item.id, nextQuantity, selectedSlot.id);
                                }
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary shadow-sm transition-colors hover:bg-primary hover:text-white"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="text-lg font-bold text-primary">{quantity}</span>
                            <button
                              onClick={() => handleAddToCart(item, selectedSlot.id)}
                              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary/90"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(item, selectedSlot.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/40"
                          >
                            <Plus className="h-4 w-4" />
                            Add to Cart
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function getSlotIcon(slot: string) {
  const normalized = slot.toLowerCase();
  if (normalized.includes("breakfast")) return Sunrise;
  if (normalized.includes("lunch")) return Sun;
  if (normalized.includes("snack") || normalized.includes("tea")) return Coffee;
  return Moon;
}

function getCategoryLabel(item: SlotMenuItem): MenuCategoryFilter {
  if (item.item_type === "VEGAN") return "Vegan";
  if (item.item_type === "NON_VEG") return "Non-Veg";
  if (item.item_type === "EGG") return "Egg";
  return "Veg";
}

function getCategoryColor(category: MenuCategoryFilter) {
  switch (category) {
    case "Veg":
    case "Vegan":
      return "bg-emerald-500";
    case "Non-Veg":
      return "bg-red-500";
    case "Egg":
      return "bg-amber-500";
    default:
      return "bg-primary";
  }
}

function formatTime(value: string) {
  const [hour = "00", minute = "00"] = value.split(":");
  const parsed = new Date();
  parsed.setHours(Number(hour), Number(minute), 0, 0);
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
