import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChefHat, Clock3, Flame, LogOut, Search, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { logout, getCurrentUser } from "@/lib/auth";
import { BottomNav, type BottomNavItem } from "@/components/BottomNav";
import {
  DataTableToolbar,
  formatShortDateInput,
  parseShortDateInput,
} from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatINR,
  updateOrderStatus,
  useEntities,
  type Order,
  type OrderStatus,
} from "@/lib/store";

export const Route = createFileRoute("/kitchen")({ component: Kitchen });
const PAGE_SIZE = 8;

const kitchenNav: BottomNavItem[] = [
  {
    to: "/kitchen",
    label: "Live",
    icon: ChefHat,
    color: "bg-gradient-to-br from-orange-300 to-red-500",
  },
  {
    to: "/kitchen-history",
    label: "History",
    icon: Clock3,
    color: "bg-gradient-to-br from-cyan-300 to-sky-700",
  },
  {
    to: "/kitchen-notifications",
    label: "Alerts",
    icon: Flame,
    color: "bg-gradient-to-br from-rose-400 to-red-700",
  },
];

export function KitchenLayout({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useNavigate();
  const user = typeof window !== "undefined" ? getCurrentUser() : null;
  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/60 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="h-4 w-4" />
          </div>
          <div className="hidden text-sm font-semibold leading-tight sm:block">{title}</div>
        </div>
        <div className="relative mx-auto hidden max-w-md flex-1 md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search orders, items, or staff..."
            className="w-full rounded-md bg-input/60 py-1.5 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <ThemeToggle />
        <span className="rounded bg-emerald-600/20 px-2 py-1 text-[10px] font-bold text-emerald-400">
          {user?.name ?? "Chef"}
        </span>
        <button
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>
      <main className="w-full flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8">{children}</main>
      <BottomNav items={kitchenNav} />
    </div>
  );
}

function Kitchen() {
  const orders = useEntities<Order>("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [range, setRange] = useState<"today" | "7d" | "all" | "custom">("today");
  const [customFrom, setCustomFrom] = useState(formatShortDateInput(new Date()));
  const [customTo, setCustomTo] = useState(formatShortDateInput(new Date()));
  const [page, setPage] = useState(1);

  const liveOrders = useMemo(
    () =>
      orders
        .filter((order) => ["pending", "accepted", "preparing", "ready"].includes(order.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [orders],
  );

  const filteredLiveOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    return liveOrders.filter((order) => {
      const createdAt = new Date(order.createdAt).getTime();

      if (range === "today") {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        if (createdAt < startOfDay.getTime()) return false;
      }

      if (range === "7d" && now - createdAt > 7 * 24 * 60 * 60 * 1000) return false;

      if (range === "custom") {
        const from = parseShortDateInput(customFrom);
        const to = parseShortDateInput(customTo);
        if (from && createdAt < from.setHours(0, 0, 0, 0)) return false;
        if (to && createdAt > to.setHours(23, 59, 59, 999)) return false;
      }

      if (!query) return true;

      return (
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.slotName.toLowerCase().includes(query) ||
        order.items.some((item) => item.name.toLowerCase().includes(query))
      );
    });
  }, [customFrom, customTo, liveOrders, range, searchQuery]);

  const urgentCount = filteredLiveOrders.filter(
    (order) => order.status === "ready" || getAgeMinutes(order.createdAt) >= 20,
  ).length;

  const totalPages = Math.max(1, Math.ceil(filteredLiveOrders.length / PAGE_SIZE));
  const pagedOrders = filteredLiveOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [customFrom, customTo, range, searchQuery]);

  const handleAdvanceOrder = (order: Order) => {
    const nextStatus = getNextKitchenStatus(order.status);
    if (!nextStatus) return;

    updateOrderStatus(order.id, nextStatus);
    toast.success(`${order.orderNumber} moved to ${nextStatus}`);
  };

  return (
    <KitchenLayout title="Live Orders | Hot prep window: 8m">
      <TablePanel
        title="Live Orders"
        description="Monitoring the active preparation queue in real time."
        summary={
          <>
            <span className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
              {urgentCount} urgent
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {filteredLiveOrders.length} total
            </span>
          </>
        }
        actions={
          <div className="w-full sm:w-auto">
            <DataTableToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search orders, employees, items..."
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "Last 7 Days" },
                { value: "all", label: "All" },
                { value: "custom", label: "Custom" },
              ]}
              activeOption={range}
              onOptionChange={(value) => setRange(value as "today" | "7d" | "all" | "custom")}
              fromValue={customFrom}
              toValue={customTo}
              onFromChange={setCustomFrom}
              onToChange={setCustomTo}
            />
          </div>
        }
      >
        {filteredLiveOrders.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            No live kitchen orders right now.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Wait Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium text-primary">{order.orderNumber}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{order.customerName}</div>
                      <div className="text-xs text-muted-foreground">{order.department}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{order.slotName}</TableCell>
                  <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                    {order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                  </TableCell>
                  <TableCell className="font-semibold">{formatINR(order.total)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDuration(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getKitchenStatusClass(order.status)}`}
                    >
                      {order.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {getKitchenActionLabel(order.status) ? (
                      <button
                        onClick={() => handleAdvanceOrder(order)}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90"
                      >
                        {getKitchenActionLabel(order.status)}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Waiting</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={filteredLiveOrders.length}
          pageSize={PAGE_SIZE}
        />
      </TablePanel>

      <button className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg sm:right-6">
        <Plus className="h-5 w-5" />
      </button>
    </KitchenLayout>
  );
}

function getKitchenStatusClass(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-muted text-foreground";
    case "accepted":
      return "bg-sky-500/15 text-sky-600";
    case "preparing":
      return "bg-primary/15 text-primary";
    case "ready":
      return "bg-emerald-500/15 text-emerald-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getKitchenActionLabel(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Accept";
    case "accepted":
      return "Start Prep";
    case "preparing":
      return "Mark Ready";
    case "ready":
      return "Mark Collected";
    default:
      return null;
  }
}

function getNextKitchenStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "pending":
      return "accepted";
    case "accepted":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return "collected";
    default:
      return null;
  }
}

function getAgeMinutes(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatDuration(createdAt: string) {
  const totalMinutes = getAgeMinutes(createdAt);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
