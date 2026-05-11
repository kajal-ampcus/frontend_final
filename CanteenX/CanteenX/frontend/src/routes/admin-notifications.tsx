import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, Megaphone, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";

import { NotificationCenter, formatRelativeTime, type NotificationCenterItem } from "@/components/NotificationCenter";
import {
  useEntities,
  type Announcement,
  type Order,
  type Slot,
} from "@/lib/store";
import { AdminLayout } from "./admin-orders";

export const Route = createFileRoute("/admin-notifications")({ component: AdminNotifications });

type NotificationFilter = "all" | "read" | "unread";

function AdminNotifications() {
  const navigate = useNavigate();
  const orders = useEntities<Order>("orders");
  const announcements = useEntities<Announcement>("announcements");
  const slots = useEntities<Slot>("slots");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const notifications = useMemo<NotificationCenterItem[]>(() => {
    const items: Array<NotificationCenterItem & { time: Date }> = [];

    orders
      .filter((order) => ["pending", "accepted", "preparing", "ready"].includes(order.status))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .forEach((order) => {
        const isUrgent = order.status === "ready" || getAgeMinutes(order.createdAt) >= 20;
        items.push({
          id: `order-${order.id}`,
          title: isUrgent ? `Pickup attention for ${order.orderNumber}` : `Live order ${order.orderNumber}`,
          body: `${order.customerName} from ${order.department} is in ${order.slotName}. Status: ${order.status}.`,
          time: new Date(order.updatedAt),
          timeLabel: "",
          read: false,
          icon: isUrgent ? AlertTriangle : ShoppingBag,
          iconClassName: isUrgent ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
          actionLabel: "View orders",
          onAction: () => navigate({ to: "/admin-orders" }),
          dismissLabel: "Dismiss",
          onDismiss: () => dismissNotification(`order-${order.id}`, setDismissedIds),
          meta: (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isUrgent ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
              {isUrgent ? "URGENT" : order.status.toUpperCase()}
            </span>
          ),
        });
      });

    announcements
      .filter((announcement) => announcement.active)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .forEach((announcement) => {
        items.push({
          id: `announcement-${announcement.id}`,
          title: announcement.title,
          body: announcement.message,
          time: new Date(announcement.createdAt),
          timeLabel: "",
          read: announcement.priority === "low",
          icon: Megaphone,
          iconClassName: "bg-fuchsia-500/15 text-fuchsia-600",
          actionLabel: "Open announcements",
          onAction: () => navigate({ to: "/admin-announcements" }),
          dismissLabel: "Dismiss",
          onDismiss: () => dismissNotification(`announcement-${announcement.id}`, setDismissedIds),
          meta: (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {announcement.priority.toUpperCase()}
            </span>
          ),
        });
      });

    slots
      .filter((slot) => slot.capacity > 0 && slot.currentOccupancy / slot.capacity >= 0.8)
      .sort((a, b) => b.currentOccupancy / b.capacity - a.currentOccupancy / a.capacity)
      .slice(0, 3)
      .forEach((slot) => {
        const percentage = Math.round((slot.currentOccupancy / slot.capacity) * 100);
        items.push({
          id: `slot-${slot.id}`,
          title: `${slot.name} capacity warning`,
          body: `${slot.currentOccupancy}/${slot.capacity} occupied. Consider adjusting capacity or menu flow.`,
          time: new Date(slot.updatedAt),
          timeLabel: "",
          read: false,
          icon: Users,
          iconClassName: "bg-amber-500/15 text-amber-600",
          actionLabel: "Open slots",
          onAction: () => navigate({ to: "/admin-slots" }),
          dismissLabel: "Dismiss",
          onDismiss: () => dismissNotification(`slot-${slot.id}`, setDismissedIds),
          meta: (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              {percentage}% FULL
            </span>
          ),
        });
      });

    return items
      .filter((item) => !dismissedIds.has(item.id))
      .map((item) => ({
        ...item,
        timeLabel: formatRelativeTime(item.time),
        read: item.read || readIds.has(item.id),
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [announcements, dismissedIds, navigate, orders, readIds, slots]);

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "read") return notification.read;
    if (filter === "unread") return !notification.read;
    return true;
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const filters = [
    { value: "all" as const, label: "All", count: notifications.length },
    { value: "read" as const, label: "Read", count: notifications.filter((notification) => notification.read).length },
    { value: "unread" as const, label: "Unread", count: notifications.filter((notification) => !notification.read).length },
  ];

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((notification) => notification.id)));
    toast.success("All notifications marked as read");
  };

  const clearAll = () => {
    setDismissedIds(new Set(notifications.map((notification) => notification.id)));
    toast.success("All notifications removed");
  };

  return (
    <AdminLayout crumb="Notifications">
      <NotificationCenter
        title="Notifications"
        description="System alerts and operational updates."
        unreadCount={unreadCount}
        filter={filter}
        filters={filters}
        items={filteredNotifications}
        onFilterChange={setFilter}
        onMarkAllRead={markAllAsRead}
        onClearAll={clearAll}
        clearAllLabel="Remove all"
      />
    </AdminLayout>
  );
}

function dismissNotification(id: string, setDismissedIds: Dispatch<SetStateAction<Set<string>>>) {
  setDismissedIds((prev) => new Set(prev).add(id));
  toast.success("Notification removed");
}

function getAgeMinutes(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}
