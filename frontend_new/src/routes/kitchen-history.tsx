import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DataTableToolbar,
  formatShortDateInput,
  parseShortDateInput,
} from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCSV, formatINR, useEntities, type Order } from "@/lib/store";
import { KitchenLayout } from "./kitchen";

export const Route = createFileRoute("/kitchen-history")({ component: KitchenHistory });

const PAGE_SIZE = 8;
type HistoryRange = "24h" | "7d" | "all" | "custom";

function KitchenHistory() {
  const orders = useEntities<Order>("orders");
  const [range, setRange] = useState<HistoryRange>("24h");
  const [slotFilter, setSlotFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [customFrom, setCustomFrom] = useState(formatShortDateInput(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [customTo, setCustomTo] = useState(formatShortDateInput(new Date()));

  const completedOrders = useMemo(
    () =>
      orders
        .filter((order) => ["collected", "completed", "delivered"].includes(order.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [orders]
  );

  const slotOptions = useMemo(
    () => ["All", ...Array.from(new Set(completedOrders.map((order) => order.slotName)))],
    [completedOrders]
  );

  const filteredOrders = useMemo(() => {
    const now = Date.now();

    return completedOrders.filter((order) => {
      const updatedAt = new Date(order.updatedAt).getTime();

      if (range === "24h" && now - updatedAt > 24 * 60 * 60 * 1000) return false;
      if (range === "7d" && now - updatedAt > 7 * 24 * 60 * 60 * 1000) return false;
      if (range === "custom") {
        const from = parseShortDateInput(customFrom);
        const to = parseShortDateInput(customTo);
        if (from && updatedAt < from.setHours(0, 0, 0, 0)) return false;
        if (to && updatedAt > to.setHours(23, 59, 59, 999)) return false;
      }
      if (slotFilter !== "All" && order.slotName !== slotFilter) return false;

      return true;
    });
  }, [completedOrders, customFrom, customTo, range, slotFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [range, slotFilter]);

  const handleExport = () => {
    if (filteredOrders.length === 0) return;

    const rows = [
      ["Order ID", "Employee", "Department", "Slot", "Items", "Total", "Completed At", "Status"],
      ...filteredOrders.map((order) => [
        order.orderNumber,
        order.customerName,
        order.department,
        order.slotName,
        order.items.map((item) => `${item.quantity}x ${item.name}`).join(", "),
        formatINR(order.total),
        new Date(order.updatedAt).toLocaleString(),
        order.status,
      ]),
    ];

    downloadCSV(`kitchen-history-${range}-${slotFilter.toLowerCase()}.csv`, rows);
  };

  return (
    <KitchenLayout title="Order History">
      <div className="mb-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <DataTableToolbar
            options={[
              { value: "24h", label: "Last 24 Hours" },
              { value: "7d", label: "Last 7 Days" },
              { value: "all", label: "All Time" },
              { value: "custom", label: "Custom" },
            ]}
            activeOption={range}
            onOptionChange={(value) => {
              setRange(value as HistoryRange);
              setPage(1);
            }}
            fromValue={customFrom}
            toValue={customTo}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
            extraFilters={
              <select
                value={slotFilter}
                onChange={(e) => {
                  setSlotFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                {slotOptions.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            }
            actions={
              <button
                onClick={handleExport}
                disabled={filteredOrders.length === 0}
                className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
            }
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[10px] tracking-widest text-muted-foreground">Total Orders</div>
          <div className="mt-2 text-3xl font-bold text-primary">{filteredOrders.length}</div>
        </div>
      </div>

      <TablePanel
        title="Order History"
        description={`${filteredOrders.length} completed orders found`}
      >
        {pagedOrders.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">No completed orders match this filter.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.updatedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                      {order.status.toUpperCase()}
                    </span>
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
          totalItems={filteredOrders.length}
          pageSize={PAGE_SIZE}
        />
      </TablePanel>
    </KitchenLayout>
  );
}
