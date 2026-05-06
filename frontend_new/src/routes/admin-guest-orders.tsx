import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "./admin-orders";
import {
  DataTableToolbar,
  formatShortDateInput,
  parseShortDateInput,
} from "@/components/DataTableToolbar";
import { Pagination } from "@/components/Pagination";
import { TablePanel } from "@/components/TablePanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore, formatINR, downloadCSV, type MenuItem, type ItemCategory, ALL_DAYS, type Day } from "@/lib/store";
import { 
  User, 
  Phone, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UtensilsCrossed,
  IndianRupee,
  Search,
  Filter,
  Calendar,
  Tag,
  Coffee,
  Sun,
  Moon,
  ChefHat,
  Download,
  Star,
  Edit3
} from "lucide-react";

export const Route = createFileRoute("/admin-guest-orders")({ component: GuestOrders });

interface GuestOrder {
  id: string;
  guestName: string;
  phone: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  createdAt: string;
  estimatedTime?: string;
  specialInstructions?: string;
}

const GUEST_ORDERS_PAGE_SIZE = 8;

function GuestOrders() {
  const menu = useStore((s) => s.menuItems ?? []);
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "preparing" | "ready" | "completed">("all");
  const [dateRange, setDateRange] = useState<"today" | "7d" | "all" | "custom">("today");
  const [customFrom, setCustomFrom] = useState(formatShortDateInput(new Date()));
  const [customTo, setCustomTo] = useState(formatShortDateInput(new Date()));
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | "all">("all");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [currentDay, setCurrentDay] = useState<Day>("Mon");

  // Mock data - replace with real data
  useEffect(() => {
    const mockOrders: GuestOrder[] = [
      {
        id: "GUEST-001",
        guestName: "John Doe",
        phone: "+91 98765 43210",
        items: [
          { name: "Butter Chicken", qty: 2, price: 120 },
          { name: "Veg Biryani", qty: 1, price: 180 }
        ],
        total: 420,
        status: "preparing",
        createdAt: new Date().toISOString(),
        estimatedTime: "12:30 PM",
        specialInstructions: "Extra spicy please"
      },
      {
        id: "GUEST-002",
        guestName: "Jane Smith",
        phone: "+91 87654 32109",
        items: [
          { name: "Paneer Tikka", qty: 1, price: 150 }
        ],
        total: 150,
        status: "ready",
        createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
        estimatedTime: "12:15 PM"
      }
    ];
    setGuestOrders(mockOrders);
    
    // Set current day
    const days: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    setCurrentDay(days[new Date().getDay()] as Day);
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return [...guestOrders]
      .filter((order) => {
        const createdAt = new Date(order.createdAt).getTime();

        if (dateRange === "today") {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (createdAt < startOfDay.getTime()) return false;
        }

        if (dateRange === "7d" && Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (dateRange === "custom") {
          const from = parseShortDateInput(customFrom);
          const to = parseShortDateInput(customTo);
          if (from && createdAt < from.setHours(0, 0, 0, 0)) return false;
          if (to && createdAt > to.setHours(23, 59, 59, 999)) return false;
        }

        const matchesSearch =
          !normalizedQuery ||
          order.id.toLowerCase().includes(normalizedQuery) ||
          order.guestName.toLowerCase().includes(normalizedQuery) ||
          order.phone.toLowerCase().includes(normalizedQuery);
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [customFrom, customTo, dateRange, guestOrders, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / GUEST_ORDERS_PAGE_SIZE));
  const pagedOrders = filteredOrders.slice(
    (currentPage - 1) * GUEST_ORDERS_PAGE_SIZE,
    currentPage * GUEST_ORDERS_PAGE_SIZE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [customFrom, customTo, dateRange, searchQuery, statusFilter]);

  // Dynamic menu filtering for guest order form
  const availableSlots = useMemo(() => {
    const slots = [...new Set(menu.filter(item => item.live).map(item => item.slot))];
    return slots.sort();
  }, [menu]);

  const filteredMenuItems = useMemo(() => {
    let filtered = menu.filter(item => item.live);
    
    // Filter by slot
    if (selectedSlot !== "all") {
      filtered = filtered.filter(item => item.slot === selectedSlot);
    }
    
    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    // Filter by search query
    if (menuSearchQuery.trim()) {
      const query = menuSearchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.description.toLowerCase().includes(query) ||
        item.tag?.toLowerCase().includes(query)
      );
    }
    
    // Filter by current day availability
    filtered = filtered.filter(item => item.days.includes(currentDay));
    
    return filtered;
  }, [menu, selectedSlot, selectedCategory, menuSearchQuery, currentDay]);

  // Group menu items by slot for better organization
  const menuBySlot = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    filteredMenuItems.forEach(item => {
      if (!grouped[item.slot]) {
        grouped[item.slot] = [];
      }
      grouped[item.slot].push(item);
    });
    return grouped;
  }, [filteredMenuItems]);

  const [formData, setFormData] = useState({
    guestName: "",
    items: [] as Array<{ id: string; name: string; price: number; qty: number; isCustom?: boolean }>,
    specialInstructions: "",
    estimatedTime: ""
  });

  const [orderMode, setOrderMode] = useState<"menu" | "custom">("menu");
  const [customItem, setCustomItem] = useState({
    name: "",
    price: "",
    qty: 1
  });

  const addToGuestCart = (menuItem: MenuItem, isCustom: boolean = false) => {
    const itemId = isCustom ? `custom-${Date.now()}` : menuItem.id;
    const existingItem = formData.items.find(item => item.id === itemId);
    
    if (existingItem) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId 
            ? { ...item, qty: item.qty + 1 }
            : item
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { 
          id: itemId, 
          name: isCustom ? customItem.name : menuItem.name, 
          price: isCustom ? parseFloat(customItem.price) : menuItem.price, 
          qty: isCustom ? customItem.qty : 1,
          isCustom
        }]
      }));
    }
    
    // Reset custom item form if added
    if (isCustom) {
      setCustomItem({ name: "", price: "", qty: 1 });
    }
  };

  const removeFromGuestCart = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const updateGuestQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromGuestCart(itemId);
    } else {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item => 
          item.id === itemId ? { ...item, qty } : item
        )
      }));
    }
  };

  const getTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  };

  const createGuestOrder = () => {
    if (!formData.guestName || formData.items.length === 0) {
      alert("Please fill in guest name and add items to order");
      return;
    }

    const newOrder: GuestOrder = {
      id: `GUEST-${Date.now()}`,
      guestName: formData.guestName,
      phone: "N/A",
      items: formData.items.map(item => ({
        name: item.name,
        qty: item.qty,
        price: item.price
      })),
      total: getTotal(),
      status: "pending",
      createdAt: new Date().toISOString(),
      estimatedTime: formData.estimatedTime,
      specialInstructions: formData.specialInstructions
    };

    setGuestOrders(prev => [newOrder, ...prev]);
    setFormData({
      guestName: "",
      items: [],
      specialInstructions: "",
      estimatedTime: ""
    });
    setShowCreateForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-warning/15 text-warning";
      case "preparing": return "bg-primary/15 text-primary";
      case "ready": return "bg-success/15 text-success";
      case "completed": return "bg-emerald-15 text-emerald-600";
      case "cancelled": return "bg-destructive/15 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const exportGuestOrdersCSV = () => {
    if (guestOrders.length === 0) {
      alert("No guest orders to export");
      return;
    }

    // Prepare CSV data
    const csvHeaders = [
      "Order ID",
      "Guest Name",
      "Phone",
      "Order Date",
      "Estimated Time",
      "Status",
      "Items Count",
      "Total Amount",
      "Special Instructions"
    ];

    const csvData: string[][] = guestOrders.map(order => {
      const itemsList = order.items.map(item => `${item.name}(${item.qty})`).join('; ');
      return [
        order.id,
        order.guestName,
        order.phone || "N/A",
        new Date(order.createdAt).toLocaleDateString(),
        order.estimatedTime || "Not specified",
        order.status.toUpperCase(),
        order.items.length.toString(),
        formatINR(order.total),
        order.specialInstructions || "None"
      ];
    });

    // Create summary rows
    const summaryData = [
      [],
      ["SUMMARY REPORT"],
      ["Total Orders", guestOrders.length],
      ["Total Revenue", formatINR(guestOrders.reduce((sum, order) => sum + order.total, 0))],
      ["Average Order Value", formatINR(Math.round(guestOrders.reduce((sum, order) => sum + order.total, 0) / guestOrders.length))],
      ["Export Date", new Date().toLocaleString()],
      []
    ];

    const allRows = [csvHeaders, ...csvData, ...summaryData];
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `guest-orders-report-${timestamp}.csv`;
    
    // Download CSV
    downloadCSV(filename, allRows);
  };

  const exportDetailedGuestOrdersCSV = () => {
    if (guestOrders.length === 0) {
      alert("No guest orders to export");
      return;
    }

    // Detailed CSV with individual items
    const csvHeaders = [
      "Order ID",
      "Guest Name",
      "Phone",
      "Order Date",
      "Estimated Time",
      "Status",
      "Item Name",
      "Quantity",
      "Item Price",
      "Item Total",
      "Special Instructions"
    ];

    const csvData: string[][] = [];
    
    guestOrders.forEach(order => {
      if (order.items.length === 0) {
        // Add row for orders with no items
        csvData.push([
          order.id,
          order.guestName,
          order.phone || "N/A",
          new Date(order.createdAt).toLocaleDateString(),
          order.estimatedTime || "Not specified",
          order.status.toUpperCase(),
          "No items",
          "0",
          "0",
          "0",
          order.specialInstructions || "None"
        ]);
      } else {
        order.items.forEach((item, index) => {
          csvData.push([
            order.id,
            order.guestName,
            order.phone || "N/A",
            new Date(order.createdAt).toLocaleDateString(),
            order.estimatedTime || "Not specified",
            order.status.toUpperCase(),
            item.name,
            item.qty.toString(),
            formatINR(item.price),
            formatINR(item.price * item.qty),
            index === 0 ? (order.specialInstructions || "None") : "" // Show instructions only on first item
          ]);
        });
      }
    });

    // Add summary
    const summaryData = [
      [],
      ["DETAILED SUMMARY REPORT"],
      ["Total Orders", guestOrders.length],
      ["Total Items Sold", guestOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0)],
      ["Total Revenue", formatINR(guestOrders.reduce((sum, order) => sum + order.total, 0))],
      ["Export Date", new Date().toLocaleString()],
      []
    ];

    const allRows = [csvHeaders, ...csvData, ...summaryData];
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `guest-orders-detailed-${timestamp}.csv`;
    
    downloadCSV(filename, allRows);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return Clock;
      case "preparing": return UtensilsCrossed;
      case "ready": return CheckCircle;
      case "completed": return CheckCircle;
      case "cancelled": return XCircle;
      default: return Clock;
    }
  };

  // Helper functions for dynamic menu display
  const getSlotIcon = (slot: string) => {
    switch (slot.toLowerCase()) {
      case "breakfast": return <Coffee className="h-3 w-3" />;
      case "lunch": return <Sun className="h-3 w-3" />;
      case "dinner": return <Moon className="h-3 w-3" />;
      case "snacks": return <UtensilsCrossed className="h-3 w-3" />;
      default: return <ChefHat className="h-3 w-3" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Veg": return <span className="w-2 h-2 rounded-full bg-green-500" />;
      case "Non-Veg": return <span className="w-2 h-2 rounded-full bg-red-500" />;
      case "Beverages": return <span className="w-2 h-2 rounded-full bg-blue-500" />;
      default: return <span className="w-2 h-2 rounded-full bg-gray-500" />;
    }
  };

  const formatGuestDate = (value: string) =>
    new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  return (
    <AdminLayout crumb="Guest Orders">
      <div className="space-y-6 p-6 md:p-8">
        {/* Header with Create and Export Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Guest Orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage orders from external customers and walk-in guests
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportGuestOrdersCSV}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-lg transition-all hover:shadow-xl hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-300 to-amber-300/95 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition-all hover:shadow-orange-500/40"
            >
              <Plus className="h-4 w-4" />
              Create Guest Order
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-orange-300 to-amber-300/95 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-white/90">Total Guests</div>
              <User className="h-5 w-5 text-white/80" />
            </div>
            <div className="mt-3 text-3xl font-black text-white drop-shadow-lg">{guestOrders.length}</div>
          </div>
          
          <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-300 to-green-300/95 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-white/90">Active Orders</div>
              <Clock className="h-5 w-5 text-white/80" />
            </div>
            <div className="mt-3 text-3xl font-black text-white">
              {guestOrders.filter(o => o.status !== "completed" && o.status !== "cancelled").length}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-br from-blue-300 to-indigo-300/95 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-white/90">Today's Revenue</div>
              <IndianRupee className="h-5 w-5 text-white/80" />
            </div>
            <div className="mt-3 text-3xl font-black text-white">
              {formatINR(guestOrders.reduce((sum, o) => sum + o.total, 0))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-br from-purple-300 to-pink-300/95 p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-white/90">Avg Order</div>
              <UtensilsCrossed className="h-5 w-5 text-white/80" />
            </div>
            <div className="mt-3 text-3xl font-black text-white">
              {formatINR(guestOrders.length > 0 ? Math.round(guestOrders.reduce((sum, o) => sum + o.total, 0) / guestOrders.length) : 0)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <DataTableToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by order id, guest name, or phone..."
            options={[
              { value: "today", label: "Today" },
              { value: "7d", label: "Last 7 Days" },
              { value: "all", label: "All" },
              { value: "custom", label: "Custom" },
            ]}
            activeOption={dateRange}
            onOptionChange={(value) => setDateRange(value as "today" | "7d" | "all" | "custom")}
            fromValue={customFrom}
            toValue={customTo}
            onFromChange={setCustomFrom}
            onToChange={setCustomTo}
            extraFilters={
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | "pending" | "preparing" | "ready" | "completed")
                }
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                {["all", "pending", "preparing", "ready", "completed"].map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            }
          />
        </div>

        {/* Guest Orders List */}
        <TablePanel title="Guest Orders" description={`${filteredOrders.length} guest orders found`}>

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">No guest orders found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Try adjusting your search" : "Start by creating a new guest order"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Ordered On</TableHead>
                    <TableHead>Pickup Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedOrders.map((order) => {
                    const StatusIcon = getStatusIcon(order.status);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-primary">{order.id}</TableCell>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getStatusColor(order.status)}`}
                            >
                              <StatusIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-semibold">{order.guestName}</div>
                              <div className="text-xs text-muted-foreground">{order.phone}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[340px] text-sm text-muted-foreground">
                          <div>{order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</div>
                          {order.specialInstructions ? (
                            <div className="mt-2 text-xs text-muted-foreground">Note: {order.specialInstructions}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatGuestDate(order.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {order.estimatedTime || "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${getStatusColor(order.status)}`}
                          >
                            {order.status.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatINR(order.total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredOrders.length}
                pageSize={GUEST_ORDERS_PAGE_SIZE}
              />
            </>
          )}
        </TablePanel>

        {/* Create Guest Order Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Guest Order</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Guest Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Guest Information</h3>
                  
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Guest Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={formData.guestName}
                        onChange={(e) => setFormData(prev => ({ ...prev, guestName: e.target.value }))}
                        placeholder="Enter guest name"
                        className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Estimated Pickup Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={formData.estimatedTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                        placeholder="e.g., 12:30 PM"
                        className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Special Instructions</label>
                    <textarea
                      value={formData.specialInstructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                      placeholder="Any special requests or dietary requirements..."
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background p-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </div>

                {/* Menu Selection */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Select Items</h3>
                  
                  {/* Order Mode Toggle */}
                  <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                    <button
                      onClick={() => setOrderMode("menu")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        orderMode === "menu" 
                          ? "bg-primary text-white shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <UtensilsCrossed className="h-4 w-4" />
                      Menu Items
                    </button>
                    <button
                      onClick={() => setOrderMode("custom")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                        orderMode === "custom" 
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Star className="h-4 w-4" />
                      Custom Order
                    </button>
                  </div>
                  
                  {orderMode === "menu" ? (
                    /* Menu Items Mode */
                    <div className="space-y-3">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={menuSearchQuery}
                          onChange={(e) => setMenuSearchQuery(e.target.value)}
                          placeholder="Search menu items..."
                          className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      
                      {/* Slot and Category Filters */}
                      <div className="flex flex-wrap gap-2">
                        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 text-xs">
                          <button
                            onClick={() => setSelectedSlot("all")}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                              selectedSlot === "all" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            All Slots
                          </button>
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              onClick={() => setSelectedSlot(slot)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                                selectedSlot === slot ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {getSlotIcon(slot)} {slot}
                            </button>
                          ))}
                        </div>
                        
                        <div className="flex gap-1 rounded-xl border border-border bg-card p-1 text-xs">
                          <button
                            onClick={() => setSelectedCategory("all")}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                              selectedCategory === "all" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            All Categories
                          </button>
                          {(["Veg", "Non-Veg", "Beverages"] as const).map((category) => (
                            <button
                              key={category}
                              onClick={() => setSelectedCategory(category)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                                selectedCategory === category ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {getCategoryColor(category)} {category}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Current Day Indicator */}
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        <Calendar className="h-3 w-3" />
                        <span className="font-medium">Showing items available on {currentDay}</span>
                      </div>
                      
                      {/* Menu Items by Slot */}
                      <div className="max-h-96 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4">
                        {Object.keys(menuBySlot).length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                              <Search className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h4 className="mt-3 font-medium">No items found</h4>
                            <p className="mt-1 text-xs text-muted-foreground text-center">
                              Try adjusting your filters or search query
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {Object.entries(menuBySlot).map(([slot, items]) => (
                              <div key={slot}>
                                <div className="flex items-center gap-2 mb-3">
                                  {getSlotIcon(slot)}
                                  <h4 className="font-semibold text-sm">{slot}</h4>
                                  <span className="text-xs text-muted-foreground">({items.length} items)</span>
                                </div>
                                <div className="space-y-2">
                                  {items.map((menuItem) => {
                                    const cartItem = formData.items.find(item => item.id === menuItem.id);
                                    const qty = cartItem?.qty || 0;
                                    const isInCart = qty > 0;
                                    
                                    return (
                                      <div 
                                        key={menuItem.id} 
                                        className={`flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                                          isInCart 
                                            ? 'border-primary/30 bg-primary/5 shadow-sm' 
                                            : 'border-border bg-card hover:shadow-sm hover:border-primary/20'
                                        }`}
                                        onClick={() => !isInCart && addToGuestCart(menuItem)}
                                      >
                                        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium text-sm truncate">{menuItem.name}</h4>
                                            {menuItem.tag && (
                                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                                {menuItem.tag}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{menuItem.description}</p>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <p className="text-sm font-bold text-primary">{formatINR(menuItem.price)}</p>
                                              <div className="flex items-center gap-1">
                                                {getCategoryColor(menuItem.category)}
                                                <span className="text-[10px] text-muted-foreground">{menuItem.category}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                          {!isInCart ? (
                                            <button
                                              onClick={() => addToGuestCart(menuItem)}
                                              className="flex h-8 px-4 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-medium"
                                            >
                                              Add
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => updateGuestQty(menuItem.id, qty - 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                                              >
                                                -
                                              </button>
                                              <span className="w-7 text-center font-medium text-sm">{qty}</span>
                                              <button
                                                onClick={() => updateGuestQty(menuItem.id, qty + 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                                              >
                                                +
                                              </button>
                                              {qty > 0 && (
                                                <div className="ml-2 text-xs font-medium text-primary min-w-[60px] text-right">
                                                  {formatINR(menuItem.price * qty)}
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Custom Order Mode */
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="h-5 w-5 text-amber-600" />
                          <h4 className="font-semibold text-amber-900">Custom Order for Special Guests</h4>
                        </div>
                                                
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-amber-900">Item Name *</label>
                            <div className="relative">
                              <Edit3 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                              <input
                                type="text"
                                value={customItem.name}
                                onChange={(e) => setCustomItem(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., Special Pasta, Custom Cake"
                                className="w-full rounded-xl border border-amber-200 bg-amber-50/50 py-3 pl-10 pr-4 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-amber-900">Price (₹) *</label>
                              <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                                <input
                                  type="number"
                                  value={customItem.price}
                                  onChange={(e) => setCustomItem(prev => ({ ...prev, price: e.target.value }))}
                                  placeholder="0"
                                  min="0"
                                  step="1"
                                  className="w-full rounded-xl border border-amber-200 bg-amber-50/50 py-3 pl-10 pr-4 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-amber-900">Quantity *</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={customItem.qty}
                                  onChange={(e) => setCustomItem(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                                  min="1"
                                  className="w-full rounded-xl border border-amber-200 bg-amber-50/50 py-3 px-4 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              if (customItem.name && customItem.price && customItem.qty > 0) {
                                addToGuestCart(null as any, true);
                              } else {
                                alert("Please fill in all custom item details");
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition-all hover:shadow-amber-500/40"
                          >
                            <Plus className="h-4 w-4" />
                            Add Custom Item
                          </button>
                        </div>
                      </div>
                      
                      {/* Custom Items Added */}
                      {formData.items.filter(item => item.isCustom).length > 0 && (
                        <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 p-4">
                          <h5 className="font-medium text-amber-900 mb-3">Custom Items Added</h5>
                          <div className="space-y-2">
                            {formData.items.filter(item => item.isCustom).map((item) => (
                              <div key={item.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.name}</p>
                                  <p className="text-xs text-amber-600">Custom item</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateGuestQty(item.id, item.qty - 1)}
                                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors text-sm"
                                  >
                                    -
                                  </button>
                                  <span className="w-6 text-center font-medium text-sm">{item.qty}</span>
                                  <button
                                    onClick={() => updateGuestQty(item.id, item.qty + 1)}
                                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm"
                                  >
                                    +
                                  </button>
                                  <div className="ml-2 text-sm font-medium text-amber-700 min-w-[50px] text-right">
                                    {formatINR(item.price * item.qty)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <h4 className="font-semibold">Order Summary</h4>
                    <div className="mt-3 space-y-2">
                      {formData.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span>{item.name} x{item.qty}</span>
                            {item.isCustom && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Custom</span>
                            )}
                          </div>
                          <span>{formatINR(item.price * item.qty)}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2">
                        <div className="flex justify-between font-bold">
                          <span>Total</span>
                          <span className="text-lg">{formatINR(getTotal())}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-xl border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={createGuestOrder}
                  className="rounded-xl bg-gradient-to-r from-primary to-orange-500 px-6 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:shadow-primary/40"
                >
                  Create Guest Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


// tetstinhhhhfasdhfgshagfhsdvhgv
