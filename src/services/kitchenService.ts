import api from "./api";

export type KitchenOrderDto = {
  transactionId: number;
  orderNumber: string;
  orderTime: string;
  foodStatusId: number;
  foodStatusName: string;
  totalAmount?: number;
  comment?: string | null;
  items: KitchenOrderItemDto[];
  customerName?: string | null;
  tableName?: string | null;
  roomId?: number | null;
  roomName?: string | null;
  setId?: number | null;
  setName?: string | null;
  orderedBy?: string | null;
};

export type KitchenOrderItemDto = {
  itemId: number;
  itemName: string;
  quantity: number;
  price?: number | null;
  categoryName?: string | null;
  specialInstructions?: string | null;
};

export type KitchenStatsDto = {
  pendingOrders: number;
  inProgressOrders: number;
  readyOrders: number;
  servedToday: number;
  averagePreparationTime?: number | null;
};

export type UpdateFoodStatusDto = {
  transactionId: number;
  newFoodStatusId: number;
};

/**
 * Get all kitchen orders
 * @param foodStatusId Optional filter by food status (7=Pending, 8=InProgress, 9=Ready, 10=Served)
 */
export async function getKitchenOrders(
  foodStatusId?: number
): Promise<KitchenOrderDto[]> {
  const params: Record<string, unknown> = {};
  if (foodStatusId !== undefined) {
    params.foodStatusId = foodStatusId;
  }
  const res = await api.get<KitchenOrderDto[]>("/Kitchen/orders", { params });
  return res.data;
}

/**
 * Get a specific kitchen order by ID
 */
export async function getKitchenOrderById(
  transactionId: number
): Promise<KitchenOrderDto> {
  const res = await api.get<KitchenOrderDto>(
    `/Kitchen/orders/${transactionId}`
  );
  return res.data;
}

/**
 * Chef: Start preparing order (Pending -> InProgress)
 */
export async function startPreparingOrder(
  transactionId: number
): Promise<{ message: string; transactionId: number }> {
  const res = await api.post<{ message: string; transactionId: number }>(
    `/Kitchen/orders/${transactionId}/start`
  );
  return res.data;
}

/**
 * Chef: Mark order as ready for pickup (InProgress -> Ready)
 */
export async function markOrderReady(
  transactionId: number
): Promise<{ message: string; transactionId: number }> {
  const res = await api.post<{ message: string; transactionId: number }>(
    `/Kitchen/orders/${transactionId}/ready`
  );
  return res.data;
}

/**
 * Waiter: Mark order as served to customer (Ready -> Served)
 */
export async function markOrderServed(
  transactionId: number
): Promise<{ message: string; transactionId: number }> {
  const res = await api.post<{ message: string; transactionId: number }>(
    `/Kitchen/orders/${transactionId}/served`
  );
  return res.data;
}

/**
 * Update food status manually (admin only)
 */
export async function updateFoodStatus(dto: UpdateFoodStatusDto): Promise<{
  message: string;
  transactionId: number;
  newFoodStatusId: number;
}> {
  const res = await api.put<{
    message: string;
    transactionId: number;
    newFoodStatusId: number;
  }>("/Kitchen/orders/status", dto);
  return res.data;
}

/**
 * Get kitchen statistics for dashboard
 */
export async function getKitchenStats(): Promise<KitchenStatsDto> {
  const res = await api.get<KitchenStatsDto>("/Kitchen/stats");
  return res.data;
}

export default {
  getKitchenOrders,
  getKitchenOrderById,
  startPreparingOrder,
  markOrderReady,
  markOrderServed,
  updateFoodStatus,
  getKitchenStats,
};
