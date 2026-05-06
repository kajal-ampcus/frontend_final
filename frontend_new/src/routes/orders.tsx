import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Pagination } from "@/components/Pagination";
import {
  formatINR,
  updateOrderStatus,
  useCurrentCustomer,
  useEntities,
  type Order,
  type OrderStatus,
  type Slot,
} from "@/lib/store/index";

export const Route = createFileRoute("/orders")({ component: Orders });

type FilterStatus = "all" | "active" | "completed" | "cancelled";

const PAGE_SIZE = 5;

function Orders() {
  const navigate = useNavigate();
  const currentCustomer = useCurrentCustomer();
  const allOrders = useEntities<Order>("orders");
  const mealSlots = useEntities<Slot>("slots");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const userOrders = useMemo(() => {
    if (!currentCustomer) return [];
    return allOrders.filter((order) => order.customerId === currentCustomer.id);
  }, [allOrders, currentCustomer]);

  const availableSlots = mealSlots.filter((slot) => slot.status !== "expired");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const activeSlot = mealSlots.find((slot) => slot.status === "active");
    setSelectedSlotId((prev) => prev ?? activeSlot?.id ?? availableSlots[0]?.id ?? null);
  }, [availableSlots, mealSlots]);

  const activeOrdersForSlot = useMemo(() => {
    const activeStatuses: OrderStatus[] = ["pending", "accepted", "preparing", "ready"];
    return userOrders.filter(
      (order) => order.slotId === selectedSlotId && activeStatuses.includes(order.status),
    );
  }, [selectedSlotId, userOrders]);

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

  const activeOrder = activeOrdersForSlot.find((order) => order.id === selectedOrderId) ?? null;

  const filteredOrders = userOrders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "active")
      return ["pending", "accepted", "preparing", "ready"].includes(order.status);
    if (filter === "completed")
      return ["completed", "delivered", "collected"].includes(order.status);
    return order.status === "cancelled";
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filters: Array<{ value: FilterStatus; label: string }> = [
    { value: "all", label: "All Orders" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <AppLayout title="Orders">
      <div
        className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track active orders and review past ones.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
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
                </button>
              );
            })}
          </div>

          {activeOrdersForSlot.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No active orders for this slot.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-xl bg-muted/30 p-4">
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
                      {order.orderNumber} - {order.items.map((item) => item.name).join(", ")} -{" "}
                      {formatINR(order.total)}
                    </option>
                  ))}
                </select>
              </div>

              {activeOrder && (
                <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-orange-500/5 p-6 shadow-lg shadow-primary/5">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold">Current Order</h2>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusColor(activeOrder.status)}`}
                          >
                            {getDisplayStatusLabel(activeOrder.status).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-primary">{activeOrder.orderNumber}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        {formatINR(activeOrder.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeOrder.items.length} items
                      </p>
                    </div>
                  </div>

                  <div className="mb-5 flex items-center justify-between">
                    {getStatusSteps(activeOrder.status).map((step, index, steps) => {
                      const StepIcon = step.icon;
                      return (
                        <div key={step.label} className="flex flex-1 items-center">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500 ${
                                step.current
                                  ? "scale-110 bg-primary text-white ring-4 ring-primary/20 shadow-lg shadow-primary/30"
                                  : step.done
                                    ? "bg-primary text-white"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <StepIcon className="h-5 w-5" />
                            </div>
                            <span
                              className={`text-xs font-medium ${step.current ? "font-semibold text-primary" : "text-muted-foreground"}`}
                            >
                              {step.label}
                            </span>
                          </div>
                          {index < steps.length - 1 && (
                            <div
                              className={`mx-2 h-1.5 flex-1 rounded-full ${step.done ? "bg-primary" : "bg-muted"}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl bg-card/80 p-4 backdrop-blur">
                    <div className="space-y-2">
                      {activeOrder.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                              {item.quantity}x
                            </span>
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatINR(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {canCancel(activeOrder.status) && (
                      <div className="mt-4 border-t border-border pt-4">
                        <button
                          onClick={() => updateOrderStatus(activeOrder.id, "cancelled")}
                          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-semibold text-destructive transition-all hover:bg-destructive/10 active:scale-95"
                        >
                          Cancel Order
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {filters.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setFilter(item.value);
                  setPage(1);
                }}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  filter === item.value
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "border border-border bg-card hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <h3 className="font-bold">Order History</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {filteredOrders.length} orders found
            </p>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">No orders found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Place an order to see it here.</p>
              <button
                onClick={() => navigate({ to: "/menu" })}
                className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {pagedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="group flex items-center gap-4 p-5 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${getIconBadgeColor(order.status)}`}
                    >
                      {order.status === "cancelled" ? (
                        <XCircle className="h-5 w-5" />
                      ) : ["completed", "delivered", "collected"].includes(order.status) ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{order.orderNumber}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(order.status)}`}
                        >
                          {getDisplayStatusLabel(order.status).toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatOrderDate(order.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatOrderTime(order.createdAt)}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5">{order.slotName}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <p className="text-lg font-bold">{formatINR(order.total)}</p>
                      {canCancel(order.status) ? (
                        <button
                          onClick={() => updateOrderStatus(order.id, "cancelled")}
                          className="text-xs font-semibold text-destructive hover:underline"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          View Details <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filteredOrders.length}
                pageSize={PAGE_SIZE}
              />
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function canCancel(status: OrderStatus) {
  return status === "pending" || status === "accepted";
}

function getStatusSteps(status: OrderStatus) {
  const steps = [
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
  const currentIndex = steps.findIndex((step) => step.key === normalizedStatus);

  return steps.map((step, index) => ({
    ...step,
    done: index < currentIndex,
    current: index === currentIndex,
  }));
}

function getStatusColor(status: OrderStatus) {
  switch (status) {
    case "pending":
    case "accepted":
      return "bg-amber-500/15 text-amber-600";
    case "preparing":
      return "bg-primary/15 text-primary";
    case "ready":
      return "bg-emerald-500/15 text-emerald-600";
    case "delivered":
    case "completed":
    case "collected":
      return "bg-emerald-500/15 text-emerald-600";
    case "cancelled":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getIconBadgeColor(status: OrderStatus) {
  return getStatusColor(status);
}

function getDisplayStatusLabel(status: OrderStatus) {
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

function formatOrderDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatOrderTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
