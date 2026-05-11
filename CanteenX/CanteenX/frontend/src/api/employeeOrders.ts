import api from "@/api/client";
import type { MenuItem, Order, Slot } from "@/lib/store/index";

type EmployeeMenuResponse = {
  canteen: {
    id: string;
    name: string;
  };
  slots: Slot[];
  items: MenuItem[];
};

type OrderListResponse = {
  results: Order[];
};

export async function fetchEmployeeMenu() {
  const response = await api.get<EmployeeMenuResponse>("/cms/employee/menu/");
  return response.data;
}

export async function fetchEmployeeOrders() {
  const response = await api.get<OrderListResponse>("/cms/employee/orders/");
  return response.data.results;
}

export async function checkoutEmployeeOrder(input: {
  slotId: string;
  items: Array<{ menuItemId: string; quantity: number }>;
}) {
  const response = await api.post<Order>("/cms/employee/orders/", {
    slot_id: input.slotId,
    items: input.items.map((item) => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
    })),
  });
  return response.data;
}

export async function cancelEmployeeOrder(orderId: string, reason: string) {
  const response = await api.post<Order>(`/cms/employee/orders/${orderId}/cancel/`, { reason });
  return response.data;
}
