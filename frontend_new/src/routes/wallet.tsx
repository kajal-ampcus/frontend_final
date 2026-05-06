import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Plus,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Pagination } from "@/components/Pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  addToWallet,
  downloadCSV,
  formatINR,
  useCurrentCustomer,
  useEntities,
  type Order,
  type WalletTransaction,
} from "@/lib/store/index";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

const PAGE_SIZE = 5;

function WalletPage() {
  const currentCustomer = useCurrentCustomer();
  const orders = useEntities<Order>("orders");
  const walletTransactions = useEntities<WalletTransaction>("walletTransactions");
  const [mounted, setMounted] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedOrderRef, setSelectedOrderRef] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const customerTransactions = useMemo(() => {
    if (!currentCustomer) return [];
    return walletTransactions
      .filter((transaction) => transaction.customerId === currentCustomer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentCustomer, walletTransactions]);

  const filteredTransactions = useMemo(() => {
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return customerTransactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }, [customerTransactions, dateRange.end, dateRange.start]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const pagedTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const customerOrders = currentCustomer
    ? orders.filter((order) => order.customerId === currentCustomer.id)
    : [];

  const monthlySpending = customerOrders
    .filter((order) => {
      const createdAt = new Date(order.createdAt);
      const now = new Date();
      return (
        order.status !== "cancelled" &&
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, order) => sum + order.total, 0);

  const selectedOrder = selectedOrderRef
    ? customerOrders.find((order) => order.orderNumber === selectedOrderRef) ?? null
    : null;

  const handleAddFunds = () => {
    if (!currentCustomer) {
      toast.error("Please log in again to continue.");
      return;
    }

    const amount = Number(addAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    addToWallet(currentCustomer.id, amount, "Wallet top-up");
    toast.success(`Added ${formatINR(amount)} to your wallet`);
    setAddAmount("");
    setShowAddFunds(false);
  };

  const handleExport = () => {
    const rows = [
      ["Date", "Type", "Description", "Reference", "Amount", "Balance"],
      ...filteredTransactions.map((transaction) => [
        formatDateTime(transaction.createdAt),
        transaction.type,
        transaction.description,
        transaction.orderId ?? "-",
        transaction.amount.toString(),
        transaction.balance.toString(),
      ]),
    ];

    downloadCSV(`wallet-transactions-${dateRange.start}-to-${dateRange.end}.csv`, rows);
    toast.success("Wallet statement exported");
  };

  return (
    <AppLayout title="Wallet">
      <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="mt-1 text-sm text-muted-foreground">View your balance and transaction history.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-6 text-white shadow-xl shadow-primary/25 md:col-span-2">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <span className="text-sm font-medium text-white/80">Available Balance</span>
              </div>
              <p className="mt-2 text-4xl font-bold">{formatINR(currentCustomer?.walletBalance ?? 0)}</p>
              <div className="mt-6 flex gap-3">
                {/* <button
                  onClick={() => setShowAddFunds(true)}
                  className="flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-all hover:bg-white/30"
                >
                  <Plus className="h-4 w-4" />
                  Add Funds
                </button> */}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-xs text-emerald-600">This Month</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold">{formatINR(monthlySpending)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold">Transaction History</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{filteredTransactions.length} transactions found</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-sm font-medium text-muted-foreground">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTransactions.map((transaction) => {
                const isOrder = Boolean(transaction.orderId);
                return (
                  <TableRow
                    key={transaction.id}
                    onClick={() => {
                      if (transaction.orderId) {
                        const order = customerOrders.find((item) => item.id === transaction.orderId);
                        if (order) {
                          setSelectedOrderRef(order.orderNumber);
                        }
                      }
                    }}
                    className={isOrder ? "cursor-pointer" : undefined}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(transaction.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          transaction.type === "credit" ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {transaction.type === "credit" ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                        {transaction.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      <span className={isOrder ? "font-medium text-primary" : "text-muted-foreground"}>
                        {transaction.orderId ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-right font-bold ${transaction.type === "credit" ? "text-emerald-600" : "text-foreground"}`}>
                      {transaction.type === "credit" ? "+" : "-"}
                      {formatINR(transaction.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-bold text-muted-foreground">
                      {formatINR(transaction.balance)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={filteredTransactions.length}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>

      {showAddFunds && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddFunds(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Add Funds</h2>
            <p className="mt-1 text-sm text-muted-foreground">Top up your wallet balance.</p>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-semibold">Amount (INR)</label>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Enter amount"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowAddFunds(false)}
                className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFunds}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 active:scale-95"
              >
                Add Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrderRef(null);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="relative bg-[#EA580C] p-6 text-white">
              <button
                onClick={() => setSelectedOrderRef(null)}
                className="absolute right-4 top-4 rounded-full border-2 border-white/30 p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="text-xs font-bold uppercase tracking-wider text-white/90">Order Details</div>
              <h2 className="mt-1 text-3xl font-extrabold">{selectedOrder.orderNumber}</h2>
              <div className="mt-4 flex items-center gap-3 text-sm font-medium">
                <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-md">{selectedOrder.status}</span>
                <span className="text-white/90">{formatDateTime(selectedOrder.createdAt)}</span>
              </div>
            </div>

            <div className="p-6">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order Items</div>
              <div className="mt-4 space-y-4">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {item.quantity}x
                      </span>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold">{formatINR(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="my-6 border-t border-border" />

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total Amount</span>
                <span className="text-2xl font-bold text-[#EA580C]">{formatINR(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
