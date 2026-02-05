/** Shared API/UI types — single place for Order, Driver, Passenger, etc. */

export interface Order {
  id: string;
  status: string;
  tripType?: string;
  pickupAt: string;
  pickupAddress: string;
  middleAddress?: string | null;
  dropoffAddress: string;
  driverId?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  arrivedAtPickupAt?: string | null;
  leftPickupAt?: string | null;
  waitChargeAtPickupCents?: number | null;
  arrivedAtMiddleAt?: string | null;
  leftMiddleAt?: string | null;
  waitChargeAtMiddleCents?: number | null;
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
