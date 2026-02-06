/** Shared API/UI types — single place for Order, Driver, Passenger, etc. */

export interface Order {
  id: string;
  status: string;
  tripType?: string;
  routeType?: string | null;  // LOCAL | LONG
  pickupAt: string;
  pickupAddress: string;
  middleAddress?: string | null;
  /** Multiple stops between pickup and dropoff. When present, use this instead of middleAddress for display. */
  waypoints?: { address: string }[] | null;
  dropoffAddress: string;
  driverId?: string | null;
  passengerId?: string | null;
  passenger?: { id: string; phone: string; name: string | null } | null;
  preferredCarType?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  arrivedAtPickupAt?: string | null;
  leftPickupAt?: string | null;
  waitChargeAtPickupCents?: number | null;
  arrivedAtMiddleAt?: string | null;
  leftMiddleAt?: string | null;
  waitChargeAtMiddleCents?: number | null;
  completedAt?: string | null;
  /** Planning: LOW | MEDIUM | HIGH — auto-detected risk */
  riskLevel?: string | null;
  /** Planning: suggested driver id (not auto-assigned) */
  suggestedDriverId?: string | null;
  /** Dispatcher marked: no auto-suggest */
  manualAssignment?: boolean;
}

export interface Driver {
  id: string;
  nickname: string;
  role: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  blocked?: boolean;
  bannedUntil?: string | null;
}

export interface PassengerRow {
  id: string;
  phone?: string;
  name: string | null;
  pickupAddr: string | null;
  dropoffAddr: string | null;
  pickupType: string | null;
  dropoffType: string | null;
  userId?: string | null;
  createdAt?: string;
}

export interface DriverEta {
  id: string;
  nickname: string;
  phone?: string | null;
  etaMinutesToPickup: number;
  etaMinutesPickupToDropoff: number;
  etaMinutesTotal: number;
}

export type OrderStatus = 'DRAFT' | 'SCHEDULED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Planning result from GET /planning and planning.update WebSocket */
export interface RiskyOrderPlanning {
  orderId: string;
  pickupAt: string;
  reason: 'NO_DRIVER' | 'LATE_FINISH' | 'FAR_DRIVER';
  suggestedDrivers: string[];
}

export interface OrderPlanningRow {
  orderId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedDriverId: string | null;
}

export interface PlanningResult {
  windowStart: string;
  windowEnd: string;
  ordersCount: number;
  driversAvailable: number;
  shortage: boolean;
  riskyOrders: RiskyOrderPlanning[];
  /** Per-order risk and suggested driver (used for auto-assign). */
  orderRows?: OrderPlanningRow[];
}
