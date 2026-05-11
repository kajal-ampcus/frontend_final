import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Clock,
  Coffee,
  Flame,
  Leaf,
  Moon,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sun,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { fetchAllAnnouncements, type Announcement as RemoteAnnouncement } from "@/api/announcementApi";
import { fetchEmployeeMenu, fetchEmployeeOrders } from "@/api/employeeOrders";
import { fetchEmployeeWallet } from "@/api/wallet";
import { AppLayout } from "@/components/AppLayout";
import {
  addToCart,
  formatINR,
  formatTimeRange,
  useCart,
  useCurrentCustomer,
  type Announcement,
  type MenuItem,
  type Order,
  type Slot,
} from "@/lib/store";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const ACTIVE_ORDER_STATUSES: Order["status"][] = ["pending", "accepted", "preparing", "ready"];

function Dashboard() {
  const navigate = useNavigate();
  const cart = useCart();
  const currentCustomer = useCurrentCustomer();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [mealSlots, setMealSlots] = useState<Slot[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [remoteWalletBalance, setRemoteWalletBalance] = useState<number | null>(null);

  const user = getCurrentUser();
  const walletBalance = remoteWalletBalance ?? currentCustomer?.walletBalance ?? 0;
  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const userOrders = orders;

  const todayString = currentTime.toISOString().slice(0, 10);
  const todaysAnnouncements = announcements.filter(
    (announcement) => announcement.active && announcement.date === todayString
  );

  const availableSlots = useMemo(
    () => mealSlots.filter((slot) => slot.status !== "expired"),
    [mealSlots]
  );
  const selectedSlot = mealSlots.find((slot) => slot.id === selectedSlotId) ?? null;

  const activeOrdersForSlot = useMemo(
    () =>
      userOrders.filter(
        (order) => order.slotId === selectedSlot?.id && ACTIVE_ORDER_STATUSES.includes(order.status)
      ),
    [selectedSlot?.id, userOrders]
  );

  const activeOrder = activeOrdersForSlot.find((order) => order.id === selectedOrderId) ?? null;

  const currentMonth = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();
  const stats = {
    totalOrders: userOrders.length,
    completedOrders: userOrders.filter((order) => order.status === "completed" || order.status === "delivered").length,
    cancelledOrders: userOrders.filter((order) => order.status === "cancelled").length,
    monthlySpending: userOrders
      .filter((order) => {
        const createdAt = new Date(order.createdAt);
        return (
          order.status !== "cancelled" &&
          createdAt.getMonth() === currentMonth &&
          createdAt.getFullYear() === currentYear
        );
      })
      .reduce((sum, order) => sum + (order.total ?? 0), 0),
  };

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetchEmployeeMenu(),
      fetchEmployeeOrders(),
      fetchEmployeeWallet(),
      fetchAllAnnouncements().catch(() => []),
    ])
      .then(([menu, orderList, wallet, announcementList]) => {
        if (ignore) return;
        setMenuItems(menu.items);
        setMealSlots(menu.slots);
        setOrders(orderList);
        setRemoteWalletBalance(wallet.balance);
        setAnnouncements(announcementList.map(toDashboardAnnouncement));
      })
      .catch(() => {
        if (!ignore) toast.error("Could not load dashboard data.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const currentActive = mealSlots.find((slot) => slot.status === "active");
    if (currentActive) {
      setSelectedSlotId((prev) => prev ?? currentActive.id);
      return;
    }

    if (availableSlots.length > 0) {
      setSelectedSlotId((prev) => prev ?? availableSlots[0].id);
    }
  }, [availableSlots, mealSlots]);

  useEffect(() => {
    if (activeOrdersForSlot.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    const hasSelectedOrder = activeOrdersForSlot.some((order) => order.id === selectedOrderId);
    if (!hasSelectedOrder) {
      setSelectedOrderId(activeOrdersForSlot[0].id);
    }
  }, [activeOrdersForSlot, selectedOrderId]);

  const greeting = getGreeting(currentTime);
  const activeOrderSteps = activeOrder ? getStatusSteps(activeOrder.status) : [];

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

  const topOrderedItems = useMemo(() => {
    const grouped = userOrders
      .filter((order) => order.status !== "cancelled")
      .reduce<
        Record<
          string,
          {
            menuItemId: string;
            name: string;
            quantity: number;
            orders: number;
            total: number;
          }
        >
      >((acc, order) => {
        order.items.forEach((item) => {
          if (!item.menuItemId) return;
          if (!acc[item.menuItemId]) {
            acc[item.menuItemId] = {
              menuItemId: item.menuItemId,
              name: item.name ?? "Meal",
              quantity: 0,
              orders: 0,
              total: 0,
            };
          }

          acc[item.menuItemId].quantity += item.quantity ?? 0;
          acc[item.menuItemId].orders += 1;
          acc[item.menuItemId].total +=
            item.totalPrice ?? (item.unitPrice ?? item.price ?? 0) * (item.quantity ?? 0);
        });

        return acc;
      }, {});

    return Object.values(grouped)
      .map((entry) => {
        const menuItem = menuItems.find((item) => item.id === entry.menuItemId) ?? null;
        const slot = resolveMenuItemSlot(menuItem, explicitSlotIdsByItemId, slotById, availableSlots);

        return {
          ...entry,
          menuItem,
          slot,
        };
      })
      .sort((a, b) => b.quantity - a.quantity || b.orders - a.orders)
      .slice(0, 4);
  }, [availableSlots, explicitSlotIdsByItemId, menuItems, slotById, userOrders]);

  const handleQuickAdd = (menuItem: MenuItem, slot: Slot | null) => {
    if (!slot) {
      toast.error("No live slot available for this item right now.");
      return;
    }

    addToCart({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1,
      slotId: slot.id,
    });

    toast.success(`Added ${menuItem.name} to cart`, {
      description: `${slot.name} - ${formatINR(menuItem.price)}`,
      duration: 1800,
    });
  };

  return (
    <AppLayout>
      <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
        <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#f46a00_0%,#ff8611_60%,#ffb11e_100%)] p-6 text-white shadow-[0_24px_60px_rgba(244,106,0,0.22)] sm:p-8">
          <div className="absolute -left-20 bottom-[-5rem] h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute right-[-3rem] top-[-3rem] h-44 w-44 rounded-full bg-white/12" />
          <div className="absolute right-20 top-16 h-20 w-20 rounded-full bg-white/10" />

          <div className="relative max-w-4xl">
            <div className="flex items-center gap-2 text-white/85">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Welcome back!</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              {greeting}, {user?.name?.split(" ")[0] ?? "Guest"}!
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/90">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDate(currentTime)}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {formatTime(currentTime)}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate({ to: "/menu" })}
                className="flex items-center gap-2 rounded-xl bg-white/18 px-5 py-3 text-sm font-semibold backdrop-blur-sm transition-all hover:bg-white/28 active:scale-95"
              >
                <UtensilsCrossed className="h-4 w-4" />
                Order Now
                <ChevronRight className="h-4 w-4" />
              </button>

              {cartCount > 0 && (
                <button
                  onClick={() => navigate({ to: "/cart" })}
                  className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-lg transition-all hover:bg-white/90 active:scale-95"
                >
                  <ShoppingCart className="h-4 w-4" />
                  View Cart
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">
                    {cartCount}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="rounded-[28px] border border-[#eadfce] bg-[linear-gradient(180deg,#fffdf9_0%,#fff8ef_100%)] p-6 shadow-[0_20px_45px_rgba(44,25,7,0.08)] dark:border-[#4a2f1e] dark:bg-[linear-gradient(180deg,#241710_0%,#17100b_100%)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#c67828]">
                  Active Order
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#2b1b10] dark:text-[#fff6ea]">Track your current meal</h2>
                <p className="mt-1 text-sm text-[#7f6953] dark:text-[#cdb39b]">
                  Follow the order from counter placement to final handoff.
                </p>
              </div>
              <button
                onClick={() => navigate({ to: "/orders" })}
                className="hidden items-center gap-2 rounded-xl border border-[#e9d7c0] bg-white px-4 py-2 text-sm font-semibold text-[#bf6310] transition hover:border-[#d88b42] hover:bg-[#fff7ee] dark:border-[#5a3924] dark:bg-[#20140f] dark:text-[#ffb467] dark:hover:border-[#c8792c] dark:hover:bg-[#2a1a13] sm:flex"
              >
                View Details
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-2">
              {availableSlots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const isActive = slot.status === "active";

                return (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      isSelected
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/15 dark:text-[#ffb467] dark:hover:bg-primary/25"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:bg-[#221712] dark:text-[#c3a88d] dark:hover:bg-[#2b1d16] dark:hover:text-[#fff1df]"
                    }`}
                  >
                    {slot.name}
                    {isActive && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500" />}
                  </button>
                );
              })}
            </div>

            {activeOrdersForSlot.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e5d8c6] bg-white/75 py-12 text-center dark:border-[#4e3120] dark:bg-[#201510]/80">
                <p className="text-sm font-medium text-muted-foreground">No active orders for this slot yet.</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#efe2d3] bg-white/70 p-4 dark:border-[#4f3221] dark:bg-[#211611]/85 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Select Order
                    </label>
                    <select
                      value={selectedOrderId ?? ""}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-[#533525] dark:bg-[#120d0a] dark:text-[#fff2e3] sm:max-w-md"
                    >
                      {activeOrdersForSlot.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} - {order.items.map((item) => item.name).join(", ")} - {formatINR(order.total ?? 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => navigate({ to: "/orders" })}
                    className="flex items-center gap-1 text-sm font-semibold text-[#d46f16] hover:underline dark:text-[#ffb467]"
                  >
                    View Details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {activeOrder && (
                  <div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-[#fff0de] px-3 py-1 text-xs font-semibold text-[#d46f16] dark:bg-[#3d2416] dark:text-[#ffb467]">
                          {getDisplayStatusLabel(activeOrder.status).toUpperCase()}
                        </span>
                        <p className="text-sm font-medium text-[#7f6953] dark:text-[#cdb39b]">ID: {activeOrder.orderNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-[#c7610e] dark:text-[#ffb467]">{formatINR(activeOrder.total ?? 0)}</p>
                        <p className="text-xs text-[#907761] dark:text-[#b89a80]">
                          {activeOrder.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_220px]">
                      <div className="rounded-[26px] border border-[#ecdcca] bg-white p-5 dark:border-[#513424] dark:bg-[#1f1410]">
                        <div className="flex items-center justify-between">
                          {activeOrderSteps.map((step, index) => {
                            const StepIcon = step.icon;

                            return (
                              <div key={step.label} className="flex flex-1 items-center">
                                <div className="flex flex-col items-center gap-2">
                                  <div
                                    className={`flex h-12 w-12 items-center justify-center rounded-full border-4 transition-all duration-500 ${
                                      step.current
                                        ? "scale-105 border-[#ffd3a4] bg-primary text-white"
                                        : step.done
                                          ? "border-[#ffd6b4] bg-[#f5a45f] text-white"
                                          : "border-[#f0e6db] bg-[#f6f0e8] text-[#ab947f] dark:border-[#4f3323] dark:bg-[#291c15] dark:text-[#9b826b]"
                                    }`}
                                  >
                                    <StepIcon className="h-4 w-4" />
                                  </div>
                                  <span className={`text-center text-xs font-medium ${step.current ? "text-primary dark:text-[#ffb467]" : "text-[#7f6953] dark:text-[#cdb39b]"}`}>
                                    {step.label}
                                  </span>
                                </div>
                                {index < activeOrderSteps.length - 1 && (
                                  <div className={`mx-2 h-1.5 flex-1 rounded-full ${step.done ? "bg-primary" : "bg-[#eee5da] dark:bg-[#3f2b20]"}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-[#ecdcca] bg-[linear-gradient(180deg,#fff8ef_0%,#fffefb_100%)] p-5 dark:border-[#513424] dark:bg-[linear-gradient(180deg,#22160f_0%,#17100b_100%)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b9844c] dark:text-[#d5a26c]">
                          Order Summary
                        </p>
                        <div className="mt-4 space-y-3">
                          {activeOrder.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 border-b border-[#f3e6d7] pb-3 last:border-b-0 last:pb-0 dark:border-[#3e2a1f]"
                            >
                              <div>
                                <p className="font-semibold text-[#2b1b10] dark:text-[#fff3e5]">{item.name}</p>
                                <p className="mt-1 text-xs text-[#907761] dark:text-[#b89a80]">{item.quantity} item(s)</p>
                              </div>
                              <span className="text-sm font-semibold text-[#c7610e] dark:text-[#ffb467]">
                                {formatINR((item.unitPrice ?? item.price ?? 0) * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4">
            <StatCard
              icon={Wallet}
              label="Wallet Balance"
              value={formatINR(walletBalance)}
              color="from-emerald-500 to-teal-600"
              trend="Available now"
            />
            <StatCard
              icon={ShoppingBag}
              label="Orders This Month"
              value={stats.totalOrders.toString()}
              color="from-blue-500 to-indigo-600"
              trend={`${stats.completedOrders} completed`}
            />
            <StatCard
              icon={TrendingUp}
              label="Monthly Spending"
              value={formatINR(stats.monthlySpending)}
              color="from-violet-500 to-fuchsia-600"
              trend={`${stats.cancelledOrders} cancelled`}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#37231a] dark:bg-[#16100d]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                  Quick Reorder
                </p>
                <h2 className="mt-2 text-xl font-bold">Most Ordered By You</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reorder your frequent meals in one tap.
                </p>
              </div>
              <button
                onClick={() => navigate({ to: "/menu" })}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted dark:border-[#4a2f22] dark:bg-[#1d1511] dark:hover:bg-[#2a1d16]"
              >
                Browse Menu
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {topOrderedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center dark:border-[#453024] dark:bg-[#211712]/70">
                <Flame className="mx-auto h-10 w-10 text-muted-foreground/60" />
                <h3 className="mt-4 font-semibold">Your favorites will appear here</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Order a few meals and we will surface your most frequent picks.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {topOrderedItems.map((entry) => {
                  const item = entry.menuItem;
                  const isAvailable = Boolean(item && item.available && entry.slot);

                  return (
                    <div
                      key={entry.menuItemId}
                      className="rounded-[24px] border border-[#ecdcca] bg-[linear-gradient(180deg,#fffdf9_0%,#fff7ee_100%)] p-5 dark:border-[#4f3222] dark:bg-[linear-gradient(180deg,#22150f_0%,#18110c_100%)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                              #{entry.quantity}
                            </span>
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              {entry.orders} orders
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-[#26170d] dark:text-[#fff3e5]">{item?.name ?? entry.name}</h3>
                          <p className="mt-1 text-sm text-[#7f6953] dark:text-[#cdb39b]">
                            {item?.description ?? "One of your top repeated meals from previous orders."}
                          </p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary shadow-sm dark:bg-[#2a1d16]">
                          {item?.category === "Veg" ? (
                            <Leaf className="h-5 w-5" />
                          ) : (
                            <UtensilsCrossed className="h-5 w-5" />
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-3 py-1 text-[#8f7359] shadow-sm dark:bg-[#2a1d16] dark:text-[#ccb097]">
                          {item?.category ?? "Popular"}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[#8f7359] shadow-sm dark:bg-[#2a1d16] dark:text-[#ccb097]">
                          {entry.slot?.name ?? "Slot unavailable"}
                        </span>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold text-[#c7610e] dark:text-[#ffb467]">
                            {formatINR(item?.price ?? entry.total / Math.max(entry.quantity, 1))}
                          </p>
                          <p className="mt-1 text-xs text-[#907761] dark:text-[#b89a80]">Ordered {entry.quantity} time(s)</p>
                        </div>
                        <button
                          onClick={() => item && handleQuickAdd(item, entry.slot)}
                          disabled={!item || !isAvailable}
                          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                            isAvailable
                              ? "bg-primary text-white shadow-lg shadow-primary/25 hover:bg-primary/90"
                              : "cursor-not-allowed bg-muted text-muted-foreground"
                          }`}
                        >
                          {isAvailable ? "Add Again" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {todaysAnnouncements.length > 0 && (
              <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#37231a] dark:bg-[#16100d]">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                      Updates
                    </p>
                    <h2 className="mt-2 text-xl font-bold">Today's Announcement</h2>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:bg-primary/15 dark:text-[#ffb467]">
                    {todaysAnnouncements.length} active
                  </div>
                </div>
                <div className="space-y-4">
                  {todaysAnnouncements.map((announcement) => (
                    <div key={announcement.id} className="rounded-2xl border border-border bg-slate-50 p-4 dark:border-[#493024] dark:bg-[#221712]">
                      <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>{announcement.title}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{announcement.message}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
                        <span className="rounded-full bg-muted px-3 py-1 dark:bg-[#2c1d16]">
                          {announcement.fromTime} - {announcement.toTime}
                        </span>
                        {announcement.specialDish && (
                          <span className="rounded-full bg-muted px-3 py-1 dark:bg-[#2c1d16]">
                            Special dish: {announcement.specialDish}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#37231a] dark:bg-[#16100d]">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                  Available Slots
                </p>
                <h2 className="mt-2 text-xl font-bold">Order By Meal Window</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jump into the right slot and order faster.
                </p>
              </div>

              <div className="grid gap-4">
                {mealSlots.map((slot) => {
                  const SlotIcon = getSlotIcon(slot.name);
                  const isActive = slot.status === "active";
                  const isExpired = slot.status === "expired";

                  return (
                    <div
                      key={slot.id}
                      className={`rounded-[24px] border p-4 transition-all duration-300 ${
                        isActive
                          ? "border-primary/30 bg-primary/5 shadow-md shadow-primary/10 dark:border-primary/20 dark:bg-primary/10"
                        : isExpired
                            ? "border-border bg-muted/30 dark:border-[#433027] dark:bg-[#221712]"
                            : "border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-black/5 dark:border-[#433027] dark:bg-[#1b1310] dark:hover:border-[#8e5a2d] dark:hover:shadow-black/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                              isActive
                                ? "bg-primary text-white"
                                : isExpired
                                  ? "bg-muted text-muted-foreground dark:bg-[#2c1d16]"
                                  : "bg-info/15 text-info dark:bg-info/20"
                            }`}
                          >
                            <SlotIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold dark:text-[#fff3e5]">{slot.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatTimeRange(slot.startTime, slot.endTime)}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            isActive
                              ? "bg-primary text-white"
                              : isExpired
                                ? "bg-muted text-muted-foreground dark:bg-[#2c1d16]"
                                : "bg-info/15 text-info dark:bg-info/20"
                          }`}
                        >
                          {isActive ? "OPEN NOW" : isExpired ? "CLOSED" : "UPCOMING"}
                        </span>
                      </div>

                      <button
                        onClick={() => !isExpired && navigate({ to: "/menu", search: { slot: slot.name } })}
                        disabled={isExpired}
                        className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                          isActive
                            ? "bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90"
                            : isExpired
                              ? "cursor-not-allowed bg-muted text-muted-foreground dark:bg-[#2c1d16]"
                              : "border border-border bg-card text-foreground hover:bg-muted dark:border-[#4a2f22] dark:bg-[#1d1511] dark:hover:bg-[#2a1d16]"
                        }`}
                      >
                        {isActive ? "Order In This Slot" : isExpired ? "Slot Closed" : "Plan This Slot"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function getGreeting(currentTime: Date): string {
  const hour = currentTime.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(currentTime: Date): string {
  return currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(currentTime: Date): string {
  return currentTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getSlotIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("morning") || normalized.includes("tea") || normalized.includes("breakfast")) return Coffee;
  if (normalized.includes("lunch")) return Sun;
  if (normalized.includes("snack")) return Utensils;
  return Moon;
}

function getStatusSteps(status: Order["status"]) {
  const stepLabels: Array<{
    key: string;
    label: string;
    icon: typeof Receipt;
  }> = [
    { key: "placed", label: "Placed", icon: Receipt },
    { key: "preparing", label: "Preparing", icon: UtensilsCrossed },
    { key: "ready", label: "Ready to Pick", icon: Package },
    { key: "delivered", label: "Delivered", icon: ShoppingBag },
  ];

  const normalizedStatus =
    status === "pending" || status === "accepted"
      ? "placed"
      : status === "delivered" || status === "completed" || status === "collected"
        ? "delivered"
        : status;
  const currentIndex = stepLabels.findIndex((step) => step.key === normalizedStatus);

  return stepLabels.map((step, index) => ({
    ...step,
    done: index < currentIndex,
    current: index === currentIndex,
  }));
}

function getDisplayStatusLabel(status: Order["status"]) {
  switch (status) {
    case "pending":
    case "accepted":
      return "Placed";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready to Pick";
    case "delivered":
    case "completed":
    case "collected":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function resolveMenuItemSlot(
  item: MenuItem | null,
  explicitSlotIdsByItemId: Record<string, string[]>,
  slotById: Record<string, Slot>,
  availableSlots: Slot[]
) {
  if (!item) return null;

  const explicitSlotIds = explicitSlotIdsByItemId[item.id] ?? [];
  const fromExplicit = explicitSlotIds
    .map((slotId) => slotById[slotId])
    .find((slot) => slot && slot.status !== "expired");

  if (fromExplicit) return fromExplicit;

  const fromNamedSlot = availableSlots.find((slot) => slot.name === item.slot);
  if (fromNamedSlot) return fromNamedSlot;

  return availableSlots[0] ?? null;
}

function toDashboardAnnouncement(announcement: RemoteAnnouncement): Announcement {
  return {
    id: String(announcement.id),
    title: announcement.title,
    message: announcement.message,
    date: announcement.date,
    fromTime: announcement.fromTime,
    toTime: announcement.toTime,
    specialDish: announcement.specialDish,
    active: announcement.active,
    createdAt: announcement.createdAt,
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  trend,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  color: string;
  trend?: string;
}) {
  return (
    <div className="group flex items-center gap-4 rounded-[24px] border border-border bg-card p-5 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:border-[#37231a] dark:bg-[#1b1310] dark:hover:shadow-black/20">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg transition-transform group-hover:scale-110`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold">{value}</p>
        {trend && <p className="mt-0.5 text-xs text-muted-foreground">{trend}</p>}
      </div>
    </div>
  );
}
