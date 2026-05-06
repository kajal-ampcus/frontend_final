import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useCallback, useRef } from "react";
import {
  IndianRupee, ShoppingBag, TrendingUp, Package, Clock, Users,
  Sunrise, UtensilsCrossed, Cookie, Moon, Flame,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IgniteDonutChartCard } from "@/components/charts/IgniteDashboardCharts";
import { AdminLayout } from "./admin-orders";
import { useEntities, formatINR, type OrderStatus, type Order } from "@/lib/store";

export const Route = createFileRoute("/admin")({ component: Admin });

/* ─── Mouse-tracking glow hook ─── */
function useBentoGlow() {
  const gridRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = grid.querySelectorAll<HTMLElement>(".bento-card");
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const inside =
        x >= -40 && x <= rect.width + 40 && y >= -40 && y <= rect.height + 40;
      card.style.setProperty("--glow-x", `${x}px`);
      card.style.setProperty("--glow-y", `${y}px`);
      card.style.setProperty("--glow-intensity", inside ? "1" : "0");
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.querySelectorAll<HTMLElement>(".bento-card").forEach((card) => {
      card.style.setProperty("--glow-intensity", "0");
    });
  }, []);

  return { gridRef, handlePointerMove, handlePointerLeave };
}

/* ─── Slot config ─── */
const SLOT_META: Record<string, { icon: LucideIcon; accent: string; bg: string }> = {
  Breakfast: { icon: Sunrise,            accent: "text-primary",          bg: "bg-muted" },
  Lunch:     { icon: UtensilsCrossed,    accent: "text-primary",          bg: "bg-muted" },
  Snacks:    { icon: Cookie,             accent: "text-primary",          bg: "bg-muted" },
  Dinner:    { icon: Moon,               accent: "text-primary",          bg: "bg-muted" },
};

