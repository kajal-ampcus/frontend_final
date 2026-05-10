import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useCallback, useRef } from "react";
import {
  IndianRupee, ShoppingBag, TrendingUp, Package, Clock, Users,
  Sunrise, UtensilsCrossed, Cookie, Moon, Flame,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  ];

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
          <div
            className="bento-card bento-span-2x2 border-[#efcfad] bg-[#fff8ef] shadow-[0_18px_40px_rgba(245,128,32,0.08)] dark:border-[#4a2b16] dark:bg-[#20120d] dark:shadow-none"
            style={{ minHeight: 320 }}
          >
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
                <div className="rounded-xl border border-[#ead8c8] bg-[#fff3e8] px-4 py-2.5 text-right dark:border-[#4e301d] dark:bg-[#2a1912]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8d715b] dark:text-[#c7aa91]">
                    Active Orders
                  </div>
                  <div className="mt-0.5 text-2xl font-black text-[#f57c14] dark:text-primary">
                    {activeStatusCount}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex-1">
                {activeStatusCount === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">No active orders right now</p>
                  </div>
                ) : (
                  <>
                    <StatusStickChart data={liveStatusData} />
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
function StatusStickChart({
  data,
}: {
  data: Array<{ status: string; count: number }>;
}) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[#e6ccb5] bg-[#f7eadf] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_40px_rgba(160,103,54,0.10)] dark:border-[#5c3827] dark:bg-[#2a1812] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_18px_40px_rgba(0,0,0,0.32)]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            backgroundImage:
              "linear-gradient(rgba(140,88,46,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(140,88,46,0.07) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-[#ffb36a]/18 blur-2xl dark:bg-[#ff9b54]/12" />
        <div className="absolute left-1/2 top-8 h-24 w-24 -translate-x-1/2 rounded-full bg-[#ff8d8d]/10 blur-3xl dark:bg-[#ff5e8a]/10" />
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-5">
        {data.map((item) => {
          const height = item.count === 0 ? 0 : Math.max(28, Math.round((item.count / maxCount) * 138));
          return (
            <div key={item.status} className="flex flex-col items-center text-center">
              <div className="mb-4 min-h-[36px] rounded-full bg-[#ead7c5]/95 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.26em] text-[#6f5039] dark:bg-[#4a2d20]/90 dark:text-[#f5d8c1]">
                {item.status}
              </div>
              <div className="relative flex h-[156px] items-end justify-center">
                <div className="absolute bottom-0 top-0 w-3 rounded-full bg-[#d8c0ad] dark:bg-[#65473b]" />
                <div
                  className="relative z-10 w-3 rounded-full shadow-[0_0_18px_rgba(255,136,92,0.45)]"
                  style={{
                    height: `${height}px`,
                    background: "linear-gradient(180deg, #ffd17f 0%, #ffa26a 35%, #ff6d7a 70%, #e6538f 100%)",
                  }}
                />
                <div className="absolute bottom-0 w-8 border-b border-[#bb9a81]/45 dark:border-[#9f7764]/25" />
              </div>
              <div className="mt-4 text-2xl font-black tracking-tight text-[#2e1a11] dark:text-[#fff3e7]">
                {item.count}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[#866850] dark:text-[#cfb29e]">
                live orders
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
