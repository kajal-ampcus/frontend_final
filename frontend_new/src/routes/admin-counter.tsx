import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AdminLayout } from "./admin-orders";
import { useStore, formatINR, type Order } from "@/lib/store";
import { 
  CheckSquare, 
  Search, 
  Clock, 
  User, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Receipt,
  Printer,
  Eye,
  X,
  LogOut
} from "lucide-react";

export const Route = createFileRoute("/admin-counter")({ component: AdminCounter });

interface RecentCollection {
  id: string;
  orderCode: string;
  customerName: string;
  amount: number;
  timestamp: string;
  status: "collected" | "processing";
}

function AdminCounter() {
  const orders = useStore((s) => s.orders);
  const [orderCode, setOrderCode] = useState("");
  const [verifiedOrder, setVerifiedOrder] = useState<Order | null>(null);
  const [recentCollections, setRecentCollections] = useState<RecentCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [currentDate, setCurrentDate] = useState("");

  // Quick fill sample order codes
  const quickFillCodes = ["CMS-001234", "CMS-000678", "CMS-003999", "CMS-112233"];

  // Set current date
  useEffect(() => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  // Mock recent collections data
  useEffect(() => {
    const mockRecent: RecentCollection[] = [
      {
        id: "1",
        orderCode: "CMS-003391",
        customerName: "Sneha Kapoor",
        amount: 1295,
        timestamp: "11:42 AM",
        status: "collected"
      },
      {
        id: "2", 
        orderCode: "CMS-007723",
        customerName: "Vikram Bose",
        amount: 1210,
        timestamp: "11:38 AM",
        status: "collected"
      },
      {
        id: "3",
        orderCode: "CMS-002244", 
        customerName: "Ananya Iyer",
        amount: 1340,
        timestamp: "11:30 AM",
        status: "collected"
      },
      {
        id: "4",
        orderCode: "CMS-005567",
        customerName: "Rahul Sharma",
        amount: 980,
        timestamp: "11:25 AM",
        status: "collected"
      },
      {
        id: "5",
        orderCode: "CMS-008901",
        customerName: "Priya Nair",
        amount: 1450,
        timestamp: "11:20 AM",
        status: "collected"
      }
    ];
    setRecentCollections(mockRecent);
  }, []);

  const verifyOrder = () => {
    if (!orderCode.trim()) {
      setError("Please enter an order code");
      return;
    }

    setIsLoading(true);
    setError("");

    // Simulate API call to verify order
    setTimeout(() => {
      const foundOrder = orders.find(order => 
        order.orderNumber.toLowerCase() === orderCode.toLowerCase()
      );

      if (foundOrder) {
        setVerifiedOrder(foundOrder);
        setError("");
      } else {
        // Create a mock order for demo purposes
        const mockOrder: Order = {
          id: "mock-order",
          orderNumber: orderCode,
          customerId: "mock-customer",
          customerName: "Rohan Mehta",
          department: "Engineering",
          slot: "12:30 PM - 1:00 PM",
          items: [
            { itemId: "1", name: "Dal Makhani", qty: 1, price: 120 },
            { itemId: "2", name: "Jeera Rice", qty: 1, price: 50 },
            { itemId: "3", name: "Roti", qty: 8, price: 5 },
            { itemId: "4", name: "Curd", qty: 1, price: 20 }
          ],
          total: 245,
          status: "Ready",
          createdAt: new Date().toISOString()
        };
        setVerifiedOrder(mockOrder);
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleQuickFill = (code: string) => {
    setOrderCode(code);
    setError("");
  };

  const generateReceiptHTML = (order: Order) => {
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Canteen Receipt - ${order.orderNumber}</title>
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
          <div class="status">PREPARED</div>
          <div class="info-row">
            <span>Order ID:</span>
            <span>${order.orderNumber}</span>
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
            <span>${order.customerName}</span>
          </div>
          <div class="info-row">
            <span>Department:</span>
            <span>${order.department}</span>
          </div>
          <div class="info-row">
            <span>Time Slot:</span>
            <span>${order.slot}</span>
          </div>
        </div>
        
        <div class="items-section">
          <div style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">ORDER ITEMS</div>
          ${order.items.map(item => `
            <div class="item-row">
              <span class="item-name">${item.name}</span>
              <span class="item-qty">x${item.qty}</span>
              <span class="item-price">${formatINR(item.price * item.qty)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="total-section">
          <div class="total-row">
            <span>TOTAL AMOUNT:</span>
            <span>${formatINR(order.total)}</span>
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

  const collectAndPrint = () => {
    if (!verifiedOrder) return;

    // Add to recent collections
    const newCollection: RecentCollection = {
      id: Date.now().toString(),
      orderCode: verifiedOrder.orderNumber,
      customerName: verifiedOrder.customerName,
      amount: verifiedOrder.total,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "collected"
    };

    setRecentCollections(prev => [newCollection, ...prev.slice(0, 9)]); // Keep only 10 recent
    
    // Generate and print receipt
    const receiptHTML = generateReceiptHTML(verifiedOrder);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
    
    // Reset form
    setVerifiedOrder(null);
    setOrderCode("");
  };

  const cancelOrder = () => {
    setVerifiedOrder(null);
    setOrderCode("");
    setError("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      verifyOrder();
    }
  };

  return (
    <AdminLayout crumb="Counter Station">
      <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
        {/* Header */}
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
          {/* Order Verification Section */}
          <div className="rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-8 dark:border-[#4c3020] dark:bg-[#17100c]">
            <div className="mb-6">
              <h3 className="mb-2 text-3xl font-bold tracking-tight text-[#23160d] dark:text-[#fff3e5]">Scan or Enter Code</h3>
              <p className="text-sm text-[#7d6a56] dark:text-[#c8af95]">
                Verify pickup codes quickly and keep the collection desk flow clean and consistent.
              </p>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8d7a65] dark:text-[#b99d80]">
                  <Search className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="CMS - XXXXXX"
                  className="w-full rounded-2xl border border-[#e6d6c3] bg-[#fff8ef] py-3 pl-10 pr-4 font-mono text-lg text-[#23160d] placeholder:text-[#9e8d7a] focus:outline-none focus:ring-2 focus:ring-[#f3b66c]/30 focus:border-[#e18b2c] dark:border-[#533525] dark:bg-[#221712] dark:text-[#fff2e3] dark:placeholder:text-[#9b8167]"
                />
              </div>
              <button
                onClick={verifyOrder}
                disabled={isLoading}
                className="rounded-2xl bg-[#ef7f1a] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#dd7418] disabled:bg-muted disabled:opacity-50"
              >
                {isLoading ? "VERIFYING..." : "VERIFY"}
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                <p className="text-sm text-destructive flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {error}
                </p>
              </div>
            )}

            {/* Quick Fill Buttons */}
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

          {/* Order Details Section */}
          {verifiedOrder && (
            <div className="rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-8 dark:border-[#4c3020] dark:bg-[#17100c]">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-[#23160d] dark:text-[#fff3e5]">Order Receipt</h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                      PREPARED
                    </span>
                    <span className="font-mono text-sm text-[#8d7a65] dark:text-[#b99d80]">
                      {verifiedOrder.orderNumber}
                    </span>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-[#eadfce] bg-[#fff8ef] p-4 dark:border-[#4d3122] dark:bg-[#221712] sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">EMP. NAME</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{verifiedOrder.customerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">EMPLOYEE ID</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">FNP-1042</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">DEPARTMENT</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{verifiedOrder.department}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#d36f18]" />
                    <div>
                      <p className="text-xs text-[#8d7a65] dark:text-[#b99d80]">SLOT</p>
                      <p className="text-sm font-semibold dark:text-[#fff3e5]">{(verifiedOrder as any).slot ?? verifiedOrder.slotName ?? "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-sm font-semibold text-[#8d7a65] dark:text-[#b99d80]">ORDER ITEMS</h4>
                  <div className="space-y-2">
                    {verifiedOrder.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between rounded-2xl border border-[#eadfce] bg-white p-3 dark:border-[#4d3122] dark:bg-[#211611]">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-[#fff1dd] px-2 py-1 text-xs font-bold text-[#d36f18]">
                            +{(item as any).qty ?? item.quantity}
                          </span>
                          <span className="font-medium dark:text-[#fff3e5]">{item.name}</span>
                        </div>
                        <span className="font-semibold text-[#d36f18]">
                          {formatINR(((item as any).price ?? item.unitPrice ?? 0) * ((item as any).qty ?? item.quantity ?? 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Amount */}
                <div className="border-t border-border pt-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold dark:text-[#fff3e5]">TOTAL AMOUNT</span>
                    <span className="text-2xl font-bold text-[#d36f18]">
                      {formatINR(verifiedOrder.total)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={collectAndPrint}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#ef7f1a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#dd7418]"
                  >
                    <Printer className="h-5 w-5" />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="rounded-2xl border border-[#e6d6c3] bg-[#fff8ef] px-6 py-3 font-semibold text-[#3a281b] transition-colors hover:bg-[#fff2e2] dark:border-[#4d3223] dark:bg-[#221712] dark:text-[#eedbc8] dark:hover:bg-[#2c1d16]"
                  >
                    <Eye className="h-5 w-5 inline mr-2" />
                    Preview
                  </button>
                  <button
                    onClick={cancelOrder}
                    className="rounded-2xl border border-destructive/20 bg-destructive/10 px-6 py-3 font-semibold text-destructive transition-colors hover:bg-destructive/20"
                  >
                    <X className="h-5 w-5 inline mr-2" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recent Collections Section */}
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
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent collections</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && verifiedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-[28px] border border-[#eadfce] bg-[#fffdf9] p-6 dark:border-[#4c3020] dark:bg-[#17100c]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#23160d] dark:text-[#fff3e5]">Receipt Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-xl p-2 text-[#8d7a65] hover:bg-[#fff2e2] dark:text-[#b99d80] dark:hover:bg-[#2a1c16]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="bg-white p-4 rounded-lg text-black" style={{fontFamily: 'Courier New, monospace'}}>
                <div className="text-center border-b-2 border-dashed border-gray-400 pb-2 mb-4">
                  <div className="text-xl font-bold">CANTEEN RECEIPT</div>
                  <div className="text-xs text-gray-600">Employee Meal Service</div>
                </div>
                
                <div className="mb-4">
                  <div className="inline-block px-2 py-1 bg-green-500 text-white text-xs rounded-full mb-2">PREPARED</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><strong>Order ID:</strong> {verifiedOrder.orderNumber}</div>
                    <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                    <div><strong>Time:</strong> {new Date().toLocaleTimeString()}</div>
                    <div><strong>Customer:</strong> {verifiedOrder.customerName}</div>
                    <div><strong>Department:</strong> {verifiedOrder.department}</div>
                    <div><strong>Time Slot:</strong> {verifiedOrder.slot}</div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="font-bold mb-2 text-sm">ORDER ITEMS</div>
                  {verifiedOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-xs mb-1">
                      <span>{item.name}</span>
                      <span>x{item.qty}</span>
                      <span className="font-semibold">{formatINR(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                
                <div className="border-t-2 border-dashed border-gray-400 pt-2">
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL AMOUNT:</span>
                    <span className="text-amber-600">{formatINR(verifiedOrder.total)}</span>
                  </div>
                </div>
                
                <div className="text-center mt-4 text-xs text-gray-600 border-t-2 border-dashed border-gray-400 pt-2">
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
