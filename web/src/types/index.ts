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
  distanceKm?: number | null;
  durationMinutes?: number | null;
  driverFeeCents?: number | null;
  totalAmountCents?: number | null;
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

export interface RouteStep {
  type: number;
  instruction: string;
  distanceM: number;
  durationS: number;
}

export interface OrderRouteData {
  pickupCoords: { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
  polyline: string;
  durationMinutes?: number;
  distanceKm?: number;
  steps?: RouteStep[];
  /** Driver → pickup leg (when driver view) */
  driverToPickupPolyline?: string;
  driverToPickupMinutes?: number;
  driverToPickupSteps?: RouteStep[];
  /** Alternative routes (driver can choose) */
  alternativeRoutes?: Array<{
    polyline: string;
    durationMinutes: number;
    distanceKm: number;
    trafficLevel?: 'low' | 'moderate' | 'heavy';
    trafficDelayMinutes?: number;
    hasTolls?: boolean;
    tollCount?: number;
    summary?: string;
  }>;
  /** Traffic and route information */
  trafficLevel?: 'low' | 'moderate' | 'heavy';
  trafficDelayMinutes?: number;
  hasTolls?: boolean;
  tollCount?: number;
  summary?: string;
}

export type DriverMapStatus = 'available' | 'busy' | 'offline';

export interface DriverForMap {
  id: string;
  nickname: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** For map: green=available, red=on trip (busy), gray=offline */
  status?: DriverMapStatus;
  carType?: string | null;
  carPlateNumber?: string | null;
  carId?: string | null;
  driverId?: string | null;
  /** Optional label for popup e.g. "Available" / "On trip" / "Offline" */
  statusLabel?: string;
  /** When on trip: ETA and current order info for popup */
  etaMinutesToPickup?: number;
  etaMinutesTotal?: number;
  etaMinutesPickupToDropoff?: number;
  assignedOrderPickup?: string | null;
  assignedOrderDropoff?: string | null;
  /** When busy: "Busy until HH:MM" */
  busyUntil?: string | null;
}
