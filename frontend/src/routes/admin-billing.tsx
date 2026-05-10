import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileSpreadsheet, IndianRupee, UserSearch, Wallet, X } from "lucide-react";

import { AdminLayout } from "./admin-orders";
import {
  DataTableToolbar,
  formatShortDateInput,
  parseShortDateInput,
} from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addToCustomerWallet, downloadCSV, formatINR, type Customer, type Order, useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-billing")({ component: AdminBilling });

const CUSTOMER_PAGE_SIZE = 8;
const SALES_PAGE_SIZE = 10;

function AdminBilling() {
  const orders = useStore((state) => (state.orders as Order[]) ?? []);
  const customers = useStore((state) => (state.customers as Customer[]) ?? []);

  const [query, setQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showRaiseFund, setShowRaiseFund] = useState(false);
  const [salesRange, setSalesRange] = useState<"today" | "7d" | "all" | "custom">("today");
  const [salesFrom, setSalesFrom] = useState(formatShortDateInput(new Date()));
  const [salesTo, setSalesTo] = useState(formatShortDateInput(new Date()));
  const [customerRange, setCustomerRange] = useState<"month" | "30d" | "all" | "custom">("month");
  const [customerFrom, setCustomerFrom] = useState(formatShortDateInput(getStartOfMonth()));
  const [customerTo, setCustomerTo] = useState(formatShortDateInput(new Date()));
  const [salesPage, setSalesPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);

  const billableOrders = useMemo(
    () => orders.filter((order) => normalizeBillingStatus(order.status) !== "cancelled"),
    [orders],
  );

  const customerOrdersInRange = useMemo(
    () => billableOrders.filter((order) => matchesBillingRange(order.createdAt, customerRange, customerFrom, customerTo)),
    [billableOrders, customerFrom, customerRange, customerTo],
  );

  const salesOrders = useMemo(
    () => billableOrders.filter((order) => matchesSalesRange(order.createdAt, salesRange, salesFrom, salesTo)),
    [billableOrders, salesFrom, salesRange, salesTo],
  );

  const customerRows = useMemo(
    () =>
      customers.map((customer) => {
        const customerOrders = customerOrdersInRange.filter((order) => order.customerId === customer.id);
        const meals = customerOrders.reduce(
          (sum, order) => sum + order.items.reduce((itemTotal, item) => itemTotal + getOrderItemQuantity(item), 0),
          0,
        );
        const total = customerOrders.reduce((sum, order) => sum + order.total, 0);

        return {
          ...customer,
          orderCount: customerOrders.length,
          meals,
          total,
        };
      }),
    [customerOrdersInRange, customers],
  );

  const filteredCustomerRows = useMemo(() => {
    if (!query.trim()) return customerRows;

    const normalizedQuery = query.trim().toLowerCase();
    return customerRows.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.empId.toLowerCase().includes(normalizedQuery) ||
        customer.department.toLowerCase().includes(normalizedQuery),
    );
  }, [customerRows, query]);

  const salesRows = useMemo(() => {
    const grouped = new Map<string, { slot: string; item: string; quantity: number; revenue: number }>();

    for (const order of salesOrders) {
      const slot = getBillingSlotName(order);
      for (const item of order.items) {
        const quantity = getOrderItemQuantity(item);
        const unitPrice = getOrderItemUnitPrice(item);
        const key = `${slot}::${item.name}`;
        const current = grouped.get(key) ?? { slot, item: item.name, quantity: 0, revenue: 0 };
        current.quantity += quantity;
        current.revenue += quantity * unitPrice;
        grouped.set(key, current);
      }
    }

    return Array.from(grouped.values()).sort(
      (left, right) => left.slot.localeCompare(right.slot) || right.revenue - left.revenue,
    );
  }, [salesOrders]);

  const salesTotalPages = Math.max(1, Math.ceil(salesRows.length / SALES_PAGE_SIZE));
  const pagedSalesRows = salesRows.slice((salesPage - 1) * SALES_PAGE_SIZE, salesPage * SALES_PAGE_SIZE);

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomerRows.length / CUSTOMER_PAGE_SIZE));
  const pagedCustomerRows = filteredCustomerRows.slice(
    (customerPage - 1) * CUSTOMER_PAGE_SIZE,
    customerPage * CUSTOMER_PAGE_SIZE,
  );

  const totalRevenue = useMemo(() => billableOrders.reduce((sum, order) => sum + order.total, 0), [billableOrders]);
  const periodRevenue = useMemo(
    () => customerOrdersInRange.reduce((sum, order) => sum + order.total, 0),
    [customerOrdersInRange],
  );
  const salesUnits = useMemo(
    () => salesRows.reduce((sum, row) => sum + row.quantity, 0),
    [salesRows],
  );

  useEffect(() => {
    setCustomerPage(1);
  }, [customerFrom, customerRange, customerTo, query]);

  useEffect(() => {
    setSalesPage(1);
  }, [salesFrom, salesRange, salesTo]);

  const exportCustomerReport = (customerId: string) => {
    const customer = customers.find((entry) => entry.id === customerId);
    if (!customer) return;

    const customerOrders = customerOrdersInRange.filter((order) => order.customerId === customerId);
    if (customerOrders.length === 0) {
      toast.error("No orders for this customer in the selected range");
      return;
    }

    const rows: Array<Array<string | number>> = [
      [`Statement - ${customer.name} (${customer.empId})`],
      [`Department: ${customer.department}`],
      [`Range: ${getCustomerRangeLabel(customerRange, customerFrom, customerTo)}`],
      [],
      ["Date", "Order #", "Slot", "Item", "Qty", "Unit Price", "Line Total"],
    ];

    let grandTotal = 0;
    for (const order of customerOrders) {
      for (const item of order.items) {
        const quantity = getOrderItemQuantity(item);
        const unitPrice = getOrderItemUnitPrice(item);
        const lineTotal = quantity * unitPrice;
        grandTotal += lineTotal;
        rows.push([
          formatBillingDate(order.createdAt),
          order.orderNumber,
          getBillingSlotName(order),
          item.name,
          quantity,
          unitPrice,
          lineTotal,
        ]);
      }
    }

    rows.push([], ["", "", "", "", "", "TOTAL", grandTotal]);
    downloadCSV(`${customer.empId}-${customerFrom}-to-${customerTo}.csv`, rows);
    toast.success("Customer report downloaded");
  };

  const exportSalesReport = () => {
    if (salesRows.length === 0) {
      toast.error("No sales rows for the selected range");
      return;
    }

    const rows: Array<Array<string | number>> = [
      [`Sales Summary - ${getSalesRangeLabel(salesRange, salesFrom, salesTo)}`],
      [],
      ["Slot", "Item", "Quantity", "Revenue"],
      ...salesRows.map((row) => [row.slot, row.item, row.quantity, row.revenue]),
      [],
      ["", "TOTAL", salesUnits, salesRows.reduce((sum, row) => sum + row.revenue, 0)],
    ];

    downloadCSV(`sales-summary-${salesFrom}-to-${salesTo}.csv`, rows);
    toast.success("Sales report downloaded");
  };

  return (
    <AdminLayout crumb="Reports">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-xs text-muted-foreground">
            Shared reporting tables with one common layout, pagination, and custom date filters.
          </p>
        </div>
        <button
          onClick={() => setShowRaiseFund(true)}
          className="flex items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          <IndianRupee className="h-3.5 w-3.5" /> Raise Fund
        </button>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Stat label="Lifetime Revenue" value={formatINR(totalRevenue)} icon={Wallet} color="text-primary" />
        <Stat
          label={`Revenue (${getCustomerRangeLabel(customerRange, customerFrom, customerTo)})`}
          value={formatINR(periodRevenue)}
          icon={CalendarDays}
          color="text-success"
        />
        <Stat label="Customers" value={String(customers.length)} icon={FileSpreadsheet} color="text-info" />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <DataTableToolbar
          options={[
            { value: "today", label: "Today" },
            { value: "7d", label: "Last 7 Days" },
            { value: "all", label: "All" },
            { value: "custom", label: "Custom" },
          ]}
          activeOption={salesRange}
          onOptionChange={(value) => setSalesRange(value as "today" | "7d" | "all" | "custom")}
          fromValue={salesFrom}
          toValue={salesTo}
          onFromChange={setSalesFrom}
          onToChange={setSalesTo}
          actions={
            <button
              onClick={exportSalesReport}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" /> Export Sales
            </button>
          }
        />
      </div>

      <TablePanel
        title="Sales Summary"
        description={`${salesRows.length} line items in the selected range`}
        summary={<span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{salesUnits} units sold</span>}
        className="mb-4"
      >
        {salesRows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">No sales found for this range.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSalesRows.map((row) => (
                  <TableRow key={`${row.slot}-${row.item}`}>
                    <TableCell className="font-medium text-primary">{row.slot}</TableCell>
                    <TableCell>{row.item}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={salesPage}
              totalPages={salesTotalPages}
              onPageChange={setSalesPage}
              totalItems={salesRows.length}
              pageSize={SALES_PAGE_SIZE}
            />
          </>
        )}
      </TablePanel>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <DataTableToolbar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Search employee, ID, or department..."
          options={[
            { value: "month", label: "This Month" },
            { value: "30d", label: "Last 30 Days" },
            { value: "all", label: "All" },
            { value: "custom", label: "Custom" },
          ]}
          activeOption={customerRange}
          onOptionChange={(value) => setCustomerRange(value as "month" | "30d" | "all" | "custom")}
          fromValue={customerFrom}
          toValue={customerTo}
          onFromChange={setCustomerFrom}
          onToChange={setCustomerTo}
        />
      </div>

      <TablePanel title="Customer Reports" description={`${filteredCustomerRows.length} customers matched`}>
        {filteredCustomerRows.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">No customers matched the current filters.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Meals</TableHead>
                  <TableHead>Period Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCustomerRows.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold">
                          {customer.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </div>
                        <div className="font-semibold">{customer.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{customer.empId}</TableCell>
                    <TableCell>{customer.department}</TableCell>
                    <TableCell>{customer.orderCount}</TableCell>
                    <TableCell>{customer.meals}</TableCell>
                    <TableCell className="font-semibold">{formatINR(customer.total)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedCustomerId(customer.id)}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          View History
                        </button>
                        <button
                          onClick={() => exportCustomerReport(customer.id)}
                          className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <Download className="h-3.5 w-3.5" /> Export
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={customerPage}
              totalPages={customerTotalPages}
              onPageChange={setCustomerPage}
              totalItems={filteredCustomerRows.length}
              pageSize={CUSTOMER_PAGE_SIZE}
            />
          </>
        )}
      </TablePanel>

      {selectedCustomerId ? (
        <CustomerHistoryModal
          customer={customers.find((entry) => entry.id === selectedCustomerId)!}
          orders={customerOrdersInRange.filter((order) => order.customerId === selectedCustomerId)}
          onClose={() => setSelectedCustomerId(null)}
          onExport={() => exportCustomerReport(selectedCustomerId)}
        />
      ) : null}

      {showRaiseFund ? <RaiseFundModal customers={customers} onClose={() => setShowRaiseFund(false)} /> : null}
    </AdminLayout>
  );
}

