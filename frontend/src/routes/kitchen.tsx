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
import { useKitchenBoard, useMarkPreparing, useMarkPrepared, type CmsOrder, type CmsOrderStatus } from "@/hooks/useCanteen";
import { formatINR } from "@/lib/store";

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
  const { data: board } = useKitchenBoard();
  const markPreparing = useMarkPreparing();
  const markPrepared = useMarkPrepared();
  const [searchQuery, setSearchQuery] = useState("");
  const [range, setRange] = useState<"today" | "7d" | "all" | "custom">("today");
  const [customFrom, setCustomFrom] = useState(formatShortDateInput(new Date()));
  const [customTo, setCustomTo] = useState(formatShortDateInput(new Date()));
  const [page, setPage] = useState(1);

  const liveOrders = useMemo(
    () =>
      [...(board?.accepted ?? []), ...(board?.preparing ?? []), ...(board?.prepared ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [board],
  );

  const filteredLiveOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();

    return liveOrders.filter((order) => {
      const createdAt = new Date(order.created_at).getTime();

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
        order.order_code.toLowerCase().includes(query) ||
        order.employee_name.toLowerCase().includes(query) ||
        order.slot_name.toLowerCase().includes(query) ||
        order.order_items.some((item) => item.item_name_snapshot.toLowerCase().includes(query))
      );
    });
  }, [customFrom, customTo, liveOrders, range, searchQuery]);

  const urgentCount = filteredLiveOrders.filter(
    (order) => order.status === "PREPARED" || getAgeMinutes(order.created_at) >= 20,
  ).length;

  const totalPages = Math.max(1, Math.ceil(filteredLiveOrders.length / PAGE_SIZE));
  const pagedOrders = filteredLiveOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [customFrom, customTo, range, searchQuery]);

  const handleAdvanceOrder = async (order: CmsOrder) => {
    try {
      if (order.status === "ACCEPTED") {
        await markPreparing.mutateAsync(order.id);
        toast.success(`${order.order_code} moved to preparing.`);
        return;
      }

      if (order.status === "PREPARING") {
        await markPrepared.mutateAsync(order.id);
        toast.success(`${order.order_code} is ready for counter pickup.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update order.");
    }
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
                  <TableCell className="font-medium text-primary">{order.order_code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{order.employee_name}</div>
                      <div className="text-xs text-muted-foreground">{order.employee_code}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{order.slot_name}</TableCell>
                  <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                    {order.order_items.map((item) => `${item.quantity}x ${item.item_name_snapshot}`).join(", ")}
                  </TableCell>
                  <TableCell className="font-semibold">{formatINR(Number(order.total_amount))}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDuration(order.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getKitchenStatusClass(order.status)}`}>
                      {order.status.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {getKitchenActionLabel(order.status) ? (
                      <button
                        onClick={() => void handleAdvanceOrder(order)}
                        disabled={markPreparing.isPending || markPrepared.isPending}
                        className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {getKitchenActionLabel(order.status)}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Waiting at counter</span>
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

function getKitchenStatusClass(status: CmsOrderStatus) {
  switch (status) {
    case "ACCEPTED":
      return "bg-sky-500/15 text-sky-600";
    case "PREPARING":
      return "bg-primary/15 text-primary";
    case "PREPARED":
      return "bg-emerald-500/15 text-emerald-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getKitchenActionLabel(status: CmsOrderStatus) {
  switch (status) {
    case "ACCEPTED":
      return "Start Prep";
    case "PREPARING":
      return "Mark Ready";
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
