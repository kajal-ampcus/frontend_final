import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileSpreadsheet, IndianRupee, UserSearch, Wallet, X, Loader2 } from "lucide-react";

import { AdminLayout } from "./admin-orders";
import {
  DataTableToolbar,
  formatShortDateInput,
  parseShortDateInput,
} from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV, formatINR } from "@/lib/store";
import { toast } from "sonner";
import {
  fetchSalesReport,
  fetchCustomerReport,
  fetchCustomerOrders,
  addWalletFund,
  searchEmployee,
  type SalesRow,
  type CustomerRow,
  type AdminOrder,
  type SalesReportParams,
  type CustomerReportParams,
} from "@/api/admin";

export const Route = createFileRoute("/admin-billing")({ component: AdminBilling });

const CUSTOMER_PAGE_SIZE = 8;
const SALES_PAGE_SIZE = 10;

function AdminBilling() {
  // Sales state
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesTotalUnits, setSalesTotalUnits] = useState(0);
  const [salesTotalRevenue, setSalesTotalRevenue] = useState(0);
  const [salesTotalCount, setSalesTotalCount] = useState(0);
  const [salesTotalPages, setSalesTotalPages] = useState(1);

  // Customer state
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerTotalCount, setCustomerTotalCount] = useState(0);
  const [customerTotalPages, setCustomerTotalPages] = useState(1);
  const [periodRevenue, setPeriodRevenue] = useState(0);
  const [lifetimeRevenue, setLifetimeRevenue] = useState(0);

  // Filters
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

  // Fetch sales report
  useEffect(() => {
    let mounted = true;

    async function loadSales() {
      try {
        setSalesLoading(true);

        const params: SalesReportParams = {
          page: salesPage,
          page_size: SALES_PAGE_SIZE,
        };

        if (salesRange === "today") {
          params.range = "today";
        } else if (salesRange === "7d") {
          params.range = "7d";
        } else if (salesRange === "all") {
          params.range = "all";
        } else if (salesRange === "custom") {
          const from = parseShortDateInput(salesFrom);
          const to = parseShortDateInput(salesTo);
          if (from) params.date_from = from.toISOString().slice(0, 10);
          if (to) params.date_to = to.toISOString().slice(0, 10);
        }

        const response = await fetchSalesReport(params);

        if (mounted) {
          setSalesRows(response.results);
          setSalesTotalCount(response.count);
          setSalesTotalPages(response.totalPages);
          setSalesTotalUnits(response.totalUnits);
          setSalesTotalRevenue(response.totalRevenue);
        }
      } catch (err: any) {
        if (mounted) {
          toast.error(err.message || "Failed to load sales report");
        }
      } finally {
        if (mounted) {
          setSalesLoading(false);
        }
      }
    }

    loadSales();

    return () => {
      mounted = false;
    };
  }, [salesPage, salesRange, salesFrom, salesTo]);

  // Fetch customer report
  useEffect(() => {
    let mounted = true;

    async function loadCustomers() {
      try {
        setCustomersLoading(true);

        const params: CustomerReportParams = {
          page: customerPage,
          page_size: CUSTOMER_PAGE_SIZE,
        };

        if (customerRange === "month") {
          params.range = "month";
        } else if (customerRange === "30d") {
          params.range = "30d";
        } else if (customerRange === "all") {
          params.range = "all";
        } else if (customerRange === "custom") {
          const from = parseShortDateInput(customerFrom);
          const to = parseShortDateInput(customerTo);
          if (from) params.date_from = from.toISOString().slice(0, 10);
          if (to) params.date_to = to.toISOString().slice(0, 10);
        }

        if (query.trim()) {
          params.search = query.trim();
        }

        const response = await fetchCustomerReport(params);

        if (mounted) {
          setCustomerRows(response.results);
          setCustomerTotalCount(response.count);
          setCustomerTotalPages(response.totalPages);
          setPeriodRevenue(response.totalRevenue);
          setLifetimeRevenue(response.lifetimeRevenue);
        }
      } catch (err: any) {
        if (mounted) {
          toast.error(err.message || "Failed to load customer report");
        }
      } finally {
        if (mounted) {
          setCustomersLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      mounted = false;
    };
  }, [customerPage, customerRange, customerFrom, customerTo, query]);

  // Reset pages when filters change
  useEffect(() => {
    setCustomerPage(1);
  }, [customerFrom, customerRange, customerTo, query]);

  useEffect(() => {
    setSalesPage(1);
  }, [salesFrom, salesRange, salesTo]);

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
      ["", "TOTAL", salesTotalUnits, salesTotalRevenue],
    ];

    downloadCSV(rows, `sales-summary-${salesFrom}-to-${salesTo}`);
    toast.success("Sales report downloaded");
  };

  return (
    <AdminLayout crumb="Reports">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-xs text-muted-foreground">
            Sales and customer reports from backend.
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
        <Stat label="Lifetime Revenue" value={formatINR(lifetimeRevenue)} icon={Wallet} color="text-primary" />
        <Stat
          label={`Revenue (${getCustomerRangeLabel(customerRange, customerFrom, customerTo)})`}
          value={formatINR(periodRevenue)}
          icon={CalendarDays}
          color="text-success"
        />
        <Stat label="Customers" value={String(customerTotalCount)} icon={FileSpreadsheet} color="text-info" />
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
        description={`${salesTotalCount} line items in the selected range`}
        summary={<span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{salesTotalUnits} units sold</span>}
        className="mb-4"
      >
        {salesLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : salesRows.length === 0 ? (
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
                {salesRows.map((row) => (
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
              totalItems={salesTotalCount}
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

      <TablePanel title="Customer Reports" description={`${customerTotalCount} customers matched`}>
        {customersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : customerRows.length === 0 ? (
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
                {customerRows.map((customer) => (
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
                          onClick={() => exportCustomerReport(customer)}
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
              totalItems={customerTotalCount}
              pageSize={CUSTOMER_PAGE_SIZE}
            />
          </>
        )}
      </TablePanel>

      {selectedCustomerId && (
        <CustomerHistoryModal
          customerId={selectedCustomerId}
          customerRange={customerRange}
          customerFrom={customerFrom}
          customerTo={customerTo}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}

      {showRaiseFund && <RaiseFundModal onClose={() => setShowRaiseFund(false)} />}
    </AdminLayout>
  );
}

function exportCustomerReport(customer: CustomerRow) {
  const rows: Array<Array<string | number>> = [
    [`Statement - ${customer.name} (${customer.empId})`],
    [`Department: ${customer.department}`],
    [],
    ["Orders", "Meals", "Total"],
    [customer.orderCount, customer.meals, customer.total],
  ];

  downloadCSV(rows, `${customer.empId}-report`);
  toast.success("Customer report downloaded");
}

function CustomerHistoryModal({
  customerId,
  customerRange,
  customerFrom,
  customerTo,
  onClose,
}: {
  customerId: string;
  customerRange: "month" | "30d" | "all" | "custom";
  customerFrom: string;
  customerTo: string;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<{ name: string; empId: string; department: string } | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalMeals, setTotalMeals] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      try {
        setLoading(true);

        const params: CustomerReportParams = {
          page,
          page_size: CUSTOMER_PAGE_SIZE,
        };

        if (customerRange === "month") {
          params.range = "month";
        } else if (customerRange === "30d") {
          params.range = "30d";
        } else if (customerRange === "all") {
          params.range = "all";
        } else if (customerRange === "custom") {
          const from = parseShortDateInput(customerFrom);
          const to = parseShortDateInput(customerTo);
          if (from) params.date_from = from.toISOString().slice(0, 10);
          if (to) params.date_to = to.toISOString().slice(0, 10);
        }

        const response = await fetchCustomerOrders(customerId, params);

        if (mounted) {
          setOrders(response.results);
          setCustomer(response.customer);
          setTotalSpent(response.totalSpent);
          setTotalMeals(response.totalMeals);
          setTotalPages(response.totalPages);
          setTotalCount(response.count);
        }
      } catch (err: any) {
        if (mounted) {
          toast.error(err.message || "Failed to load customer orders");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      mounted = false;
    };
  }, [customerId, customerRange, customerFrom, customerTo, page]);

  const handleExport = () => {
    if (!customer || orders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    const rows: Array<Array<string | number>> = [
      [`Statement - ${customer.name} (${customer.empId})`],
      [`Department: ${customer.department}`],
      [`Range: ${getCustomerRangeLabel(customerRange, customerFrom, customerTo)}`],
      [],
      ["Date", "Order #", "Slot", "Items", "Amount"],
    ];

    for (const order of orders) {
      const itemsStr = order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ");
      rows.push([
        formatBillingDate(order.createdAt),
        order.orderNumber,
        order.slotName,
        itemsStr,
        order.total,
      ]);
    }

    rows.push([], ["", "", "", "TOTAL", totalSpent]);
    downloadCSV(rows, `${customer.empId}-${customerFrom}-to-${customerTo}`);
    toast.success("Customer report downloaded");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="relative max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4">
          <div className="text-lg font-bold">Order History</div>
          {customer && (
            <div className="text-xs text-primary">
              {customer.name} - {customer.empId} - {customer.department}
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <Tile label="Orders" value={String(totalCount)} />
          <Tile label="Meals" value={String(totalMeals)} />
          <Tile label="Total Spent" value={formatINR(totalSpent)} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
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
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{formatBillingDate(order.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">#{order.orderNumber}</TableCell>
                    <TableCell>{order.slotName}</TableCell>
                    <TableCell className="max-w-[360px] text-sm text-muted-foreground">
                      {order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}
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
              totalItems={totalCount}
              pageSize={CUSTOMER_PAGE_SIZE}
            />
          </>
        )}

        <button
          onClick={handleExport}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" /> Download Report (CSV)
        </button>
      </div>
    </div>
  );
}

function RaiseFundModal({ onClose }: { onClose: () => void }) {
  const [empIdQuery, setEmpIdQuery] = useState("");
  const [foundEmployee, setFoundEmployee] = useState<{
    id: string;
    name: string;
    empId: string;
    department: string;
    walletBalance: number;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!empIdQuery.trim()) {
      toast.error("Enter an employee ID");
      return;
    }

    try {
      setSearching(true);
      setSearched(false);
      setFoundEmployee(null);

      const response = await searchEmployee(empIdQuery.trim());

      setSearched(true);
      if (response.found && response.employee) {
        setFoundEmployee(response.employee);
      }
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!foundEmployee) return;

    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    try {
      setSubmitting(true);

      const response = await addWalletFund({
        employee_id: foundEmployee.id,
        amount: num,
        reason: "Admin credit",
      });

      toast.success(`${formatINR(response.amount)} added to ${response.employee.name}'s wallet`);

      // Update local state with new balance
      setFoundEmployee((prev) =>
        prev ? { ...prev, walletBalance: response.newBalance } : null
      );
      setAmount("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add funds");
    } finally {
      setSubmitting(false);
    }
  };

  const currentBalance = foundEmployee?.walletBalance ?? 0;

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
                onChange={(e) => {
                  setEmpIdQuery(e.target.value);
                  setSearched(false);
                  setFoundEmployee(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. EMP-2045"
                className="w-full rounded-md border border-border bg-input/40 py-2 pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searched && !foundEmployee && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-center text-xs text-destructive">
            No employee found with ID "{empIdQuery}". Please check and try again.
          </div>
        )}

        {foundEmployee && (
          <div className="mb-4 space-y-3">
            {/* Employee card */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {foundEmployee.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{foundEmployee.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {foundEmployee.empId} · {foundEmployee.department}
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
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d*\.?\d*$/.test(v)) setAmount(v);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  inputMode="decimal"
                  placeholder="Enter amount"
                  className="w-full rounded-md border border-border bg-input/40 py-2 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {amount && Number(amount) > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  New balance will be:{" "}
                  <span className="font-semibold text-success">{formatINR(currentBalance + Number(amount))}</span>
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
            disabled={!foundEmployee || !amount || submitting}
            className="rounded-md bg-success px-5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Fund"}
          </button>
        </div>
      </div>
    </div>
  );
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
