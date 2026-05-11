import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LayoutGrid,
  ChefHat,
  Clock3,
  ReceiptText,
  Flame,
  CheckSquare,
  Search,
  LogOut,
  ShoppingBag,
  User,
  Megaphone,
  UserPlus2,
  Loader2,
} from "lucide-react";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/store";
import { fetchAdminOrders, type AdminOrder, type OrdersParams } from "@/api/admin";

export const Route = createFileRoute("/admin-orders")({ component: AdminOrders });

const adminNav: BottomNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutGrid, color: "bg-gradient-to-br from-violet-400 to-indigo-600" },
  { to: "/admin-orders", label: "Orders", icon: ShoppingBag, color: "bg-gradient-to-br from-sky-400 to-blue-700" },
  { to: "/admin-counter", label: "Counter", icon: CheckSquare, color: "bg-gradient-to-br from-orange-400 to-amber-600" },
  { to: "/admin-guest-orders", label: "Guest Orders", icon: User, color: "bg-gradient-to-br from-emerald-400 to-teal-600" },
  { to: "/admin-employees", label: "Employees", icon: UserPlus2, color: "bg-gradient-to-br from-cyan-400 to-blue-600" },
  { to: "/admin-slots", label: "Slots", icon: Clock3, color: "bg-gradient-to-br from-cyan-300 to-sky-700" },
  { to: "/admin-menu", label: "Menu", icon: ChefHat, color: "bg-gradient-to-br from-orange-300 to-red-500" },
  { to: "/admin-announcements", label: "Announcement", icon: Megaphone, color: "bg-gradient-to-br from-fuchsia-400 to-pink-600" },
  { to: "/admin-billing", label: "Reports", icon: ReceiptText, color: "bg-gradient-to-br from-amber-300 to-orange-600" },
  { to: "/admin-notifications", label: "Alerts", icon: Flame, color: "bg-gradient-to-br from-rose-400 to-red-700" },
];

export function AdminLayout({ children, crumb }: { children: ReactNode; crumb: string }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

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
          <div className="hidden sm:block">
            <div className="text-xs font-bold leading-tight text-primary">Admin Portal</div>
            <div className="text-[10px] text-muted-foreground">
              Admin / <span className="text-foreground">{crumb}</span>
            </div>
          </div>
        </div>
        <div className="relative mx-auto hidden max-w-md flex-1 md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Search..." className="w-full rounded-md bg-input/60 py-1.5 pl-9 pr-3 text-sm outline-none" />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-amber-700" />
          <div className="hidden text-xs sm:block">
            <div className="font-semibold leading-none">{user?.name ?? "Admin"}</div>
            <div className="text-[10px] text-muted-foreground">ADMIN</div>
          </div>
        </div>
        <ThemeToggle />
        <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive" aria-label="Logout">
          <LogOut className="h-4 w-4" />
        </button>
      </header>
      <main className="w-full flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8">{children}</main>
      <BottomNav items={adminNav} />
    </div>
  );
}

const STAGES = ["Pending", "Preparing", "Ready", "Delivered"] as const;
type Stage = (typeof STAGES)[number];
const ITEMS_PER_PAGE = 10;

