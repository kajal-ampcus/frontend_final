import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  Moon,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sun,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  formatINR,
  useCart,
  useCurrentCustomer,
  useEntities,
  type Announcement,
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
  const mealSlots = useEntities<Slot>("slots");
  const announcements = useEntities<Announcement>("announcements");
  const orders = useEntities<Order>("orders");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const user = getCurrentUser();
  const walletBalance = currentCustomer?.walletBalance ?? 0;
  const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const userOrders = currentCustomer
    ? orders.filter((order) => order.customerId === currentCustomer.id)
    : [];

  const todayString = currentTime.toISOString().slice(0, 10);
  const todaysAnnouncements = announcements.filter(
    (announcement) => announcement.active && announcement.date === todayString
  );

  const availableSlots = mealSlots.filter((slot) => slot.status !== "expired");
  const selectedSlot = mealSlots.find((slot) => slot.id === selectedSlotId) ?? null;

  const activeOrdersForSlot = userOrders.filter(
    (order) => order.slotId === selectedSlot?.id && ACTIVE_ORDER_STATUSES.includes(order.status)
  );

  const activeOrder = activeOrdersForSlot.find((order) => order.id === selectedOrderId) ?? null;

  const currentMonth = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();
  const stats = {
    totalOrders: userOrders.length,
    completedOrders: userOrders.filter((order) => order.status === "completed").length,
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
      .reduce((sum, order) => sum + order.total, 0),
  };

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
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

  return (
    <AppLayout>
      <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-6 text-white shadow-xl shadow-primary/25">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/5" />
            <div className="absolute right-12 top-12 h-16 w-16 rounded-full bg-white/10" />

            <div className="relative">
              <div className="flex items-center gap-2 text-white/80">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Welcome back!</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold">
                {greeting}, {user?.name?.split(" ")[0] ?? "Guest"}!
              </h1>
              <div className="mt-3 flex items-center gap-3 text-sm text-white/90">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(currentTime)}
                </div>
                <span className="text-white/50">|</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatTime(currentTime)}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate({ to: "/menu" })}
                  className="flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Order Now
                  <ChevronRight className="h-4 w-4" />
                </button>

                {cartCount > 0 && (
                  <button
                    onClick={() => navigate({ to: "/cart" })}
                    className="flex items-center gap-3 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-primary shadow-lg transition-all hover:bg-white/90 active:scale-95"
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
          </div>

          <div className="grid gap-3">
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
              color="from-violet-500 to-purple-600"
              trend={`${stats.cancelledOrders} cancelled`}
            />
          </div>
        </div>

        {todaysAnnouncements.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Today's Announcement</h2>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {todaysAnnouncements.length} active
              </div>
            </div>
            <div className="space-y-4">
              {todaysAnnouncements.map((announcement) => (
                <div key={announcement.id} className="rounded-3xl border border-border bg-slate-50 p-4 dark:bg-slate-950">
                  <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>{announcement.title}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{announcement.message}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
                    <span className="rounded-full bg-muted px-3 py-1">
                      Slot: {mealSlots.find((slot) => slot.id === announcement.slotId)?.name ?? "All Day"}
                    </span>
                    {announcement.specialDish && (
                      <span className="rounded-full bg-muted px-3 py-1">
                        Special dish: {announcement.specialDish}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="mb-4 text-lg font-bold">Active Orders</h2>

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
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {slot.name}
                    {isActive && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                  </button>
                );
              })}
            </div>

            {activeOrdersForSlot.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">No active orders for this slot yet.</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-col gap-4 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Select Order
                    </label>
                    <select
                      value={selectedOrderId ?? ""}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:max-w-md"
                    >
                      {activeOrdersForSlot.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} - {order.items.map((item) => item.name).join(", ")} - {formatINR(order.total)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => navigate({ to: "/orders" })}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View Details <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {activeOrder && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                          {activeOrder.status.toUpperCase()}
                        </span>
                        <p className="text-sm font-medium text-muted-foreground">ID: {activeOrder.orderNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {activeOrderSteps.map((step, index) => (
                        <div key={step.label} className="flex flex-1 items-center">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-500 ${
                                step.current
                                  ? "scale-110 bg-primary text-white ring-4 ring-primary/20"
                                  : step.done
                                    ? "bg-primary text-white"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {step.current ? <UtensilsCrossed className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </div>
                            <span className={`text-xs font-medium ${step.current ? "text-primary" : "text-muted-foreground"}`}>
                              {step.label}
                            </span>
                          </div>
                          {index < activeOrderSteps.length - 1 && (
                            <div className={`mx-2 h-1 flex-1 rounded-full ${step.done ? "bg-primary" : "bg-muted"}`} />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between rounded-xl bg-muted/50 p-4">
                      <div>
                        <p className="font-medium">{activeOrder.items.map((item) => item.name).join(", ")}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {activeOrder.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{formatINR(activeOrder.total)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mealSlots.map((slot, index) => {
            const SlotIcon = getSlotIcon(slot.name);
            const isActive = slot.status === "active";
            const isExpired = slot.status === "expired";

            return (
              <div
                key={slot.id}
                className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : isExpired
                      ? "border-border bg-muted/30"
                      : "border-border bg-card hover:border-primary/50"
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
                      isActive
                        ? "bg-primary text-white"
                        : isExpired
                          ? "bg-muted text-muted-foreground"
                          : "bg-info/15 text-info"
                    }`}
                  >
                    <SlotIcon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      isActive
                        ? "bg-primary text-white"
                        : isExpired
                          ? "bg-muted text-muted-foreground"
                          : "bg-info/15 text-info"
                    }`}
                  >
                    {isActive ? "OPEN NOW" : isExpired ? "EXPIRED" : "UPCOMING"}
                  </span>
                </div>

                <h3 className="font-semibold">{slot.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {slot.startTime} - {slot.endTime}
                </p>

                {isActive && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                    <Clock className="h-3.5 w-3.5 animate-pulse" />
                    <span>Ordering available</span>
                  </div>
                )}

                <button
                  onClick={() => !isExpired && navigate({ to: "/menu", search: { slot: slot.name } })}
                  disabled={isExpired}
                  className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-primary/40"
                      : isExpired
                        ? "cursor-not-allowed bg-muted text-muted-foreground"
                        : "border border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {isActive ? "Order Now" : isExpired ? "Slot Closed" : "Pre-order"}
                </button>
              </div>
            );
          })}
        </div>
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
  const stepLabels: Array<{ key: string; label: string }> = [
    { key: "pending", label: "Pending" },
    { key: "accepted", label: "Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "collected", label: "Collected" },
  ];

  const normalizedStatus = status === "delivered" ? "collected" : status;
  const currentIndex = stepLabels.findIndex((step) => step.key === normalizedStatus);

  return stepLabels.map((step, index) => ({
    label: step.label,
    done: index < currentIndex,
    current: index === currentIndex,
  }));
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
    <div className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-lg transition-transform group-hover:scale-110`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold">{value}</p>
        {trend && <p className="mt-0.5 text-xs text-muted-foreground">{trend}</p>}
      </div>
    </div>
  );
}