function CustomerHistoryModal({ customer, orders, onClose, onExport }: {
  customer: { name: string; empId: string; department: string };
  orders: Order[];
  onClose: () => void;
  onExport: () => void;
}) {
  const [page, setPage] = useState(1);

  const sortedOrders = useMemo(
    () => [...orders].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [orders],
  );
  const total = sortedOrders.reduce((sum, order) => sum + order.total, 0);
  const totalMeals = sortedOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemTotal, item) => itemTotal + getOrderItemQuantity(item), 0),
    0,
  );
  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / CUSTOMER_PAGE_SIZE));
  const pagedOrders = sortedOrders.slice((page - 1) * CUSTOMER_PAGE_SIZE, page * CUSTOMER_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [customer.empId, orders.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="relative max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <div className="text-lg font-bold">Order History</div>
          <div className="text-xs text-primary">{customer.name} - {customer.empId} - {customer.department}</div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <Tile label="Orders" value={String(sortedOrders.length)} />
          <Tile label="Meals" value={String(totalMeals)} />
          <Tile label="Total Spent" value={formatINR(total)} />
        </div>

        {sortedOrders.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{formatBillingDate(order.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">#{order.orderNumber}</TableCell>
                    <TableCell>{getBillingSlotName(order)}</TableCell>
                    <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                      {order.items.map((item) => `${getOrderItemQuantity(item)}x ${item.name}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(order.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={sortedOrders.length}
              pageSize={CUSTOMER_PAGE_SIZE}
            />
          </>
        )}

        <button
          onClick={onExport}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" /> Download Report (CSV)
        </button>
      </div>
    </div>
  );
}

function matchesSalesRange(createdAt: string, range: "today" | "7d" | "all" | "custom", from: string, to: string) {
  return matchesDateRange(createdAt, range, from, to);
}

function matchesBillingRange(createdAt: string, range: "month" | "30d" | "all" | "custom", from: string, to: string) {
  if (range === "month") {
    const date = new Date(createdAt);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  if (range === "30d") {
    return Date.now() - new Date(createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000;
  }

  return matchesDateRange(createdAt, range === "custom" ? "custom" : "all", from, to);
}

function matchesDateRange(createdAt: string, range: "today" | "7d" | "all" | "custom", from: string, to: string) {
  const timestamp = new Date(createdAt).getTime();

  if (range === "all") return true;
  if (range === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return timestamp >= startOfDay.getTime();
  }
  if (range === "7d") {
    return Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000;
  }

  const parsedFrom = parseShortDateInput(from);
  const parsedTo = parseShortDateInput(to);
  if (parsedFrom && timestamp < parsedFrom.setHours(0, 0, 0, 0)) return false;
  if (parsedTo && timestamp > parsedTo.setHours(23, 59, 59, 999)) return false;
  return true;
}

function normalizeBillingStatus(status: string) {
  return String(status).trim().toLowerCase();
}

function getBillingSlotName(order: Order) {
  return (order as Order & { slot?: string }).slotName ?? (order as Order & { slot?: string }).slot ?? "Unassigned";
}

function getOrderItemQuantity(item: Order["items"][number] & { qty?: number }) {
  return item.quantity ?? item.qty ?? 0;
}

function getOrderItemUnitPrice(item: Order["items"][number] & { price?: number }) {
  return item.unitPrice ?? item.price ?? 0;
}

function getSalesRangeLabel(range: "today" | "7d" | "all" | "custom", from: string, to: string) {
  if (range === "today") return "Today";
  if (range === "7d") return "Last 7 Days";
  if (range === "all") return "All Time";
  return `${from} to ${to}`;
}

function getCustomerRangeLabel(range: "month" | "30d" | "all" | "custom", from: string, to: string) {
  if (range === "month") return "This Month";
  if (range === "30d") return "Last 30 Days";
  if (range === "all") return "All Time";
  return `${from} to ${to}`;
}

function formatBillingDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getStartOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
      <div className="text-[10px] tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Wallet; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md bg-muted ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
function RaiseFundModal({ customers, onClose }: { customers: Customer[]; onClose: () => void }) {
  const walletBalances = useStore((s) => s.walletBalances);
  const [empIdQuery, setEmpIdQuery] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (!empIdQuery.trim()) {
      toast.error("Enter an employee ID");
      return;
    }
    const match = customers.find(
      (c) => c.empId.toLowerCase() === empIdQuery.trim().toLowerCase()
    );
    setFoundCustomer(match ?? null);
    setSearched(true);
  };

  const handleSubmit = () => {
    if (!foundCustomer) return;
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    addToCustomerWallet(foundCustomer.id, num);
    toast.success(`${formatINR(num)} added to ${foundCustomer.name}'s wallet`);
    setAmount("");
    setEmpIdQuery("");
    setFoundCustomer(null);
    setSearched(false);
  };

  const currentBalance = foundCustomer
    ? (walletBalances[foundCustomer.id] ?? 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <div className="text-lg font-bold">Raise Fund</div>
          <div className="text-xs text-muted-foreground">Add funds to an employee's wallet by their Employee ID.</div>
        </div>

        {/* Search by Employee ID */}
        <div className="mb-4">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Employee ID *</div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <UserSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={empIdQuery}
                onChange={(e) => { setEmpIdQuery(e.target.value); setSearched(false); setFoundCustomer(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. EMP-2045"
                className="w-full rounded-md border border-border bg-input/40 py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              Search
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searched && !foundCustomer && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-center text-xs text-destructive">
            No employee found with ID "{empIdQuery}". Please check and try again.
          </div>
        )}

        {foundCustomer && (
          <div className="mb-4 space-y-3">
            {/* Employee card */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {foundCustomer.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{foundCustomer.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {foundCustomer.empId} · {foundCustomer.department}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md bg-card/80 px-3 py-2">
                <span className="text-[11px] font-semibold text-muted-foreground">Current Wallet Balance</span>
                <span className="text-sm font-bold text-primary">{formatINR(currentBalance)}</span>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Fund Amount (₹) *</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <input
                  value={amount}
                  onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setAmount(v); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  inputMode="decimal"
                  placeholder="Enter amount"
                  className="w-full rounded-md border border-border bg-input/40 py-2 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {amount && Number(amount) > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  New balance will be: <span className="font-semibold text-success">{formatINR(currentBalance + Number(amount))}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!foundCustomer || !amount}
            className="rounded-md bg-success px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Fund
          </button>
        </div>
      </div>
    </div>
  );
}