function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [slotFilter, setSlotFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | Stage>("All");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [range, setRange] = useState<"today" | "7d" | "all" | "custom">("today");
  const [customFrom, setCustomFrom] = useState(formatShortDateInput(new Date()));
  const [customTo, setCustomTo] = useState(formatShortDateInput(new Date()));

  // Extract unique slots from orders
  const slotOptions = useMemo(() => {
    const slots = new Set(orders.map((o) => o.slotName).filter(Boolean));
    return ["All", ...Array.from(slots)];
  }, [orders]);

  // Fetch orders from backend
  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      try {
        setLoading(true);
        setError(null);

        const params: OrdersParams = {
          live_only: true,
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
        };

        // Status filter
        if (statusFilter !== "All") {
          params.status = statusFilter.toLowerCase();
        }

        // Date range
        if (range === "today") {
          params.range = "today";
        } else if (range === "7d") {
          params.range = "7d";
        } else if (range === "all") {
          params.range = "all";
        } else if (range === "custom") {
          const from = parseShortDateInput(customFrom);
          const to = parseShortDateInput(customTo);
          if (from) params.date_from = from.toISOString().slice(0, 10);
          if (to) params.date_to = to.toISOString().slice(0, 10);
        }

        // Search
        if (query.trim()) {
          params.search = query.trim();
        }

        // Slot filter - we'll filter client-side for now since backend doesn't have slot name filter
        // (could enhance backend to support slot_name filter)

        const response = await fetchAdminOrders(params);

        if (mounted) {
          let filteredOrders = response.results;

          // Client-side slot filter
          if (slotFilter !== "All") {
            filteredOrders = filteredOrders.filter((o) => o.slotName === slotFilter);
          }

          setOrders(filteredOrders);
          setTotalCount(response.count);
          setTotalPages(response.totalPages);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || "Failed to load orders");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    // Refresh every 15 seconds for live orders
    const interval = setInterval(loadOrders, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentPage, statusFilter, range, customFrom, customTo, query, slotFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [customFrom, customTo, query, range, slotFilter, statusFilter]);

  // Calculate counts from orders
  const counts = useMemo(
    () => ({
      Pending: orders.filter((o) => getAdminStageLabel(o.status) === "Pending").length,
      Preparing: orders.filter((o) => getAdminStageLabel(o.status) === "Preparing").length,
      Ready: orders.filter((o) => getAdminStageLabel(o.status) === "Ready").length,
      Delivered: orders.filter((o) => getAdminStageLabel(o.status) === "Delivered").length,
      Total: orders.length,
    }),
    [orders]
  );

  if (loading && orders.length === 0) {
    return (
      <AdminLayout crumb="Live Orders">
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout crumb="Live Orders">
      <div className="mb-2">
        <h1 className="text-2xl font-bold">Live Orders</h1>
        <p className="text-xs text-muted-foreground">Real-time order tracking from backend.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="TOTAL" value={totalCount} color="text-primary" />
        <Stat label="PENDING" value={counts.Pending} color="text-foreground" />
        <Stat label="PREPARING" value={counts.Preparing} color="text-warning" />
        <Stat label="READY" value={counts.Ready} color="text-info" />
        <Stat label="DELIVERED" value={counts.Delivered} color="text-success" />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <DataTableToolbar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search order # or customer..."
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
          extraFilters={
            <>
              <select
                value={slotFilter}
                onChange={(e) => setSlotFilter(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                {slotOptions.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "All" | Stage)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                {(["All", ...STAGES] as const).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </>
          }
        />
      </div>

      <TablePanel title="Live Orders Table" description={`${totalCount} orders matched`}>
        {orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No live orders.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium text-primary">#{order.orderNumber}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold">{order.customerName}</div>
                      <div className="text-xs text-muted-foreground">{order.department}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{order.slotName}</TableCell>
                  <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                    {(order.items ?? []).map((item) => `${item.quantity}x ${item.name}`).join(", ")}
                  </TableCell>
                  <TableCell className="font-semibold">{formatINR(order.total)}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${stageStyle(getAdminStageLabel(order.status))}`}>
                      {getAdminStageLabel(order.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalCount}
          pageSize={ITEMS_PER_PAGE}
        />
      </TablePanel>
    </AdminLayout>
  );
}

function getAdminStageLabel(status: string): Stage {
  const normalizedStatus = String(status).trim().toLowerCase();

  if (normalizedStatus === "preparing") return "Preparing";
  if (normalizedStatus === "ready") return "Ready";
  if (["completed", "collected", "delivered"].includes(normalizedStatus)) return "Delivered";
  return "Pending";
}

function stageStyle(status: Stage) {
  if (status === "Pending") return "bg-muted text-foreground";
  if (status === "Preparing") return "bg-warning/20 text-warning";
  if (status === "Ready") return "bg-info/20 text-info";
  if (status === "Delivered") return "bg-success/20 text-success";
  return "bg-destructive/20 text-destructive";
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{String(value).padStart(2, "0")}</div>
    </div>
  );
}
