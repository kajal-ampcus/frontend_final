import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "./admin-orders";
import {
  useAcceptOrderByCounter,
  useAdminOrders,
  useCollectOrder,
  useVerifyOrderCode,
  type CmsOrder,
} from "@/hooks/useCanteen";
import { formatINR } from "@/lib/store";
import {
  CheckSquare,
  Search,
  Clock,
  User,
  Calendar,
  XCircle,
  Receipt,
  Printer,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-counter")({ component: AdminCounter });

function AdminCounter() {
  const verifyOrderMutation = useVerifyOrderCode();
  const collectOrderMutation = useCollectOrder();
  const acceptOrderMutation = useAcceptOrderByCounter();
  const { data: preparedOrders = [] } = useAdminOrders({ status: "PREPARED" });
  const { data: collectedOrders = [] } = useAdminOrders({ status: "COLLECTED" });
  const [orderCode, setOrderCode] = useState("");
  const [verifiedOrder, setVerifiedOrder] = useState<CmsOrder | null>(null);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [currentDate, setCurrentDate] = useState("");

  const quickFillCodes = useMemo(
    () => preparedOrders.slice(0, 4).map((order) => order.order_code),
    [preparedOrders],
  );

  const recentCollections = useMemo(
    () =>
      collectedOrders.slice(0, 10).map((order) => ({
        id: order.id,
        orderCode: order.order_code,
        customerName: order.employee_name,
        amount: Number(order.total_amount),
        timestamp: formatTime(order.collected_at ?? order.created_at),
      })),
    [collectedOrders],
  );

  useEffect(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    setCurrentDate(today.toLocaleDateString("en-US", options));
  }, []);

  const verifyOrder = async () => {
    if (!orderCode.trim()) {
      setError("Please enter an order code");
      return;
    }

    setError("");

    try {
      const response = await verifyOrderMutation.mutateAsync(orderCode.trim());
      setVerifiedOrder(response.order);
    } catch (err) {
      setVerifiedOrder(null);
      setError(err instanceof Error ? err.message : "Order not found.");
    }
  };

  const handleQuickFill = (code: string) => {
    setOrderCode(code);
    setError("");
  };

  const generateReceiptHTML = (order: CmsOrder) => {
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Canteen Receipt - ${order.order_code}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            background: white;
            width: 300px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .subtitle {
            font-size: 12px;
            color: #666;
          }
          .order-info {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 12px;
          }
          .items-section {
            margin-bottom: 20px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 12px;
          }
          .item-name {
            flex: 1;
          }
          .item-qty {
            margin-right: 10px;
            text-align: center;
          }
          .item-price {
            text-align: right;
            min-width: 60px;
          }
          .total-section {
            border-top: 2px dashed #000;
            padding-top: 10px;
            margin-top: 20px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 10px;
            color: #666;
            border-top: 2px dashed #000;
            padding-top: 10px;
          }
          .status {
            display: inline-block;
            padding: 2px 8px;
            background: #4CAF50;
            color: white;
            font-size: 10px;
            border-radius: 10px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">CANTEEN RECEIPT</div>
          <div class="subtitle">Employee Meal Service</div>
        </div>
        
        <div class="order-info">
          <div class="status">${order.status}</div>
          <div class="info-row">
            <span>Order ID:</span>
            <span>${order.order_code}</span>
          </div>
          <div class="info-row">
            <span>Date:</span>
            <span>${new Date().toLocaleDateString()}</span>
          </div>
          <div class="info-row">
            <span>Time:</span>
            <span>${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="info-row">
            <span>Customer:</span>
            <span>${order.employee_name}</span>
          </div>
          <div class="info-row">
            <span>Employee Code:</span>
            <span>${order.employee_code}</span>
          </div>
          <div class="info-row">
            <span>Time Slot:</span>
            <span>${order.slot_name}</span>
          </div>
        </div>
        
        <div class="items-section">
          <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">ORDER ITEMS</div>
          ${order.order_items.map((item) => `
            <div class="item-row">
              <span class="item-name">${item.item_name_snapshot}</span>
              <span class="item-qty">x${item.quantity}</span>
              <span class="item-price">${formatINR(Number(item.line_total))}</span>
            </div>
          `).join("")}
        </div>
        
        <div class="total-section">
          <div class="total-row">
            <span>TOTAL AMOUNT:</span>
            <span>${formatINR(Number(order.total_amount))}</span>
          </div>
        </div>
        
        <div class="footer">
          <div>Thank you for your order!</div>
          <div>Please present this receipt at the counter</div>
          <div style="margin-top: 10px;">Generated: ${new Date().toLocaleString()}</div>
        </div>
      </body>
      </html>
    `;
    return receiptHTML;
  };

  const printReceipt = (order: CmsOrder) => {
    const receiptHTML = generateReceiptHTML(order);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const collectAndPrint = async () => {
    if (!verifiedOrder) return;

    try {
      const updatedOrder = await collectOrderMutation.mutateAsync({ orderId: verifiedOrder.id });
      printReceipt(updatedOrder);
      toast.success(`Order ${updatedOrder.order_code} collected.`);
      setVerifiedOrder(null);
      setOrderCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to collect order.");
    }
  };

  const acceptOrder = async () => {
    if (!verifiedOrder) return;

    try {
      const updatedOrder = await acceptOrderMutation.mutateAsync(verifiedOrder.id);
      setVerifiedOrder(updatedOrder);
      toast.success(`Order ${updatedOrder.order_code} accepted for kitchen.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept order.");
    }
  };

  const cancelOrder = () => {
    setVerifiedOrder(null);
    setOrderCode("");
    setError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void verifyOrder();
    }
  };

  return (
    <AdminLayout crumb="Counter Station">
      <div className="min-h-screen bg-background p-6 text-foreground md:p-8">
        <div className="mx-auto mb-8 flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef7f1a] text-white">
              <CheckSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#23160d] dark:text-[#fff3e5]">Counter Station</h1>
              <p className="text-sm text-[#7d6a56] dark:text-[#c8af95]">{currentDate}</p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-8 dark:border-[#4c3020] dark:bg-[#17100c]">
            <div className="mb-6">
              <h3 className="mb-2 text-3xl font-bold tracking-tight text-[#23160d] dark:text-[#fff3e5]">Scan or Enter Code</h3>
              <p className="text-sm text-[#7d6a56] dark:text-[#c8af95]">
                Verify pickup codes quickly and keep the collection desk flow clean and consistent.
              </p>
            </div>

            <div className="mb-6 flex gap-4">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7a65] dark:text-[#b99d80]">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyPress}
                  placeholder="CMS-XXXXXX"
                  className="w-full rounded-2xl border border-[#e6d6c3] bg-[#fff8ef] py-3 pl-10 pr-4 font-mono text-lg text-[#23160d] placeholder:text-[#9e8d7a] focus:border-[#e18b2c] focus:outline-none focus:ring-2 focus:ring-[#f3b66c]/30 dark:border-[#533525] dark:bg-[#221712] dark:text-[#fff2e3] dark:placeholder:text-[#9b8167]"
                />
              </div>
              <button
                onClick={() => void verifyOrder()}
                disabled={verifyOrderMutation.isPending}
                className="rounded-2xl bg-[#ef7f1a] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#dd7418] disabled:bg-muted disabled:opacity-50"
              >
                {verifyOrderMutation.isPending ? "VERIFYING..." : "VERIFY"}
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {quickFillCodes.map((code) => (
                <button
                  key={code}
                  onClick={() => handleQuickFill(code)}
                  className="rounded-2xl border border-[#e6d6c3] bg-[#fff8ef] px-4 py-2 font-mono text-sm text-[#3a281b] transition-colors hover:bg-[#fff2e2] dark:border-[#4d3223] dark:bg-[#221712] dark:text-[#eedbc8] dark:hover:bg-[#2c1d16]"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {verifiedOrder && (
            <div className="rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-8 dark:border-[#4c3020] dark:bg-[#17100c]">
              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[#23160d] dark:text-[#fff3e5]">Order Receipt</h3>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${getStatusBadgeClass(verifiedOrder.status)}`}>
                      {verifiedOrder.status}
                    </span>
                    <span className="font-mono text-sm text-[#8d7a65] dark:text-[#b99d80]">
                      {verifiedOrder.order_code}
                    </span>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-[#eadfce] bg-[#fff8ef] p-4 dark:border-[#4d3122] dark:bg-[#221712] sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">EMP. NAME</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{verifiedOrder.employee_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">EMPLOYEE ID</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{verifiedOrder.employee_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">CANTEEN</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{verifiedOrder.canteen_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">SLOT</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{verifiedOrder.slot_name || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6 space-y-2">
                  <h4 className="text-sm font-semibold text-[#8d7a65] dark:text-[#b99d80]">ORDER ITEMS</h4>
                  <div className="space-y-2">
                    {verifiedOrder.order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[#eadfce] bg-white p-3 dark:border-[#4d3122] dark:bg-[#211611]">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[#fff1dd] px-2 py-1 text-xs font-bold text-[#d36f18]">
                            +{item.quantity}
                          </span>
                          <span className="font-medium dark:text-[#fff3e5]">{item.item_name_snapshot}</span>
                        </div>
                        <span className="font-semibold text-[#d36f18]">
                          {formatINR(Number(item.line_total))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold dark:text-[#fff3e5]">TOTAL AMOUNT</span>
                    <span className="text-2xl font-bold text-[#d36f18]">
                      {formatINR(Number(verifiedOrder.total_amount))}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  {verifiedOrder.status === "PREPARED" && (
                    <button
                      onClick={() => void collectAndPrint()}
                      disabled={collectOrderMutation.isPending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#ef7f1a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#dd7418] disabled:opacity-60"
                    >
                      <Printer className="h-5 w-5" />
                      {collectOrderMutation.isPending ? "Collecting..." : "Collect & Print"}
                    </button>
                  )}
                  {verifiedOrder.status === "PENDING" && (
                    <button
                      onClick={() => void acceptOrder()}
                      disabled={acceptOrderMutation.isPending}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#ef7f1a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#dd7418] disabled:opacity-60"
                    >
                      <CheckSquare className="h-5 w-5" />
                      {acceptOrderMutation.isPending ? "Accepting..." : "Accept Order"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowPreview(true)}
                    className="rounded-2xl border border-[#e6d6c3] bg-[#fff8ef] px-6 py-3 font-semibold text-[#3a281b] transition-colors hover:bg-[#fff2e2] dark:border-[#4d3223] dark:bg-[#221712] dark:text-[#eedbc8] dark:hover:bg-[#2c1d16]"
                  >
                    <Eye className="mr-2 inline h-5 w-5" />
                    Preview
                  </button>
                  <button
                    onClick={cancelOrder}
                    className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-3 font-semibold text-destructive transition-colors hover:bg-destructive/20"
                  >
                    <X className="mr-2 inline h-5 w-5" />
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-8 dark:border-[#4c3020] dark:bg-[#17100c]">
            <h3 className="mb-4 text-lg font-bold text-[#d36f18]">
              RECENT COLLECTIONS ({recentCollections.length})
            </h3>
            <div className="space-y-2">
              {recentCollections.map((collection) => (
                <div key={collection.id} className="flex items-center justify-between rounded-2xl border border-[#eadfce] bg-white p-3 transition-colors hover:bg-[#fffaf4] dark:border-[#4d3122] dark:bg-[#211611] dark:hover:bg-[#281b15]">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <div>
                      <p className="font-mono text-sm font-semibold dark:text-[#fff3e5]">{collection.orderCode}</p>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">{collection.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#d36f18]">{formatINR(collection.amount)}</p>
                    <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">{collection.timestamp}</p>
                  </div>
                </div>
              ))}
              {recentCollections.length === 0 && (
                <div className="py-8 text-center text-[#8d7a65] dark:text-[#b99d80]">
                  <Receipt className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p className="text-sm">No recent collections</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {showPreview && verifiedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-6 dark:border-[#4c3020] dark:bg-[#17100c]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#23160d] dark:text-[#fff3e5]">Receipt Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-xl p-2 text-[#8d7a65] hover:bg-[#fff2e2] dark:text-[#b99d80] dark:hover:bg-[#2a1c16]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-lg bg-white p-4 text-black" style={{ fontFamily: "Courier New, monospace" }}>
                <div className="mb-4 border-b-2 border-dashed border-gray-400 pb-2 text-center">
                  <div className="text-xl font-bold">CANTEEN RECEIPT</div>
                  <div className="text-xs text-gray-600">Employee Meal Service</div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 inline-block rounded-full bg-green-500 px-2 py-1 text-xs text-white">{verifiedOrder.status}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><strong>Order ID:</strong> {verifiedOrder.order_code}</div>
                    <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                    <div><strong>Time:</strong> {new Date().toLocaleTimeString()}</div>
                    <div><strong>Customer:</strong> {verifiedOrder.employee_name}</div>
                    <div><strong>Employee:</strong> {verifiedOrder.employee_code}</div>
                    <div><strong>Time Slot:</strong> {verifiedOrder.slot_name}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-sm font-bold">ORDER ITEMS</div>
                  {verifiedOrder.order_items.map((item) => (
                    <div key={item.id} className="mb-1 flex justify-between text-xs">
                      <span>{item.item_name_snapshot}</span>
                      <span>x{item.quantity}</span>
                      <span className="font-semibold">{formatINR(Number(item.line_total))}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-dashed border-gray-400 pt-2">
                  <div className="flex justify-between text-sm font-bold">
                    <span>TOTAL AMOUNT:</span>
                    <span className="text-amber-600">{formatINR(Number(verifiedOrder.total_amount))}</span>
                  </div>
                </div>

                <div className="mt-4 border-t-2 border-dashed border-gray-400 pt-2 text-center text-xs text-gray-600">
                  <div>Thank you for your order!</div>
                  <div>Please present this receipt at the counter</div>
                  <div className="mt-1">Generated: {new Date().toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function getStatusBadgeClass(status: CmsOrder["status"]) {
  switch (status) {
    case "PREPARED":
      return "bg-emerald-100 text-emerald-700";
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    case "ACCEPTED":
      return "bg-sky-100 text-sky-700";
    case "PREPARING":
      return "bg-orange-100 text-orange-700";
    case "COLLECTED":
      return "bg-emerald-100 text-emerald-700";
    case "CANCELLED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
