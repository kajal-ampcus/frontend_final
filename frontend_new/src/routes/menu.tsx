import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
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
import {
  addToCart,
  formatINR,
  removeFromCart,
  updateCartQuantity,
  useCart,
  useEntities,
  type ItemCategory,
  type MenuItem,
  type Slot,
} from "@/lib/store/index";

type MenuSearch = {
  slot?: string;
};

export const Route = createFileRoute("/menu")({
  component: Menu,
  validateSearch: (search: Record<string, unknown>): MenuSearch => ({
    slot: typeof search.slot === "string" ? search.slot : undefined,
  }),
});

function Menu() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const menuItems = useEntities<MenuItem>("menuItems");
  const mealSlots = useEntities<Slot>("slots");
  const cart = useCart();
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | "All">("All");
  const [selectedSlot, setSelectedSlot] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const activeSlot = mealSlots.find((slot) => slot.status === "active") ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const defaultSlot =
      search.slot ??
      activeSlot?.name ??
      mealSlots.find((slot) => slot.status === "upcoming")?.name ??
      "All";
    setSelectedSlot(defaultSlot);
  }, [activeSlot?.name, mealSlots, search.slot]);

  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const slotById = useMemo(
    () => Object.fromEntries(mealSlots.map((slot) => [slot.id, slot])),
    [mealSlots]
  );

  const explicitSlotIdsByItemId = useMemo(
    () =>
      mealSlots.reduce<Record<string, string[]>>((acc, slot) => {
        const disabledItemIds = new Set(slot.disabledItemIds ?? []);

        (slot.menuItemIds ?? []).forEach((itemId) => {
          if (disabledItemIds.has(itemId)) return;
          if (!acc[itemId]) {
            acc[itemId] = [];
          }
          acc[itemId].push(slot.id);
        });

        return acc;
      }, {}),
    [mealSlots]
  );

  const categories: { value: ItemCategory | "All"; label: string; icon: typeof Leaf }[] = [
    { value: "All", label: "All Items", icon: Star },
    { value: "Veg", label: "Vegetarian", icon: Leaf },
    { value: "Non-Veg", label: "Non-Veg", icon: UtensilsCrossed },
    { value: "Beverages", label: "Beverages", icon: Coffee },
  ];

  const menuBySlot = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const grouped = new Map<string, { slot: Slot; items: MenuItem[] }>();

    menuItems.forEach((item) => {
      if (!item.live) return;
      if (selectedCategory !== "All" && item.category !== selectedCategory) return;
      if (normalizedQuery && !item.name.toLowerCase().includes(normalizedQuery)) return;

      const resolvedSlotIds =
        explicitSlotIdsByItemId[item.id]?.length
          ? explicitSlotIdsByItemId[item.id]
          : item.slotId
            ? [item.slotId]
            : [];

      resolvedSlotIds.forEach((slotId) => {
        const slot = slotById[slotId];
        if (!slot || slot.status === "expired") return;
        if (selectedSlot !== "All" && slot.name !== selectedSlot) return;

        if (!grouped.has(slot.id)) {
          grouped.set(slot.id, { slot, items: [] });
        }

        grouped.get(slot.id)?.items.push(item);
      });
    });

    return mealSlots
      .map((slot) => grouped.get(slot.id))
      .filter((entry): entry is { slot: Slot; items: MenuItem[] } => Boolean(entry && entry.items.length));
  }, [explicitSlotIdsByItemId, mealSlots, menuItems, searchQuery, selectedCategory, selectedSlot, slotById]);

  const addedItemKeys = useMemo(
    () => new Set(Array.from(addedItems)),
    [addedItems]
  );

  const handleAddToCart = (item: MenuItem, slotId: string) => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      slotId,
    });

    const addedKey = `${slotId}:${item.id}`;
    setAddedItems((prev) => new Set(prev).add(addedKey));
    setTimeout(() => {
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(addedKey);
        return next;
      });
    }, 1500);

    toast.success(`Added ${item.name} to cart`, {
      description: formatINR(item.price),
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
              {activeSlot ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {activeSlot.name} is open now
                  </span>
                  {" | "}Closes at {activeSlot.endTime}
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
                className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
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
            const isActive = slot.status === "active";
            const isExpired = slot.status === "expired";

            return (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(selectedSlot === slot.name ? "All" : slot.name)}
                disabled={isExpired}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  selectedSlot === slot.name
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : isActive
                      ? "border-2 border-primary bg-primary/10 text-primary"
                      : isExpired
                        ? "cursor-not-allowed border border-border bg-muted/50 text-muted-foreground opacity-60"
                        : "border border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                <SlotIcon className="h-4 w-4" />
                <span>{slot.name}</span>
                {isActive && selectedSlot !== slot.name && (
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

        {activeSlot && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <Clock className="h-5 w-5 text-primary" />
            <p className="text-sm">
              <span className="font-semibold text-primary">Ordering Tip:</span> Orders should be placed before the slot closes.
            </p>
          </div>
        )}

        {menuBySlot.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">No items found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try changing the slot, category, or search.</p>
          </div>
        ) : (
          menuBySlot.map(({ slot, items }) => (
            <div key={slot.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  {(() => {
                    const SlotIcon = getSlotIcon(slot.name);
                    return <SlotIcon className="h-4 w-4" />;
                  })()}
                </div>
                <h2 className="text-lg font-bold">{slot.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {items.length} items
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, index) => {
                  const quantity = getCartItemQty(item.id, slot.id);
                  const isAdded = addedItemKeys.has(`${slot.id}:${item.id}`);

                  return (
                    <div
                      key={`${slot.id}:${item.id}`}
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
                          {item.tag && (
                            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-lg">
                              {item.tag}
                            </span>
                          )}
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${getCategoryColor(item.category)}`}>
                            {item.category === "Veg" ? (
                              <Leaf className="h-3 w-3 text-white" />
                            ) : item.category === "Beverages" ? (
                              <Coffee className="h-3 w-3 text-white" />
                            ) : (
                              <UtensilsCrossed className="h-3 w-3 text-white" />
                            )}
                          </span>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                          <h3 className="font-semibold text-white">{item.name}</h3>
                          <span className="rounded-lg bg-white/20 px-3 py-1 text-lg font-bold text-white backdrop-blur-sm">
                            {formatINR(item.price)}
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>

                        <div className="mt-4">
                          {quantity > 0 ? (
                            <div className="flex items-center justify-between rounded-xl bg-primary/10 p-1">
                              <button
                                onClick={() => {
                                  const nextQuantity = quantity - 1;
                                  if (nextQuantity <= 0) {
                                    removeFromCart(item.id, slot.id);
                                  } else {
                                    updateCartQuantity(item.id, nextQuantity, slot.id);
                                  }
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary shadow-sm transition-colors hover:bg-primary hover:text-white"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="text-lg font-bold text-primary">{quantity}</span>
                              <button
                                onClick={() => handleAddToCart(item, slot.id)}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary/90"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(item, slot.id)}
                              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                                isAdded
                                  ? "bg-emerald-600 text-white"
                                  : "bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-primary/40"
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="h-4 w-4" />
                                  Added!
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4" />
                                  Add to Cart
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}

function getSlotIcon(slot: string) {
  const normalized = slot.toLowerCase();
  if (normalized.includes("breakfast")) return Sunrise;
  if (normalized.includes("lunch")) return Sun;
  if (normalized.includes("snack")) return Coffee;
  return Moon;
}

function getCategoryColor(category: ItemCategory) {
  switch (category) {
    case "Veg":
      return "bg-emerald-500";
    case "Non-Veg":
      return "bg-red-500";
    case "Beverages":
      return "bg-blue-500";
    default:
      return "bg-primary";
  }
}
