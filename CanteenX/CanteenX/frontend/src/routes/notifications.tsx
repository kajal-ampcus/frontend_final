import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Gift,
  Info,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { NotificationCenter, formatRelativeTime, type NotificationCenterItem } from "@/components/NotificationCenter";
import {
  formatINR,
  useCurrentCustomer,
  useEntities,
  type Announcement,
  type Order,
  type WalletTransaction,
} from "@/lib/store/index";

export const Route = createFileRoute("/notifications")({ component: Notifications });

type NotificationFilter = "all" | "read" | "unread";
type NotificationKind = "order" | "wallet" | "system" | "promo";

type NotificationItem = {
  id: string;
  type: NotificationKind;
  title: string;
  body: string;
  time: Date;
  read: boolean;
  actionable?: boolean;
  actionText?: string;
  actionRoute?: string;
};

function Notifications() {
  const navigate = useNavigate();
  const currentCustomer = useCurrentCustomer();
  const orders = useEntities<Order>("orders");
  const announcements = useEntities<Announcement>("announcements");
  const walletTransactions = useEntities<WalletTransaction>("walletTransactions");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [mounted, setMounted] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = useMemo<NotificationItem[]>(() => {
    if (!currentCustomer) return [];

    const customerOrders = orders
      .filter((order) => order.customerId === currentCustomer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const customerTransactions = walletTransactions
      .filter((transaction) => transaction.customerId === currentCustomer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const items: NotificationItem[] = [];

    const activeOrder = customerOrders.find((order) =>
      ["pending", "accepted", "preparing", "ready"].includes(order.status)
    );

    if (activeOrder) {
      items.push({
        id: `order-${activeOrder.id}`,
        type: "order",
        title: activeOrder.status === "ready" ? "Order ready for pickup" : `Order ${activeOrder.status}`,
        body:
          activeOrder.status === "ready"
            ? `Your order ${activeOrder.orderNumber} is ready for pickup from ${activeOrder.slotName}.`
            : `Your order ${activeOrder.orderNumber} is currently ${activeOrder.status}.`,
        time: new Date(activeOrder.createdAt),
        read: false,
        actionable: true,
        actionText: "View Order",
        actionRoute: "/orders",
      });
    }

    customerOrders
      .filter((order) => ["completed", "delivered", "collected"].includes(order.status))
      .slice(0, 2)
      .forEach((order) => {
        items.push({
          id: `complete-${order.id}`,
          type: "order",
          title: "Order completed",
          body: `${order.orderNumber} was completed successfully. Total paid: ${formatINR(order.total)}.`,
          time: new Date(order.updatedAt),
          read: true,
        });
      });

    if ((currentCustomer.walletBalance ?? 0) < 500) {
      items.push({
        id: "wallet-low",
        type: "wallet",
        title: "Low wallet balance",
        body: `Your balance is ${formatINR(currentCustomer.walletBalance)}. Add funds before your next order.`,
        time: new Date(),
        read: false,
        actionable: true,
        actionText: "Open Wallet",
        actionRoute: "/wallet",
      });
    }

    customerTransactions.slice(0, 2).forEach((transaction) => {
      items.push({
        id: `wallet-${transaction.id}`,
        type: "wallet",
        title: transaction.type === "credit" ? "Wallet credited" : "Wallet debited",
        body: `${formatINR(transaction.amount)} ${transaction.type === "credit" ? "added to" : "deducted from"} your wallet.`,
        time: new Date(transaction.createdAt),
        read: true,
      });
    });

    announcements
      .filter((announcement) => announcement.active)
      .slice(0, 2)
      .forEach((announcement) => {
        items.push({
          id: `announcement-${announcement.id}`,
          type: "system",
          title: announcement.title,
          body: announcement.message,
          time: new Date(announcement.createdAt),
          read: false,
          actionable: true,
          actionText: "Browse Menu",
          actionRoute: "/menu",
        });
      });

    items.push({
      id: "promo-weekend",
      type: "promo",
      title: "Weekend special offer",
      body: "Check this week's featured dishes and combo meals in the menu.",
      time: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: true,
      actionable: true,
      actionText: "Open Menu",
      actionRoute: "/menu",
    });

    return items
      .filter((item) => !dismissedIds.has(item.id))
      .map((item) => ({ ...item, read: item.read || readIds.has(item.id) }))
      .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [announcements, currentCustomer, dismissedIds, orders, readIds, walletTransactions]);

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "read") return notification.read;
    if (filter === "unread") return !notification.read;
    return true;
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((notification) => notification.id)));
    toast.success("All notifications marked as read");
  };

  const clearAll = () => {
    setDismissedIds(new Set(notifications.map((notification) => notification.id)));
    toast.success("All notifications cleared");
  };

  const dismissNotification = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    toast.success("Notification removed");
  };

  const filters = [
    { value: "all" as const, label: "All", count: notifications.length },
    { value: "read" as const, label: "Read", count: notifications.filter((notification) => notification.read).length },
    { value: "unread" as const, label: "Unread", count: notifications.filter((notification) => !notification.read).length },
  ];

  const notificationItems: NotificationCenterItem[] = filteredNotifications.map((notification) => {
    const Icon = getIcon(notification.type);

    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      timeLabel: formatRelativeTime(notification.time),
      read: notification.read,
      icon: Icon,
      iconClassName: getIconColor(notification.type),
      actionLabel: notification.actionable ? notification.actionText : undefined,
      onAction:
        notification.actionable && notification.actionRoute
          ? () => navigate({ to: notification.actionRoute })
          : undefined,
      dismissLabel: notification.actionable ? "Dismiss" : undefined,
      onDismiss: () => dismissNotification(notification.id),
    };
  });

  return (
    <AppLayout title="Notifications">
      <div className={`space-y-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
        <NotificationCenter
          title="Notifications"
          description="Stay updated on orders, wallet changes, and announcements."
          unreadCount={unreadCount}
          filter={filter}
          filters={filters}
          items={notificationItems}
          onFilterChange={setFilter}
          onMarkAllRead={markAllAsRead}
          onClearAll={clearAll}
        />
      </div>
    </AppLayout>
  );
}

function getIcon(type: NotificationKind) {
  switch (type) {
    case "order":
      return UtensilsCrossed;
    case "wallet":
      return Wallet;
    case "system":
      return Info;
    case "promo":
      return Gift;
    default:
      return Bell;
  }
}

function getIconColor(type: NotificationKind) {
  switch (type) {
    case "order":
      return "bg-primary/15 text-primary";
    case "wallet":
      return "bg-emerald-500/15 text-emerald-600";
    case "system":
      return "bg-sky-500/15 text-sky-600";
    case "promo":
      return "bg-amber-500/15 text-amber-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}