/* ─── Status badge colors ─── */
const STATUS_COLOR: Record<string, { dot: string; text: string; bg: string }> = {
  Pending:   { dot: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10" },
  Preparing: { dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-500/10" },
  Ready:     { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  Delivered: { dot: "bg-purple-500",  text: "text-purple-600 dark:text-purple-400",  bg: "bg-purple-500/10" },
};

function Admin() {
  const orders = useEntities<Order>("orders");
  const { gridRef, handlePointerMove, handlePointerLeave } = useBentoGlow();

  const today = new Date().toISOString().slice(0, 10);
  const todays = useMemo(
    () => orders.filter((o) => o.createdAt.slice(0, 10) === today && o.status !== "cancelled"),
    [orders, today],
  );

  const todayRevenue = todays.reduce((sum, order) => sum + order.total, 0);

  const live = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.status !== "completed"),
    [orders],
  );

  const liveByStatus = useMemo(() => {
    const tally: Record<OrderStatus, number> = {
      pending: 0, accepted: 0, preparing: 0,
      ready: 0, collected: 0, delivered: 0, completed: 0, cancelled: 0,
    };
    for (const order of live) tally[order.status]++;
    return tally;
  }, [live]);

  const slotCounts = useMemo(() => {
    const slots = ["Breakfast", "Lunch", "Snacks", "Dinner"];
    const tally = Object.fromEntries(slots.map((slot) => [slot, 0])) as Record<string, number>;
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      if (tally[order.slotName] !== undefined) tally[order.slotName]++;
    }
    return slots.map((slot) => ({ slot, orders: tally[slot] }));
  }, [orders]);

  const liveStatusData = [
    { status: "Pending", count: liveByStatus.pending },
    { status: "Preparing", count: liveByStatus.preparing },
    { status: "Ready", count: liveByStatus.ready },
    { status: "Delivered", count: liveByStatus.delivered },
  ].filter((item) => item.count > 0);

  const activeStatusCount = liveStatusData.reduce((sum, item) => sum + item.count, 0);
  const peakSlot = slotCounts.reduce((max, s) => (s.orders > max.orders ? s : max), slotCounts[0]);

  return (
    <AdminLayout crumb="Dashboard">
      <div className="space-y-6 p-2 md:p-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Real-time overview of your canteen operations
          </p>
        </div>

        {/* ─── Magic Bento Grid ───
             Layout (desktop 4-col):
             Row 1: [Orders 1×1] [Revenue 1×1] [Order Volume 2×2]
             Row 2: [Status Dist. 2×2────────] [Order Volume cont.]
             Row 3: [Status Dist. continues──] [Active Users] [Avg Time]
        ─── */}
        <div
          ref={gridRef}
          className="bento-grid"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* ── Card 1: Today's Orders (1×1) — "Insights" position ── */}
          <StatCard
            icon={ShoppingBag}
            label="Today's Orders"
            value={String(todays.length)}
            accent="text-primary"
          />

          {/* ── Card 2: Today's Revenue (1×1) — "Overview" position ── */}
          <StatCard
            icon={IndianRupee}
            label="Today's Revenue"
            value={formatINR(todayRevenue)}
            accent="text-emerald-500 dark:text-emerald-400"
          />

          {/* ── Card 3: Order Volume by Slot (2×2) — "Teamwork" position ── */}
          <div className="bento-card bento-span-2x2" style={{ minHeight: 320 }}>
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Order Volume by Slot
                </h2>
                <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {orders.filter((o) => o.status !== "cancelled").length} total
                </span>
              </div>

              <div className="mt-5 grid flex-1 grid-cols-2 gap-3 content-start">
                {slotCounts.map((slot) => {
                  const meta = SLOT_META[slot.slot] ?? { icon: Package, accent: "text-primary", bg: "bg-muted" };
                  const SlotIcon = meta.icon;
                  const isPeak = slot === peakSlot && slot.orders > 0;
                  return (
                    <div
                      key={slot.slot}
                      className={`group relative flex flex-col justify-between rounded-2xl border border-border/60 ${meta.bg} p-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg`}
                      style={{ minHeight: 100 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SlotIcon className={`h-4 w-4 ${meta.accent}`} />
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {slot.slot}
                          </span>
                        </div>
                        {isPeak && (
                          <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
                            <Flame className="h-3 w-3" /> PEAK
                          </span>
                        )}
                      </div>
                      <div className="mt-3">
                        <span className={`text-3xl font-black ${meta.accent}`}>
                          {slot.orders}
                        </span>
                        <span className="ml-1.5 text-xs text-muted-foreground">orders</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Card 4: Status Distribution (2×2) — "Efficiency" position ── */}
          <div className="bento-card bento-span-2x2" style={{ minHeight: 320 }}>
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Live Mix</span>
                  </div>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">
                    Status Distribution
                  </h2>
                </div>
                <div className="rounded-xl border border-border bg-primary/5 px-4 py-2.5 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Orders
                  </div>
                  <div className="mt-0.5 text-2xl font-black text-primary">
                    {activeStatusCount}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex-1">
                {liveStatusData.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">No active orders right now</p>
                  </div>
                ) : (
                  <>
                    <IgniteDonutChartCard
                      data={liveStatusData}
                      valueMemberPath="count"
                      labelMemberPath="status"
                      height="200px"
                      brushes={["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"]}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {liveStatusData.map((s) => {
                        const c = STATUS_COLOR[s.status] ?? STATUS_COLOR.Pending;
                        return (
                          <div
                            key={s.status}
                            className={`flex items-center gap-2.5 rounded-xl ${c.bg} px-3 py-2.5`}
                          >
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {s.status}
                              </div>
                              <div className={`text-lg font-black leading-tight ${c.text}`}>
                                {s.count}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Card 5: Active Users (1×1) — "Connectivity" position ── */}
          <StatCard
            icon={Users}
            label="Active Users"
            value="247"
            accent="text-blue-500 dark:text-blue-400"
          />

          {/* ── Card 6: Avg. Time (1×1) — "Protection" position ── */}
          <StatCard
            icon={Clock}
            label="Avg. Time"
            value="12m"
            accent="text-purple-500 dark:text-purple-400"
          />
        </div>
      </div>
    </AdminLayout>
  );
}

/* ─── Reusable Stat Card (1×1 bento cell) ─── */
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bento-card">
      <div className="relative z-10 flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
      <div className="relative z-10 mt-auto pt-4">
        <div className={`text-3xl font-black tracking-tight ${accent}`}>
          {value}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
