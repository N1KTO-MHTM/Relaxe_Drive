import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../../ws/useSocket';
import { useAuthStore, type Role } from '../../store/auth';
import { api } from '../../api/client';
import OrdersMap from '../../components/OrdersMap';
import type { OrderRouteData, DriverForMap } from '../../types';
import type { DriverReportMap } from '../../components/OrdersMap';
import NavBar, { formatDistanceHint, STEP_TYPE_ICON } from '../../components/NavBar';
import RouteSelectionModal from '../../components/RouteSelectionModal';
import DriverTripsModal from '../../components/DriverTripsModal';
import { useToastStore } from '../../store/toast';
import { useShowAsDriver } from '../../contexts/ShowAsDriverContext';
import { shortId } from '../../utils/shortId';
import type { Order, DriverEta, PlanningResult } from '../../types';
import './Dashboard.css';

/** Distance in meters (approximate). */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface User {
  id: string;
  nickname: string;
  role: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  available?: boolean;
  carType?: string | null;
  carPlateNumber?: string | null;
  carId?: string | null;
  driverId?: string | null;
  online?: boolean;
}

const REPORT_EMOJI: Record<string, string> = {
  POLICE: '👮',
  TRAFFIC: '🛑',
  WORK_ZONE: '🚧',
  CAR_CRASH: '💥',
  OTHER: '⚠️',
};

const REPORT_TYPE_KEYS: Record<string, string> = {
  POLICE: 'dashboard.reportPolice',
  TRAFFIC: 'dashboard.reportTraffic',
  WORK_ZONE: 'dashboard.reportWorkZone',
  CAR_CRASH: 'dashboard.reportCrash',
  OTHER: 'dashboard.reportOther',
};

export default function Dashboard() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket, connected, reconnecting } = useSocket();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToastStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tripTypeForm, setTripTypeForm] = useState<'ONE_WAY' | 'ROUNDTRIP'>('ONE_WAY');
  const [routeTypeForm, setRouteTypeForm] = useState<'LOCAL' | 'LONG'>('LOCAL');
  const [pickupAddress, setPickupAddress] = useState('');
  const [middleAddress, setMiddleAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [manualEntry, setManualEntry] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [leftMiddleId, setLeftMiddleId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [driversRefreshTrigger, setDriversRefreshTrigger] = useState(0);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [, setDelayOrderingId] = useState<string | null>(null);
  const [, setManualUpdatingId] = useState<string | null>(null);
  const [_focusMode, setFocusMode] = useState(false);
  const [futureOrderCoords, setFutureOrderCoords] = useState<
    Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>
  >([]);
  const [problemZones, setProblemZones] = useState<{
    late: { lat: number; lng: number }[];
    cancelled: { lat: number; lng: number }[];
  } | null>(null);
  const [showProblemZones] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [stopUnderwayId, setStopUnderwayId] = useState<string | null>(null);
  const [confirmEndTripOrderId, setConfirmEndTripOrderId] = useState<string | null>(null);
  const [confirmEndTripSecondsLeft, setConfirmEndTripSecondsLeft] = useState(60);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOrderId, setDeleteConfirmOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectConfirmOrderId, setRejectConfirmOrderId] = useState<string | null>(null);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<OrderRouteData | null>(null);
  const [driverEtas, setDriverEtas] = useState<Record<string, { drivers: DriverEta[] }>>({});
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverSpeedMph, setDriverSpeedMph] = useState<number | null>(null);
  const lastDriverLocationRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const [driverHeadingDegrees, setDriverHeadingDegrees] = useState<number | null>(null);
  /** Smoothed heading for map arrow rotation (lerps toward driverHeadingDegrees). */
  const [driverHeadingSmooth, setDriverHeadingSmooth] = useState<number | null>(null);
  const driverHeadingSmoothRef = useRef<number | null>(null);
  const driverHeadingLastRenderedRef = useRef<number | null>(null);
  const [standingStartedAt, setStandingStartedAt] = useState<number | null>(null);
  const [pickMode, setPickMode] = useState<'pickup' | 'dropoff' | null>(
    null,
  );
  const [pickPoint, setPickPoint] = useState<{ lat: number; lng: number } | null>(null);
  /** Optional scheduled pickup date/time (empty = use "now" on backend). Format: datetime-local value (YYYY-MM-DDTHH:mm). */
  const [pickupAtForm, setPickupAtForm] = useState('');
  const [pickupType, setPickupType] = useState('');
  const [dropoffType, setDropoffType] = useState('');
  const [preferredCarTypeForm, setPreferredCarTypeForm] = useState<string>('');
  const [reverseGeocodeLoading, setReverseGeocodeLoading] = useState(false);
  const [passengersSuggestions, setPassengersSuggestions] = useState<
    Array<{
      id: string;
      phone?: string;
      name: string | null;
      pickupAddr: string | null;
      dropoffAddr: string | null;
      pickupType: string | null;
      dropoffType: string | null;
    }>
  >([]);
  const [orderPhone, setOrderPhone] = useState('');
  const [orderPassengerName, setOrderPassengerName] = useState('');
  const [orderTab, setOrderTab] = useState<'active' | 'completed' | 'addresses'>('active');
  const [_addressesTabPickup, setAddressesTabPickup] = useState('');
  const [_addressesTabDropoff, setAddressesTabDropoff] = useState('');
  const [_addressesTabPhone, setAddressesTabPhone] = useState('');
  void setAddressesTabPickup; void setAddressesTabDropoff; void setAddressesTabPhone;
  const [orderStatusFilter] = useState('');
  const [findByIdQuery] = useState('');

  const [isAutoOrder, setIsAutoOrder] = useState(false);
  const [dropoffImageUrl, setDropoffImageUrl] = useState('');
  const [orderOffer, setOrderOffer] = useState<Order | null>(null);
  const [offerCountdown, setOfferCountdown] = useState(0);
  const [offerRouteData, setOfferRouteData] = useState<{
    driverToPickupMinutes: number;
    durationMinutes: number;
    distanceKm: number;
  } | null>(null);
  const [driverStatusFilter] = useState<
    'all' | 'active' | 'busy' | 'offline'
  >('all');
  const [driverCarTypeFilter] = useState<string>('');
  const [driverSearchQuery] = useState('');
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [passengerAddressHistory, setPassengerAddressHistory] = useState<
    Array<{ id: string; address: string; type?: string }>
  >([]);
  /** Saved addresses from /addresses (dispatcher/admin) for address field suggestions. */
  const [savedAddressesList, setSavedAddressesList] = useState<Array<{ id: string; address: string }>>([]);
  const [mapCenterTrigger, setMapCenterTrigger] = useState(0);
  const [myLocationCenter, setMyLocationCenter] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [reports, setReports] = useState<DriverReportMap[]>([]);

  const [autoAssignEnabled] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [showZones] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null);
  const [_showPlanPanel, _setShowPlanPanel] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [postTripSummary, setPostTripSummary] = useState<{
    pickupAddress: string;
    dropoffAddress: string;
    distanceKm: number;
    durationMinutes: number;
    earningsCents: number;
    startedAt?: string | null;
    leftPickupAt?: string | null;
    completedAt: string;
    arrivedAtPickupAt?: string | null;
    pickupAt: string;
    waitChargeAtPickupCents?: number | null;
    waitChargeAtMiddleCents?: number | null;
  } | null>(null);
  const [_driverStats, setDriverStats] = useState<{
    totalEarningsCents: number;
    totalMiles: number;
  } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('TRAFFIC');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccessParams, setReportSuccessParams] = useState<{ type: string } | null>(null);

  useEffect(() => {
    if (reportSuccessParams) {
      const t = setTimeout(() => setReportSuccessParams(null), 5000);
      return () => clearTimeout(t);
    }
  }, [reportSuccessParams]);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);
  const [reportsRefreshTrigger, setReportsRefreshTrigger] = useState(0);
  const [reportTicks, setReportTicks] = useState(0);
  const [driverAssignSearch, setDriverAssignSearch] = useState<Record<string, string>>({});
  const [_driverAssignByIdInput, _setDriverAssignByIdInput] = useState<Record<string, string>>({});
  const [selectedDriverDetail, setSelectedDriverDetail] = useState<{
    orderId: string;
    driver: User;
  } | null>(null);
  const [driverTripsModalId, setDriverTripsModalId] = useState<string | null>(null);
  const [showRouteSelection, setShowRouteSelection] = useState(false);
  const [driverSetDestinationAddress, setDriverSetDestinationAddress] = useState('');
  const [driverSetDestinationLoading, setDriverSetDestinationLoading] = useState(false);
  const autoStopSentForOrderIdRef = useRef<string | null>(null);
  const [driverMapFullScreen, setDriverMapFullScreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'terrain' | 'dark'>(() => {
    try {
      const s = localStorage.getItem('rd_map_style');
      if (s === 'street' || s === 'satellite' || s === 'terrain' || s === 'dark') return s;
    } catch {}
    return 'street';
  });

  // Manual Timer Logic
  const [manualTimerStart, setManualTimerStart] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('relaxdrive_manual_timer_start') || '{}');
    } catch {
      return {};
    }
  });
  const [showTimerNoteModal, setShowTimerNoteModal] = useState<string | null>(null);
  const [timerNoteVal, setTimerNoteVal] = useState('');

  useEffect(() => {
    localStorage.setItem('relaxdrive_manual_timer_start', JSON.stringify(manualTimerStart));
  }, [manualTimerStart]);

  const isDriver = user?.role === 'DRIVER';
  const showAsDriverCtx = useShowAsDriver();
  const canShowAsDriver = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const effectiveIsDriver =
    isDriver || (canShowAsDriver && (showAsDriverCtx?.showAsDriver ?? false));
  const isAdmin = user?.role === 'ADMIN';
  const isDispatcher = user?.role === 'DISPATCHER';
  const canAssign = isAdmin || isDispatcher;
  const canCreateOrder =
    (isAdmin || isDispatcher || user?.role === 'CLIENT') && !effectiveIsDriver;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleStartTimer = (orderId: string, type: 'pickup' | 'middle' = 'pickup') => {
    const key = type === 'middle' ? `${orderId}_middle` : orderId;
    setManualTimerStart((prev) => ({ ...prev, [key]: Date.now() }));
  };

  const handleStopTimer = (orderId: string, type: 'pickup' | 'middle' = 'pickup') => {
    setShowTimerNoteModal(`${orderId}:${type}`);
    setTimerNoteVal('');
  };

  const submitWaitInfo = async () => {
    if (!showTimerNoteModal) return;
    const [orderId, type] = showTimerNoteModal.split(':') as [string, 'pickup' | 'middle'];
    const key = type === 'middle' ? `${orderId}_middle` : orderId;
    const start = manualTimerStart[key];
    if (!start) return;
    const minutes = Math.max(1, Math.ceil((Date.now() - start) / 60000));
    try {
      await api.patch(`/orders/${orderId}/wait-info`, { minutes, notes: timerNoteVal, type });
      setManualTimerStart((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setShowTimerNoteModal(null);
      toast.success(t('dashboard.waitTimerSaved') || 'Wait info saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save wait info');
    }
  };

  const submitWaitInfoReset = async (orderId: string, type: 'pickup' | 'middle' = 'pickup') => {
    try {
      await api.patch(`/orders/${orderId}/wait-info`, { minutes: null, notes: '', type });
      toast.success(t('dashboard.waitInfoReset') || 'Wait info reset');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset wait info');
    }
  };

  /** Driver's current trip (ASSIGNED or IN_PROGRESS) for Bolt-style card and auto-select */
  const currentDriverOrder =
    isDriver && user?.id
      ? orders.find(
          (o) => (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS') && o.driverId === user.id,
        )
      : null;

  /** Short "where driver is heading" for map marker popup */
  const driverHeadingTo = useMemo(() => {
    if (!currentDriverOrder) return null;
    const short = (s: string) => (s?.length > 28 ? s.slice(0, 25) + '…' : s) || '';
    if (currentDriverOrder.status === 'ASSIGNED')
      return `To pickup: ${short(currentDriverOrder.pickupAddress || '')}`;
    if (currentDriverOrder.status === 'IN_PROGRESS')
      return `To dropoff: ${short(currentDriverOrder.dropoffAddress || '')}`;
    return null;
  }, [
    currentDriverOrder?.id,
    currentDriverOrder?.status,
    currentDriverOrder?.pickupAddress,
    currentDriverOrder?.dropoffAddress,
  ]);

  // Auto-select driver's active order so map shows route immediately (Bolt-style)
  useEffect(() => {
    if (!isDriver || !user?.id || !currentDriverOrder) return;
    if (selectedOrderId !== currentDriverOrder.id) setSelectedOrderId(currentDriverOrder.id);
  }, [isDriver, user?.id, currentDriverOrder?.id, currentDriverOrder, selectedOrderId]);

  useEffect(() => {
    if (orderTab !== 'completed') return;
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    setCompletedLoading(true);
    api
      .get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCompletedOrders(effectiveIsDriver ? list.filter((o) => o.driverId === user?.id) : list);
      })
      .catch(() => setCompletedOrders([]))
      .finally(() => setCompletedLoading(false));
  }, [orderTab, effectiveIsDriver, user?.id]);

  const filteredOrders = useMemo(() => {
    const list = orderTab === 'active' ? orders : completedOrders;
    let out =
      orderTab === 'active'
        ? list.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
        : list.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED');
    if (effectiveIsDriver && orderTab === 'active') out = out.filter((o) => o.driverId === user?.id);
    if (orderStatusFilter) out = out.filter((o) => o.status === orderStatusFilter);
    const q = findByIdQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((o) => {
        if ((o.id ?? '').toLowerCase().includes(q)) return true;
        if ((o.passengerId ?? '').toLowerCase().includes(q)) return true;
        if (o.passenger?.id && o.passenger.id.toLowerCase().includes(q)) return true;
        if (o.passenger?.phone && o.passenger.phone.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    // Default sort by pickupAt (newest first)
    return out.sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime());
  }, [orders, completedOrders, orderTab, orderStatusFilter, findByIdQuery, effectiveIsDriver, user?.id]);

  /** Unique existing addresses from clients and orders — for autocomplete and "no duplicate" hint when creating order. */
  const existingAddresses = useMemo(() => {
    const set = new Set<string>();
    passengersSuggestions.forEach((p) => {
      if (p.pickupAddr?.trim()) set.add(p.pickupAddr.trim());
      if (p.dropoffAddr?.trim()) set.add(p.dropoffAddr.trim());
    });
    orders.forEach((o) => {
      if (o.pickupAddress?.trim()) set.add(o.pickupAddress.trim());
      if (o.dropoffAddress?.trim()) set.add(o.dropoffAddress.trim());
    });
    passengerAddressHistory.forEach((a) => {
      if (a.address?.trim()) set.add(a.address.trim());
    });
    savedAddressesList.forEach((a) => {
      if (a.address?.trim()) set.add(a.address.trim());
    });
    return Array.from(set).sort();
  }, [passengersSuggestions, orders, passengerAddressHistory, savedAddressesList]);

  /** Up to 5 address suggestions for pickup (no duplicates; filter by current input). */
  const pickupAddressSuggestions = useMemo(() => {
    const q = pickupAddress.trim().toLowerCase();
    if (!q) return existingAddresses.slice(0, 5);
    return existingAddresses.filter((a) => a.toLowerCase().includes(q)).slice(0, 5);
  }, [existingAddresses, pickupAddress]);

  /** Up to 5 address suggestions for dropoff. */
  const dropoffAddressSuggestions = useMemo(() => {
    const q = dropoffAddress.trim().toLowerCase();
    if (!q) return existingAddresses.slice(0, 5);
    return existingAddresses.filter((a) => a.toLowerCase().includes(q)).slice(0, 5);
  }, [existingAddresses, dropoffAddress]);

  /** Up to 5 address suggestions for middle (roundtrip). */
  const middleAddressSuggestions = useMemo(() => {
    const q = middleAddress.trim().toLowerCase();
    if (!q) return existingAddresses.slice(0, 5);
    return existingAddresses.filter((a) => a.toLowerCase().includes(q)).slice(0, 5);
  }, [existingAddresses, middleAddress]);

  /** Addresses tab: up to 5 suggestions for pickup/dropoff (no duplicates). */
  // Removed unused suggestion variables - suggestions are computed inline in the UI

  /** Drivers filtered by status (active/busy/offline) and car type for sidebar and map. */
  const filteredDrivers = useMemo(() => {
    let list = drivers;
    if (driverStatusFilter !== 'all') {
      list = list.filter((d) => {
        const hasLocation = d.lat != null && d.lng != null;
        const busy = orders.some(
          (o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'),
        );
        const isOnline = (d as User).online === true;
        const notAvailable = d.available === false || !isOnline;

        if (driverStatusFilter === 'active') return hasLocation && !busy && !notAvailable;
        if (driverStatusFilter === 'busy') return busy;
        if (driverStatusFilter === 'offline') return !hasLocation || notAvailable;
        return true;
      });
    }
    if (driverCarTypeFilter) {
      list = list.filter((d) => (d as { carType?: string | null }).carType === driverCarTypeFilter);
    }
    const q = (driverSearchQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          (d.nickname ?? '').toLowerCase().includes(q) ||
          (d.phone ?? '').toLowerCase().includes(q) ||
          ((d as { email?: string | null }).email ?? '').toLowerCase().includes(q) ||
          ((d as { driverId?: string | null }).driverId ?? '').toLowerCase().includes(q) ||
          ((d as User).carId ?? '').toLowerCase().includes(q) ||
          (d.id ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [drivers, orders, driverStatusFilter, driverCarTypeFilter, driverSearchQuery]);

  const driversForMap: DriverForMap[] = useMemo(() => {
    const selectedOrder = selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null;
    const preferredCar = selectedOrder?.preferredCarType?.trim().toUpperCase();
    const driverList = preferredCar
      ? filteredDrivers.filter((d) => (d as { carType?: string | null }).carType === preferredCar)
      : filteredDrivers;
    return driverList
      .map((d) => {
        const onTripOrder = orders.find(
          (o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'),
        );
        const onTrip = !!onTripOrder;

        // Determine status:
        const isOnline = (d as any).online ?? false;
        const status: 'busy' | 'available' | 'offline' = onTrip
          ? 'busy'
          : isOnline
            ? 'available'
            : 'offline';

        if (d.lat == null || d.lng == null) return null;

        const etaData =
          onTripOrder && driverEtas[onTripOrder.id]?.drivers?.find((x) => x.id === d.id);

        let currentOrderDistance: string | null = null;
        if (onTripOrder && d.lat && d.lng) {
          // Calculate approximate distance to next stop
          // If ASSIGNED -> pickup
          // If IN_PROGRESS -> dropoff (or middle)
          let targetLat: number | null = null;
          let targetLng: number | null = null;

          if (onTripOrder.status === 'ASSIGNED') {
            // Try to find coords in futureOrderCoords
            const future = futureOrderCoords.find((f) => f.orderId === onTripOrder.id);
            if (future) {
              targetLat = future.pickupLat;
              targetLng = future.pickupLng;
            }
          } else if (onTripOrder.status === 'IN_PROGRESS') {
            // For dropoff we don't have direct coords on order object usually,
            // but if we have routeData for this order (selected), use it.
            if (selectedOrderId === onTripOrder.id && routeData?.dropoffCoords) {
              targetLat = routeData.dropoffCoords.lat;
              targetLng = routeData.dropoffCoords.lng;
            }
          }

          if (targetLat != null && targetLng != null) {
            const distM = haversineM(d.lat, d.lng, targetLat, targetLng);
            const distKm = Math.round((distM / 1000) * 10) / 10;
            currentOrderDistance = `${distKm} km`;
          }
        }

        return {
          id: d.id,
          nickname: d.nickname,
          phone: d.phone,
          lat: d.lat,
          lng: d.lng,
          status,
          online: isOnline,
          carType: (d as { carType?: string | null }).carType ?? null,
          carPlateNumber: (d as { carPlateNumber?: string | null }).carPlateNumber ?? null,
          carId: (d as User).carId ?? null,
          driverId: (d as { driverId?: string | null }).driverId ?? null,
          statusLabel:
            status === 'busy'
              ? t('dashboard.onTrip')
              : status === 'available'
                ? t('dashboard.available')
                : t('dashboard.offline'),
          etaMinutesToPickup: etaData?.etaMinutesToPickup,
          etaMinutesTotal: etaData?.etaMinutesTotal,
          etaMinutesPickupToDropoff: etaData?.etaMinutesPickupToDropoff,
          assignedOrderPickup: onTripOrder?.pickupAddress ?? null,
          assignedOrderDropoff: onTripOrder?.dropoffAddress ?? null,
          currentOrderDistance,
          busyUntil: (() => {
            if (!onTripOrder) return null;
            if (onTripOrder.completedAt) return new Date(onTripOrder.completedAt).toISOString();
            const etaMin = etaData?.etaMinutesPickupToDropoff ?? etaData?.etaMinutesTotal ?? 30;
            if (onTripOrder.leftPickupAt) {
              return new Date(
                new Date(onTripOrder.leftPickupAt).getTime() + etaMin * 60_000,
              ).toISOString();
            }
            return new Date(
              new Date(onTripOrder.pickupAt).getTime() +
                (etaData?.etaMinutesTotal ?? etaMin) * 60_000,
            ).toISOString();
          })(),
        } as DriverForMap;
      })
      .filter((d): d is DriverForMap => d !== null);
  }, [filteredDrivers, orders, driverEtas, selectedOrderId, t]);

  const selectedOrderTooltip = useMemo(() => {
    if (!selectedOrderId || !routeData) return undefined;
    const ord = orders.find((x) => x.id === selectedOrderId);
    const etas = ord ? driverEtas[ord.id]?.drivers?.[0] : null;
    const driver = ord?.driverId ? drivers.find((d) => d.id === ord.driverId) : null;
    return {
      eta: etas ? `${etas.etaMinutesToPickup} min to pickup` : undefined,
      onTime: !ord?.riskLevel || ord.riskLevel === 'LOW',
      driverName: driver?.nickname ?? undefined,
    };
  }, [selectedOrderId, routeData, orders, driverEtas, drivers]);

  /** Per-dispatcher saved map view (center + zoom). Restored on load, saved on move/zoom. */
  const savedMapView = useMemo(() => {
    if (!user?.id || effectiveIsDriver || !canAssign) return null;
    try {
      const raw = localStorage.getItem(`relaxdrive_map_${user.id}`);
      if (!raw) return null;
      const v = JSON.parse(raw) as { center?: number[]; zoom?: number };
      if (Array.isArray(v.center) && v.center.length === 2 && typeof v.zoom === 'number') {
        return { center: [v.center[0], v.center[1]] as [number, number], zoom: v.zoom };
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [user?.id, effectiveIsDriver, canAssign]);

  const handleMapViewChange = useMemo(() => {
    if (!user?.id || effectiveIsDriver || !canAssign) return undefined;
    return (center: [number, number], zoom: number) => {
      try {
        localStorage.setItem(`relaxdrive_map_${user.id}`, JSON.stringify({ center, zoom }));
      } catch {
        /* ignore */
      }
    };
  }, [user?.id, effectiveIsDriver, canAssign]);

  /** Returns datetime-local value for default pickup (now + 30 min). */
  function getDefaultPickupAtForm(): string {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }


  function loadOrders() {
    setLoading(true);
    api
      .get<Order[]>('/orders')
      .then((data) => {
        // Filter out deleted and cancelled orders
        const activeOrders = Array.isArray(data)
          ? data.filter((o) => o.status !== 'DELETED' && o.status !== 'CANCELLED')
          : [];
        setOrders(activeOrders);
      })
      .catch(() => {
        setOrders([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }

  /** Refresh all data: orders, drivers, reports, route, and completed list if on that tab. */
  function refreshAll() {
    loadOrders();
    if (effectiveIsDriver && user?.id) {
      api.get<{ id: string; nickname: string; role: string; available?: boolean; locale?: string }>('/users/me').then((data) => {
        if (data) setUser({ ...user, ...data, role: data.role as Role });
      }).catch(() => {});
    }
    if (canAssign) {
      api
        .get<User[]>('/users')
        .then((data) => {
          setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
        })
        .catch(() => {});
    }
    setReportsRefreshTrigger((prev) => prev + 1);
    setRouteRefreshKey((prev) => prev + 1);
    setMapCenterTrigger((prev) => prev + 1);
    if (orderTab === 'completed') {
      setCompletedLoading(true);
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      api
        .get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`)
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setCompletedOrders(effectiveIsDriver ? list.filter((o) => o.driverId === user?.id) : list);
        })
        .catch(() => setCompletedOrders([]))
        .finally(() => setCompletedLoading(false));
    }
  }

  useEffect(() => {
    loadOrders();
  }, [showForm]);

  /** Driver: refetch orders when dashboard is shown so assigned/auto-sent trips appear. */
  useEffect(() => {
    if (effectiveIsDriver && user?.id) loadOrders();
  }, [effectiveIsDriver, user?.id]);

  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;

  /** Load all data everywhere when dashboard opens (and when user changes). */
  const refreshZones = async () => {
    try {
      const res: any = await api.get('/zones');
      setZones(res.data as any[]);
    } catch (err) {
      console.error('Failed to fetch zones:', err);
    }
  };

  useEffect(() => {
    if (user) {
      refreshAll();
      refreshZones();
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAllRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Dispatcher: poll drivers only when tab visible (saves memory and network when in background)
  useEffect(() => {
    if (!canAssign || typeof document === 'undefined') return;
    const DRIVER_POLL_MS = 12000;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        api
          .get<User[]>('/users')
          .then((data) => {
            setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
          })
          .catch(() => {});
      }
    }, DRIVER_POLL_MS);
    return () => clearInterval(t);
  }, [canAssign]);

  // Driver: poll orders + user when tab visible so mobile gets updates even if WebSocket drops
  useEffect(() => {
    if (!effectiveIsDriver || !user?.id || typeof document === 'undefined') return;
    const DRIVER_UPDATE_POLL_MS = 15000;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refreshAllRef.current();
    }, DRIVER_UPDATE_POLL_MS);
    return () => clearInterval(t);
  }, [effectiveIsDriver, user?.id]);

  /** Trigger one immediate location send (so driver appears on map right after going online). */
  const sendLocationOnceRef = useRef<(() => void) | null>(null);

  function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dlat = ((lat2 - lat1) * Math.PI) / 180;
    const dlng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dlng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Bearing in degrees (0–360) from (lat1,lng1) to (lat2,lng2). */
  function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    return (deg + 360) % 360;
  }

  function updateDriverLocation(lat: number, lng: number) {
    const now = Date.now();
    const prev = lastDriverLocationRef.current;
    if (prev && now - prev.ts > 500) {
      const distM = haversineM(prev.lat, prev.lng, lat, lng);
      const dtH = (now - prev.ts) / 3600000;
      if (distM < 15) {
        setDriverSpeedMph(0);
        setStandingStartedAt((p) => (p === null ? now : p));
      } else {
        if (dtH > 0) setDriverSpeedMph(Math.round((distM / 1609.34 / dtH) * 10) / 10);
        setStandingStartedAt(null);
        setDriverHeadingDegrees(bearingDegrees(prev.lat, prev.lng, lat, lng));
      }
    }
    lastDriverLocationRef.current = { lat, lng, ts: now };
    setDriverLocation({ lat, lng });
  }

  useEffect(() => {
    if (user?.role !== 'DRIVER') return;
    let cancelled = false;
    api
      .get<{ totalEarningsCents: number; totalMiles: number }>('/users/me/stats')
      .then((data) => {
        if (!cancelled)
          setDriverStats({
            totalEarningsCents: data.totalEarningsCents,
            totalMiles: data.totalMiles,
          });
      })
      .catch(() => {
        if (!cancelled) setDriverStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    const state = location.state as {
      createOrderDate?: string;
      focusOrderId?: string;
      openForm?: boolean;
      passengerPrefill?: {
        phone?: string;
        name?: string;
        pickupAddr?: string;
        dropoffAddr?: string;
        pickupType?: string;
        dropoffType?: string;
      };
    } | null;
    const focusOrderId = state?.focusOrderId;
    if (focusOrderId && canCreateOrder) {
      setSelectedOrderId(focusOrderId);
      setFocusMode(true);
      setOrderTab('active');
      navigate(location.pathname, {
        replace: true,
        state: state && typeof state === 'object' ? { ...state, focusOrderId: undefined } : {},
      });
    }
    const fromState = state?.createOrderDate;
    const fromUrl = searchParams.get('createOrderDate');
    const date = fromState ?? fromUrl;
    if (date && canCreateOrder) {
      setShowForm(true);
      const d = new Date(date + 'T09:00:00');
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setPickupAtForm(`${y}-${m}-${day}T09:00`);
      }
      if (fromState) navigate(location.pathname, { replace: true, state: {} });
      if (fromUrl) {
        const p = new URLSearchParams(searchParams);
        p.delete('createOrderDate');
        setSearchParams(p, { replace: true });
      }
    }
    if (state?.openForm && canCreateOrder) {
      setShowForm(true);
      const prefill = state.passengerPrefill;
      if (prefill) {
        if (prefill.phone != null) setOrderPhone(prefill.phone);
        if (prefill.name != null) setOrderPassengerName(prefill.name);
        if (prefill.pickupAddr != null) setPickupAddress(prefill.pickupAddr);
        if (prefill.dropoffAddr != null) setDropoffAddress(prefill.dropoffAddr);
        if (prefill.pickupType != null) setPickupType(prefill.pickupType);
        if (prefill.dropoffType != null) setDropoffType(prefill.dropoffType);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, canCreateOrder, searchParams, setSearchParams]);

  useEffect(() => {
    if (!socket || !user) return;
    const onOrders = (data: unknown) => {
      const list = Array.isArray(data) ? (data as Order[]) : [];
      const filtered = user.role === 'DRIVER' ? list.filter((o) => o.driverId === user.id) : list;
      setOrders(filtered);
    };
    socket.on('orders', onOrders);

    const onDrivers = (data: unknown) => {
      setDrivers(Array.isArray(data) ? (data as User[]).filter((u) => u.role === 'DRIVER') : []);
    };
    socket.on('drivers', onDrivers);

    const onUserUpdated = () => {
      // Refresh global drivers list to get the latest online/offline status
      setDriversRefreshTrigger((n) => n + 1);
    };
    socket.on('user.updated', onUserUpdated);
    socket.on('connect', refreshAll);

    return () => {
      socket.off('orders', onOrders);
      socket.off('drivers', onDrivers);
      socket.off('user.updated', onUserUpdated);
      socket.off('connect', refreshAll);
    };
  }, [socket, user?.id, user?.role]);

  useEffect(() => {
    if (!socket) return;
    const onOffer = (data: unknown) => {
      if (user?.role !== 'DRIVER') return;
      const o = data as Order;
      // Play sound?
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('New Order Offer!', { body: o.pickupAddress });
      }
      setOrderOffer(o);
      setOfferCountdown(15);
    };
    socket.on('order.offer', onOffer);
    return () => {
      socket.off('order.offer', onOffer);
    };
  }, [socket, user?.role]);

  useEffect(() => {
    if (offerCountdown > 0) {
      const t = setTimeout(() => setOfferCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    } else if (offerCountdown === 0 && orderOffer) {
      setOrderOffer(null);
      setOfferRouteData(null);
    }
  }, [offerCountdown, orderOffer]);

  // Fetch ETA/mileage for offer when driver has location (compact ride info)
  useEffect(() => {
    if (!orderOffer || !driverLocation) {
      setOfferRouteData(null);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    params.set('fromLat', String(driverLocation.lat));
    params.set('fromLng', String(driverLocation.lng));
    api
      .get<OrderRouteData>(`/orders/${orderOffer.id}/route?${params.toString()}`)
      .then((data) => {
        if (!cancelled && data) {
          setOfferRouteData({
            driverToPickupMinutes: data.driverToPickupMinutes ?? 0,
            durationMinutes: data.durationMinutes ?? 0,
            distanceKm: data.distanceKm ?? 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setOfferRouteData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orderOffer?.id, driverLocation?.lat, driverLocation?.lng]);

  async function handleAcceptOffer(orderId: string) {
    try {
      await api.patch(`/orders/${orderId}/accept`, {});
      setOrderOffer(null);
      setOfferRouteData(null);
      toast.success(t('dashboard.orderAccepted'));
    } catch (err) {
      toast.error('Failed to accept order (maybe taken?)');
      setOrderOffer(null);
      setOfferRouteData(null);
    }
  }

  async function handleDeclineOffer(orderId: string) {
    try {
      await api.patch(`/orders/${orderId}/decline`, {});
    } catch {
      // ignore
    }
    setOrderOffer(null);
    setOfferRouteData(null);
  }

  useEffect(() => {
    if (!socket || !canAssign) return;
    const onPlanning = (data: unknown) => setPlanningResult(data as PlanningResult);
    socket.on('planning.update', onPlanning);
    return () => {
      socket.off('planning.update', onPlanning);
    };
  }, [socket, canAssign]);

  useEffect(() => {
    if (!canAssign) return;
    api
      .get<PlanningResult>('/planning')
      .then(setPlanningResult)
      .catch(() => {});
  }, [canAssign]);

  useEffect(() => {
    if (!selectedOrderId) setFocusMode(false);
  }, [selectedOrderId]);

  useEffect(() => {
    if (!canAssign) return;
    api
      .get<Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>>(
        '/planning/order-coords',
      )
      .then(setFutureOrderCoords)
      .catch(() => {});
  }, [canAssign]);

  useEffect(() => {
    if (!canAssign || !showProblemZones) return;
    api
      .get<{ late: { lat: number; lng: number }[]; cancelled: { lat: number; lng: number }[] }>(
        '/planning/problem-zones',
      )
      .then(setProblemZones)
      .catch(() => setProblemZones(null));
  }, [canAssign, showProblemZones]);

  useEffect(() => {
    if (!socket) return;
    const onAlert = (data: unknown) => {
      const d = data as {
        type?: string;
        orderId?: string;
        driverId?: string;
        pickupAddress?: string;
        pickupAt?: string;
        at?: string;
      };
      if (d?.type) {
        setAlerts((prev) => [
          {
            id: `${d.at ?? Date.now()}-${d.orderId ?? ''}-${d.type}-${(d as { count?: number }).count ?? ''}`,
            type: d.type ?? 'unknown',
            orderId: d.orderId,
            driverId: d.driverId,
            pickupAddress: d.pickupAddress,
            pickupAt: d.pickupAt,
            at: d.at ?? '',
            count: (d as { count?: number }).count,
          },
          ...prev.slice(0, 49),
        ]);
      }
    };
    socket.on('alerts', onAlert);
    return () => {
      socket.off('alerts', onAlert);
    };
  }, [socket]);

  // Browser notifications: driver on assignment, dispatcher/admin on new order (only when tab in background)
  useEffect(() => {
    if (!socket || !user || typeof document === 'undefined' || !('Notification' in window)) return;
    const onAlert = (data: unknown) => {
      const d = data as {
        type?: string;
        orderId?: string;
        driverId?: string;
        pickupAddress?: string;
        pickupAt?: string;
      };
      if (!d?.type || !document.hidden) return;
      const pickup = d.pickupAddress ?? '';
      if (user.role === 'DRIVER' && d.type === 'order.assigned' && d.driverId === user.id) {
        if (Notification.permission === 'granted') {
          new Notification(t('dashboard.alertOrderAssigned', { pickup }) || 'Order assigned', {
            body: pickup,
          });
          import('../../utils/playAlertSound').then((m) => m.playAlertSound()).catch(() => {});
        }
      } else if (
        (user.role === 'ADMIN' || user.role === 'DISPATCHER') &&
        d.type === 'order.created'
      ) {
        if (Notification.permission === 'granted') {
          new Notification(t('dashboard.alertOrderCreated', { pickup }) || 'New order', {
            body: pickup,
          });
          import('../../utils/playAlertSound').then((m) => m.playAlertSound()).catch(() => {});
        }
      } else if (d.type === 'reminder_pickup_soon') {
        const forDriver = user.role === 'DRIVER' && d.driverId === user.id;
        const forDispatcher = user.role === 'ADMIN' || user.role === 'DISPATCHER';
        if ((forDriver || forDispatcher) && Notification.permission === 'granted') {
          new Notification(t('dashboard.alertReminderPickupTitle') || 'Pickup soon', {
            body: pickup || (d.pickupAt ? new Date(d.pickupAt).toLocaleTimeString() : ''),
          });
          import('../../utils/playAlertSound').then((m) => m.playAlertSound()).catch(() => {});
        }
      }
    };
    socket.on('alerts', onAlert);
    return () => {
      socket.off('alerts', onAlert);
    };
  }, [socket, user?.id, user?.role, t]);

  // Request notification permission when dashboard is shown (once)
  useEffect(() => {
    if (!user || typeof document === 'undefined' || !('Notification' in window)) return;
    if (
      Notification.permission === 'default' &&
      (user.role === 'DRIVER' || user.role === 'ADMIN' || user.role === 'DISPATCHER')
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, [user?.id, user?.role]);

  // Dispatcher: poll drivers when tab visible only — when hidden, skip to save memory/CPU
  useEffect(() => {
    if (!canAssign) return;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      api
        .get<User[]>('/users')
        .then((data) => {
          setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
        })
        .catch(() => setDrivers([]));
    };
    load();
    const interval = setInterval(load, 8000); // 8s when visible; when hidden we skip (visibilitychange refetches on focus)
    return () => clearInterval(interval);
  }, [canAssign]);

  // 1s tick only when tab visible (timers for wait/ETA) — pause when hidden to save memory
  useEffect(() => {
    const hasInProgress = orders.some((o) => o.status === 'IN_PROGRESS' && o.startedAt);
    const hasWaitTimer = orders.some(
      (o) =>
        (o.status === 'ASSIGNED' && o.arrivedAtPickupAt && !o.leftPickupAt) ||
        (o.status === 'IN_PROGRESS' && o.arrivedAtMiddleAt && !o.leftMiddleAt),
    );
    if (!hasInProgress && !hasWaitTimer) return;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible')
        setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [orders]);

  useEffect(() => {
    if (!confirmEndTripOrderId) return;
    setConfirmEndTripSecondsLeft(60);
    const t = setInterval(() => {
      setConfirmEndTripSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [confirmEndTripOrderId]);

  // Auto-select an order so the map shows the route: driver = their active order, dispatcher = first order (prefer assigned)
  useEffect(() => {
    if (effectiveIsDriver) {
      const active = orders.filter(
        (o) => (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS') && o.driverId === user?.id,
      );
      if (active.length === 0) {
        setSelectedOrderId(null);
        return;
      }
      const first = active.sort(
        (a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime(),
      )[0];
      setSelectedOrderId(first.id);
      return;
    }
    // Dispatcher: prefer first order that has a driver assigned so route is relevant
    if (!canAssign || orders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    const active = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    const withDriver = active.filter((o) => !!o.driverId);
    const toSelect = (withDriver.length > 0 ? withDriver : active).sort(
      (a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime(),
    )[0];
    setSelectedOrderId(toSelect?.id ?? null);
  }, [effectiveIsDriver, canAssign, orders, user?.id]);

  // Load passengers for suggestions when create form is shown
  useEffect(() => {
    if (!canCreateOrder || !showForm) return;
    api
      .get<
        Array<{
          id: string;
          phone?: string;
          name: string | null;
          pickupAddr: string | null;
          dropoffAddr: string | null;
          pickupType: string | null;
          dropoffType: string | null;
        }>
      >('/clients')
      .then((data) => {
        setPassengersSuggestions(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [canCreateOrder, showForm]);

  // Load saved addresses (Addresses page data) for address field suggestions — dispatcher/admin only
  useEffect(() => {
    if (!canCreateOrder || !showForm) return;
    api
      .get<Array<{ id: string; address: string }>>('/addresses')
      .then((data) => setSavedAddressesList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [canCreateOrder, showForm]);

  // Fetch address history when passenger selected
  useEffect(() => {
    if (!orderPhone || manualEntry) {
      setPassengerAddressHistory([]);
      return;
    }
    const p = passengersSuggestions.find((x) => x.phone === orderPhone);
    if (!p) {
      setPassengerAddressHistory([]);
      return;
    }
    api
      .get<Array<{ id: string; address: string; type?: string }>>(`/clients/${p.id}/addresses`)
      .then((data) => setPassengerAddressHistory(Array.isArray(data) ? data : []))
      .catch(() => setPassengerAddressHistory([]));
  }, [orderPhone, manualEntry, passengersSuggestions]);

  // Preload driver ETAs when an order is selected (dispatcher) so dropdown shows ETA without extra click
  useEffect(() => {
    if (!selectedOrderId || !canAssign) return;
    if (driverEtas[selectedOrderId]) return;
    api
      .get<{ drivers: DriverEta[] }>(`/orders/${selectedOrderId}/driver-etas`)
      .then((data) => {
        setDriverEtas((prev) => ({ ...prev, [selectedOrderId]: { drivers: data.drivers || [] } }));
      })
      .catch(() => {});
  }, [selectedOrderId, canAssign, driverEtas]);

  // Preload driver ETAs for all active orders (ASSIGNED/IN_PROGRESS) so map popups show ETA
  useEffect(() => {
    if (!canAssign) return;
    const activeOrderIds = orders
      .filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS')
      .map((o) => o.id)
      .filter((id) => !driverEtas[id]);
    if (activeOrderIds.length === 0) return;
    Promise.all(
      activeOrderIds.map((id) =>
        api
          .get<{ drivers: DriverEta[] }>(`/orders/${id}/driver-etas`)
          .then((data) => ({ id, drivers: data.drivers || [] })),
      ),
    )
      .then((results) => {
        setDriverEtas((prev) => {
          const next = { ...prev };
          results.forEach(({ id, drivers }) => {
            next[id] = { drivers };
          });
          return next;
        });
      })
      .catch(() => {});
  }, [canAssign, orders, driverEtas]);

  // Prune driverEtas: keep only active orders + selected (saves memory when many completed orders)
  const driverEtasPruneKey = useMemo(
    () => orders.map((o) => `${o.id}:${o.status}`).join(',') + (selectedOrderId ?? ''),
    [orders, selectedOrderId],
  );
  useEffect(() => {
    const activeIds = new Set(
      orders.filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').map((o) => o.id),
    );
    if (selectedOrderId) activeIds.add(selectedOrderId);
    setDriverEtas((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((id) => activeIds.has(id))) return prev;
      const next: typeof prev = {};
      keys.forEach((id) => {
        if (activeIds.has(id)) next[id] = prev[id];
      });
      return next;
    });
  }, [driverEtasPruneKey]);

  useEffect(() => {
    if (!selectedOrderId) {
      setRouteData(null);
      return;
    }
    let cancelled = false;
    const fetchRoute = (fromLat?: number, fromLng?: number) => {
      const params = new URLSearchParams();
      if (fromLat != null && fromLng != null) {
        params.set('fromLat', String(fromLat));
        params.set('fromLng', String(fromLng));
      }
      if (isDriver) params.set('alternatives', '1');
      const q = params.toString() ? `?${params.toString()}` : '';
      api
        .get<OrderRouteData>(`/orders/${selectedOrderId}/route${q}`)
        .then((data) => {
          if (!cancelled) {
            setRouteData(data);
            setSelectedRouteIndex(0);
          }
        })
        .catch(() => {
          if (!cancelled) setRouteData(null);
        });
    };
    if (isDriver) {
      if (driverLocation) {
        fetchRoute(driverLocation.lat, driverLocation.lng);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            fetchRoute(pos.coords.latitude, pos.coords.longitude);
          },
          () => fetchRoute(),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
      } else {
        fetchRoute();
      }
    } else {
      fetchRoute();
    }
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, isDriver, driverLocation?.lat, driverLocation?.lng, routeRefreshKey]);

  useEffect(() => {
    const bbox = (() => {
      if (routeData?.pickupCoords && routeData?.dropoffCoords) {
        const lats = [routeData.pickupCoords.lat, routeData.dropoffCoords.lat];
        const lngs = [routeData.pickupCoords.lng, routeData.dropoffCoords.lng];
        if (driverLocation) {
          lats.push(driverLocation.lat);
          lngs.push(driverLocation.lng);
        }
        const pad = 0.25;
        return {
          minLat: Math.min(...lats) - pad,
          maxLat: Math.max(...lats) + pad,
          minLng: Math.min(...lngs) - pad,
          maxLng: Math.max(...lngs) + pad,
        };
      }
      if (driverLocation) {
        const pad = 0.3;
        return {
          minLat: driverLocation.lat - pad,
          maxLat: driverLocation.lat + pad,
          minLng: driverLocation.lng - pad,
          maxLng: driverLocation.lng + pad,
        };
      }
      const pad = 2;
      return {
        minLat: 41.1112 - pad,
        maxLat: 41.1112 + pad,
        minLng: -74.0438 - pad,
        maxLng: -74.0438 + pad,
      };
    })();
    api
      .get<DriverReportMap[]>(
        `/reports?minLat=${bbox.minLat}&maxLat=${bbox.maxLat}&minLng=${bbox.minLng}&maxLng=${bbox.maxLng}&sinceMinutes=5`,
      )
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]));
  }, [
    routeData?.pickupCoords,
    routeData?.dropoffCoords,
    driverLocation?.lat,
    driverLocation?.lng,
    reportsRefreshTrigger,
  ]);

  useEffect(() => {
    if (!socket) return;
    const onReport = (data: unknown) => {
      const r = data as DriverReportMap;
      if (r?.id && typeof r.lat === 'number' && typeof r.lng === 'number') {
        setReports((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
      }
    };
    const onUserUpdated = () => {
      setDriversRefreshTrigger((n) => n + 1);
    };
    socket.on('report', onReport);
    socket.on('user.updated', onUserUpdated);
    return () => {
      socket.off('report', onReport);
      socket.off('user.updated', onUserUpdated);
    };
  }, [socket]);

  // Add driversRefreshTrigger to dependency array of load drivers effect
  useEffect(() => {
    if (!canAssign) return;
    const load = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      api
        .get<User[]>('/users')
        .then((data) => {
          setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
        })
        .catch(() => setDrivers([]));
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [canAssign, driversRefreshTrigger]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible')
        setReportTicks((n) => n + 1);
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  /** Reports visible on map: only from the last 5 minutes (then removed). */
  const reportsOnMap = useMemo(() => {
    const now = Date.now();
    const maxAgeMs = 5 * 60 * 1000;
    return reports.filter((r) => {
      const created = r.createdAt ? new Date(r.createdAt).getTime() : now;
      return now - created < maxAgeMs;
    });
  }, [reports, reportTicks]);

  const MOVE_AWAY_METERS = 80;
  useEffect(() => {
    if (!isDriver || !driverLocation || !routeData?.pickupCoords || !selectedOrderId) return;
    const sentId = autoStopSentForOrderIdRef.current;
    if (sentId && orders.some((o) => o.id === sentId && o.leftPickupAt)) {
      autoStopSentForOrderIdRef.current = null;
    }
    const order = orders.find(
      (o) =>
        o.id === selectedOrderId &&
        o.status === 'ASSIGNED' &&
        o.arrivedAtPickupAt &&
        !o.leftPickupAt,
    );
    if (!order) return;
    const dist = distanceMeters(
      driverLocation.lat,
      driverLocation.lng,
      routeData.pickupCoords.lat,
      routeData.pickupCoords.lng,
    );
    if (dist > MOVE_AWAY_METERS && autoStopSentForOrderIdRef.current !== order.id) {
      autoStopSentForOrderIdRef.current = order.id;
      handleStatusChange(order.id, 'IN_PROGRESS', true);
    }
  }, [isDriver, orders, driverLocation, routeData?.pickupCoords, selectedOrderId]);

  function loadDriverEtasForOrder(orderId: string) {
    if (driverEtas[orderId]) return;
    api
      .get<{ drivers: DriverEta[] }>(`/orders/${orderId}/driver-etas`)
      .then((data) => {
        setDriverEtas((prev) => ({ ...prev, [orderId]: { drivers: data.drivers || [] } }));
      })
      .catch(() => {});
  }

  function driverMatchesSearch(d: User, q: string): boolean {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    const did = ((d as { driverId?: string | null }).driverId ?? '').toLowerCase();
    const cid = (d.carId ?? '').toLowerCase();
    const phone = (d.phone ?? '').toLowerCase();
    const nick = (d.nickname ?? '').toLowerCase();
    const id = (d.id ?? '').toLowerCase();
    const email = ((d as { email?: string | null }).email ?? '').toLowerCase();
    return (
      did.includes(s) ||
      cid.includes(s) ||
      phone.includes(s) ||
      nick.includes(s) ||
      id.includes(s) ||
      email.includes(s)
    );
  }

  function _findDriverByIdOrPhone(value: string): User | null {
    const v = value.trim();
    if (!v) return null;
    const list = drivers.filter((d) => {
      const did = (d as { driverId?: string | null }).driverId ?? '';
      const cid = d.carId ?? '';
      const phone = d.phone ?? '';
      return (
        did === v ||
        cid === v ||
        phone === v ||
        did.toLowerCase() === v.toLowerCase() ||
        cid.toLowerCase() === v.toLowerCase() ||
        phone.includes(v)
      );
    });
    return list.length === 1 ? list[0] : null;
  }

  // Live geo: driver location sent to server so dispatcher sees it. Uses watchPosition so updates
  // can continue when tab is in background (e.g. browser minimized on phone). Stops only when driver taps "Go offline".
  useEffect(() => {
    if (user?.role !== 'DRIVER' || !navigator.geolocation || user?.available === false) return;
    const hasActiveOrder = orders.some(
      (o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS',
    );
    const sendIntervalMs = hasActiveOrder ? 5000 : 10000; // throttle API: 5s on trip, 10s when free
    let lastSentTs = 0;
    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 8000,
    };
    const onPosition = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Use device heading (compass) when available so arrow rotates when phone rotates
      const heading = (pos.coords as GeolocationCoordinates & { heading?: number | null }).heading;
      if (typeof heading === 'number' && !Number.isNaN(heading)) {
        setDriverHeadingDegrees(heading);
      }
      updateDriverLocation(lat, lng);
      const now = Date.now();
      if (now - lastSentTs >= sendIntervalMs) {
        lastSentTs = now;
        api.patch('/users/me/location', { lat, lng }).catch(() => {});
      }
    };
    sendLocationOnceRef.current = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onPosition(pos);
          lastSentTs = Date.now();
          api
            .patch('/users/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude })
            .catch(() => {});
        },
        () => {},
        geoOptions,
      );
    };
    sendLocationOnceRef.current();
    const watchId = navigator.geolocation.watchPosition(onPosition, () => {}, geoOptions);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendLocationOnceRef.current?.();
      }
      // When tab is hidden we do nothing — watchPosition keeps running so location can still update
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      sendLocationOnceRef.current = null;
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id, user?.role, user?.available, orders.map((o) => o.status).join(',')]);

  // Compass/device orientation: rotate driver arrow when phone rotates (e.g. when stationary)
  useEffect(() => {
    if (user?.role !== 'DRIVER') return;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha != null && !Number.isNaN(e.alpha)) {
        // alpha: 0-360, 0 = North. Match map convention (0 = up/north).
        setDriverHeadingDegrees(e.alpha);
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [user?.role]);

  // Smooth driver arrow rotation: lerp display heading toward raw heading (0–360)
  useEffect(() => {
    if (user?.role !== 'DRIVER') return;
    const SMOOTH_FACTOR = 0.14;
    const MIN_DELTA = 0.2;
    const interval = setInterval(() => {
      const target = driverHeadingDegrees;
      if (target == null || !Number.isFinite(target)) {
        if (driverHeadingSmoothRef.current != null) {
          driverHeadingSmoothRef.current = null;
          driverHeadingLastRenderedRef.current = null;
          setDriverHeadingSmooth(null);
        }
        return;
      }
      const norm = (a: number) => ((a % 360) + 360) % 360;
      const targetNorm = norm(target);
      let current = driverHeadingSmoothRef.current;
      if (current == null || !Number.isFinite(current)) {
        driverHeadingSmoothRef.current = targetNorm;
        setDriverHeadingSmooth(targetNorm);
        return;
      }
      current = norm(current);
      let delta = targetNorm - current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      if (Math.abs(delta) < MIN_DELTA) return;
      const next = norm(current + delta * SMOOTH_FACTOR);
      driverHeadingSmoothRef.current = next;
      const lastRendered = driverHeadingLastRenderedRef.current;
      if (lastRendered == null || Math.abs(((next - lastRendered + 180) % 360) - 180) > 0.35) {
        driverHeadingLastRenderedRef.current = next;
        setDriverHeadingSmooth(next);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [user?.role, driverHeadingDegrees]);

  async function handleAssign(orderId: string, driverId: string) {
    if (!driverId) return;
    setAssigningId(orderId);
    try {
      await api.patch(`/orders/${orderId}/assign`, { driverId });
      toast.success(t('toast.driverAssigned'));
    } catch {
      toast.error(t('toast.assignFailed'));
    } finally {
      setAssigningId(null);
    }
  }

  /** Auto-assign: when enabled, assign unassigned orders to their suggested driver (from planning or order). */
  const handleAssignRef = useRef(handleAssign);
  handleAssignRef.current = handleAssign;
  const autoAssignedOrderIdsRef = useRef<Set<string>>(new Set());
  const prevPlanningRef = useRef<PlanningResult | null>(null);
  useEffect(() => {
    if (!autoAssignEnabled) {
      autoAssignedOrderIdsRef.current.clear();
      prevPlanningRef.current = null;
      return;
    }
    if (!canAssign) return;
    const toAssign: { orderId: string; driverId: string }[] = [];
    const planning = planningResult ?? null;
    if (planning?.orderRows?.length) {
      if (prevPlanningRef.current !== planning) {
        prevPlanningRef.current = planning;
        autoAssignedOrderIdsRef.current.clear();
      }
      for (const row of planning.orderRows) {
        if (!row.suggestedDriverId) continue;
        const order = orders.find((o) => o.id === row.orderId);
        if (
          !order ||
          order.driverId ||
          order.status === 'COMPLETED' ||
          order.status === 'CANCELLED'
        )
          continue;
        if (autoAssignedOrderIdsRef.current.has(row.orderId)) continue;
        toAssign.push({ orderId: row.orderId, driverId: row.suggestedDriverId });
      }
    } else {
      for (const o of orders) {
        if (
          o.driverId ||
          !o.suggestedDriverId ||
          o.status === 'COMPLETED' ||
          o.status === 'CANCELLED'
        )
          continue;
        if (autoAssignedOrderIdsRef.current.has(o.id)) continue;
        toAssign.push({ orderId: o.id, driverId: o.suggestedDriverId });
      }
    }
    toAssign.forEach(({ orderId, driverId }) => {
      autoAssignedOrderIdsRef.current.add(orderId);
      handleAssignRef.current(orderId, driverId);
    });
  }, [autoAssignEnabled, canAssign, planningResult, orders]);

  async function _handleDelayOrder(orderId: string, delayMinutes: number) {
    setDelayOrderingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/delay`, { delayMinutes });
      toast.success(t('dashboard.delayMinutes', { min: delayMinutes }));
    } catch {
      toast.error(t('toast.assignFailed'));
    } finally {
      setDelayOrderingId(null);
    }
  }

  async function _handleSetManual(orderId: string, manualAssignment: boolean) {
    setManualUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/manual`, { manualAssignment });
      toast.success(manualAssignment ? t('dashboard.markManual') : t('dashboard.unmarkManual'));
    } catch {
      toast.error(t('toast.assignFailed'));
    } finally {
      setManualUpdatingId(null);
    }
  }

  async function handleStatusChange(
    orderId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    silent = false,
  ) {
    setStatusUpdatingId(orderId);
    const order = orders.find((o) => o.id === orderId);
    // The API expects 'IN_PROGRESS' or 'COMPLETED' for the /status endpoint.
    // If status is 'CANCELLED', it implies a different API call or handling.
    // Assuming 'CANCELLED' is handled by a separate endpoint or logic,
    // or that the API endpoint for /status can also accept 'CANCELLED'.
    // For now, we'll cast to allow the assignment, assuming the backend handles it.
    const body: {
      status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
      distanceKm?: number;
      earningsCents?: number;
      routePolyline?: string;
    } = { status };
    if (status === 'COMPLETED') {
      const distanceKm =
        selectedOrderId === orderId && routeData
          ? selectedRouteIndex === 0
            ? (routeData.distanceKm ?? 0)
            : (routeData.alternativeRoutes?.[selectedRouteIndex - 1]?.distanceKm ?? 0)
          : (order?.distanceKm ?? 0);

      body.distanceKm = distanceKm;
      body.earningsCents = 0;
      if (selectedOrderId === orderId && routeData?.polyline) {
        body.routePolyline = routeData.polyline;
      }
    }
    try {
      await api.patch(`/orders/${orderId}/status`, body);
      if (!silent)
        toast.success(status === 'COMPLETED' ? t('toast.orderCompleted') : t('toast.rideStarted'));
      if (status === 'COMPLETED' && order && !silent) {
        const distanceKm = body.distanceKm ?? 0;
        const durationMinutes =
          selectedOrderId === orderId && routeData ? (routeData.durationMinutes ?? 0) : 0;
        const completedAt = new Date().toISOString();
        const tripDurationMin = order.leftPickupAt
          ? Math.round((Date.now() - new Date(order.leftPickupAt).getTime()) / 60_000)
          : durationMinutes;
        setPostTripSummary({
          pickupAddress: order.pickupAddress ?? '',
          dropoffAddress: order.dropoffAddress ?? '',
          distanceKm,
          durationMinutes: tripDurationMin || durationMinutes,
          earningsCents: body.earningsCents ?? 0,
          startedAt: order.startedAt ?? undefined,
          leftPickupAt: order.leftPickupAt ?? undefined,
          completedAt,
          arrivedAtPickupAt: order.arrivedAtPickupAt ?? undefined,
          pickupAt: order.pickupAt ?? '',
          waitChargeAtPickupCents: order.waitChargeAtPickupCents ?? undefined,
          waitChargeAtMiddleCents: order.waitChargeAtMiddleCents ?? undefined,
        });
        api
          .get<{ totalEarningsCents: number; totalMiles: number }>('/users/me/stats')
          .then((data) => {
            setDriverStats({
              totalEarningsCents: data.totalEarningsCents,
              totalMiles: data.totalMiles,
            });
          })
          .catch(() => {});
      }
      if (status === 'COMPLETED' || status === 'CANCELLED') {
        setManualTimerStart((prev) => {
          const next = { ...prev };
          delete next[orderId];
          delete next[`${orderId}_middle`];
          return next;
        });
      }
      if (status === 'IN_PROGRESS') {
        // Just in case they didn't stop it
        setManualTimerStart((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }
      if (silent || status === 'COMPLETED') {
        const data = await api.get<Order[]>('/orders');
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch {
      if (!silent) toast.error(t('toast.statusUpdateFailed'));
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleStopUnderway(orderId: string) {
    setStopUnderwayId(orderId);
    try {
      // Capture driver's current location when stopping
      const payload: { lat?: number; lng?: number; address?: string } = {};

      if (driverLocation) {
        payload.lat = driverLocation.lat;
        payload.lng = driverLocation.lng;

        // Try to get address from reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${driverLocation.lat}&lon=${driverLocation.lng}`,
          );
          const data = await response.json();
          if (data.display_name) {
            payload.address = data.display_name;
          }
        } catch {
          // Ignore geocoding errors
        }
      }

      await api.patch(`/orders/${orderId}/stop-underway`, payload);
      toast.success(t('dashboard.stoppedUnderway'));
      const data = await api.get<Order[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ??
        (e as { message?: string })?.message ??
        t('toast.statusUpdateFailed');
      toast.error(msg);
    } finally {
      setStopUnderwayId(null);
    }
  }

  function refetchRoute() {
    setRouteRefreshKey((k) => k + 1);
  }

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!driverLocation) return;
    setReportSubmitting(true);
    try {
      await api.post('/reports', {
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        type: reportType,
        description: reportDescription || undefined,
      });
      setReportSuccessParams({ type: reportType });
      // Auto-close modal and reset form
      setShowReportModal(false);
      setReportType('POLICE');
      setReportDescription('');
    } catch {
      toast.error(t('dashboard.reportFailed'));
    } finally {
      setReportSubmitting(false);
    }
  }

  function openInGoogleMaps() {
    if (!routeData?.pickupCoords || !routeData?.dropoffCoords) return;
    const origin = driverLocation
      ? `${driverLocation.lat},${driverLocation.lng}`
      : `${routeData.pickupCoords.lat},${routeData.pickupCoords.lng}`;
    const dest = `${routeData.dropoffCoords.lat},${routeData.dropoffCoords.lng}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`,
      '_blank',
    );
  }

  function openInWaze() {
    if (!routeData?.dropoffCoords) return;
    const dest = `${routeData.dropoffCoords.lat},${routeData.dropoffCoords.lng}`;
    window.open(`https://waze.com/ul?ll=${dest}&navigate=yes`, '_blank');
  }

  function openAddressInGoogleMaps(address: string) {
    if (!address?.trim()) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`,
      '_blank',
    );
  }

  function openAddressInWaze(address: string) {
    if (!address?.trim()) return;
    window.open(
      `https://waze.com/ul?q=${encodeURIComponent(address.trim())}&navigate=yes`,
      '_blank',
    );
  }

  async function handleSetDriverDestination(orderId: string) {
    if (!driverSetDestinationAddress.trim()) return;
    setDriverSetDestinationLoading(true);
    try {
      await api.patch(`/orders/${orderId}/destination`, {
        destination: driverSetDestinationAddress.trim(),
      });
      toast.success('Destination set');
      const data = await api.get<Order[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
      setDriverSetDestinationAddress('');
      // Force route refresh
      setRouteRefreshKey((k) => k + 1);
    } catch {
      toast.error('Failed to set destination');
    } finally {
      setDriverSetDestinationLoading(false);
    }
  }

  async function handleCompleteOrder(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // If dropoff address is missing, we MUST set it from current location before completing
    if (!order.dropoffAddress) {
      if (!driverLocation) {
        toast.error(t('dashboard.waitingForGps') || 'Waiting for GPS...');
        return;
      }

      setStatusUpdatingId(orderId); // Show loading on the button immediately
      try {
        // Reverse geocode
        let address = `${driverLocation.lat.toFixed(6)}, ${driverLocation.lng.toFixed(6)}`;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${driverLocation.lat}&lon=${driverLocation.lng}`,
          );
          const data = await response.json();
          if (data.display_name) {
            address = data.display_name;
          }
        } catch {
          // Fallback to coords string if reverse geo fails
        }

        // Update destination first
        await api.patch(`/orders/${orderId}/destination`, {
          destination: address,
        });

        // Then complete
        await handleStatusChange(orderId, 'COMPLETED');
      } catch (err) {
        toast.error(t('toast.statusUpdateFailed'));
        setStatusUpdatingId(null);
      }
      return;
    }

    // Normal completion
    if (isDriver && order.driverId === user?.id) {
      setConfirmEndTripOrderId(order.id);
    } else {
      handleStatusChange(order.id, 'COMPLETED');
    }
  }

  /** Open full route (pickup → dropoff) in Google Maps with traffic, ETA, tolls. Uses addresses. */
  function openFullRouteInGoogleMaps(order: Order) {
    const origin = order.pickupAddress.trim();
    const dest = order.dropoffAddress?.trim() || '';
    const from = driverLocation
      ? `origin=${driverLocation.lat},${driverLocation.lng}`
      : `origin=${encodeURIComponent(origin)}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&${from}&destination=${encodeURIComponent(dest)}&travelmode=driving`,
      '_blank',
    );
  }

  /** Open full route in Waze. Waze URL supports one destination; we use dropoff so driver can navigate to final. */
  function openFullRouteInWaze(order: Order) {
    const dest = order.dropoffAddress?.trim() || '';
    window.open(`https://waze.com/ul?q=${encodeURIComponent(dest)}&navigate=yes`, '_blank');
  }

  /** One-tap navigate: open Google Maps (traffic, ETA). Driver→pickup when ASSIGNED; full route pickup→dropoff when IN_PROGRESS. */
  function driverNavigateToCurrent(order: Order) {
    if (order.status === 'ASSIGNED') {
      const dest = order.pickupAddress.trim();
      if (driverLocation) {
        window.open(
          `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${encodeURIComponent(dest)}&travelmode=driving`,
          '_blank',
        );
      } else {
        openAddressInGoogleMaps(dest);
      }
    } else {
      openFullRouteInGoogleMaps(order);
    }
  }

  function driverNavigateToCurrentWaze(order: Order) {
    if (order.status === 'ASSIGNED') {
      openAddressInWaze(order.pickupAddress);
    } else {
      openFullRouteInWaze(order);
    }
  }

  function handleToggleAvailability() {
    if (availabilityUpdating) return;
    const next = user?.available === false;
    setAvailabilityUpdating(true);
    api
      .patch('/users/me/available', { available: next })
      .then(() => {
        setUser(user ? { ...user, available: next } : null);
        if (next && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              updateDriverLocation(lat, lng);
              api
                .patch('/users/me/location', { lat, lng })
                .then(() => toast.success(t('toast.youAreOnMap')))
                .catch(() => {});
            },
            () => toast.error(t('toast.locationRequiredForMap')),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
        } else if (next) {
          sendLocationOnceRef.current?.();
        }
      })
      .catch(() => toast.error(t('toast.statusUpdateFailed')))
      .finally(() => setAvailabilityUpdating(false));
  }

  async function handleDelete(orderId: string) {
    if (!canAssign) return;
    setDeleteConfirmOrderId(null);
    setDeletingId(orderId);
    try {
      await api.delete(`/orders/${orderId}`);
      if (selectedOrderId === orderId) setSelectedOrderId(null);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success(t('toast.orderDeleted'));
    } catch {
      toast.error(t('toast.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRejectOrder(orderId: string) {
    setRejectConfirmOrderId(null);
    setRejectingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/reject`, {});
      toast.info(t('toast.orderRejected'));
    } catch {
      toast.error(t('toast.rejectFailed'));
    } finally {
      setRejectingId(null);
    }
  }

  function _formatDuration(startedAt: string): string {
    const start = new Date(startedAt).getTime();
    const elapsed = Math.floor((now - start) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
  }

  async function setAddressFromCoords(lat: number, lng: number, which: 'pickup' | 'dropoff') {
    setReverseGeocodeLoading(true);
    try {
      const res = await api.get<{ address: string | null }>(`/geo/reverse?lat=${lat}&lng=${lng}`);
      const addr = res?.address ?? '';
      if (which === 'pickup') setPickupAddress(addr);
      else setDropoffAddress(addr);
      setPickPoint({ lat, lng });
    } catch {
      if (which === 'pickup') setPickupAddress('');
      else setDropoffAddress('');
    } finally {
      setReverseGeocodeLoading(false);
      setPickMode(null);
    }
  }

  function handleMapClick(lat: number, lng: number) {
    if (pickMode === 'pickup') setAddressFromCoords(lat, lng, 'pickup');
    else if (pickMode === 'dropoff') setAddressFromCoords(lat, lng, 'dropoff');
  }

  function _handleUseMyLocation(which: 'pickup' | 'dropoff') {
    if (!navigator.geolocation) return;
    setReverseGeocodeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => setAddressFromCoords(pos.coords.latitude, pos.coords.longitude, which),
      () => {
        setReverseGeocodeLoading(false);
        setPickMode(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    const isRoundtrip = tripTypeForm === 'ROUNDTRIP';
    if (!pickupAddress.trim()) {
      setSubmitError('Fill pickup address');
      return;
    }
    if (isRoundtrip && !middleAddress.trim()) {
      setSubmitError('Roundtrip requires a second location');
      return;
    }
    const pickupNorm = pickupAddress.trim().toLowerCase();
    const dropoffNorm = (dropoffAddress.trim() || '').toLowerCase();
    const activeStatuses = ['SCHEDULED', 'SEARCHING', 'ASSIGNED', 'AT_PICKUP', 'ON_TRIP'];
    const duplicateOrder = orders.some(
      (o) =>
        activeStatuses.includes(o.status) &&
        o.pickupAddress?.trim().toLowerCase() === pickupNorm &&
        (o.dropoffAddress?.trim() || '').toLowerCase() === dropoffNorm
    );
    if (duplicateOrder) {
      setSubmitError(t('toast.duplicateOrder'));
      toast.error(t('toast.duplicateOrder'));
      return;
    }
    let pickupAtIso: string | undefined;
    if (pickupAtForm.trim()) {
      const d = new Date(pickupAtForm.trim());
      if (Number.isNaN(d.getTime())) {
        setSubmitError(t('dashboard.invalidPickupDateTime'));
        return;
      }
      pickupAtIso = d.toISOString();
    }
    try {
      await api.post('/orders', {
        tripType: tripTypeForm,
        routeType: routeTypeForm,
        pickupAddress: pickupAddress.trim(),
        middleAddress: isRoundtrip ? middleAddress.trim() || undefined : undefined,
        waypoints: undefined,
        dropoffAddress: dropoffAddress.trim() || undefined,
        pickupType: pickupType || undefined,
        dropoffType: dropoffType || undefined,
        phone: orderPhone.trim() || undefined,
        passengerName: orderPassengerName.trim() || undefined,
        preferredCarType: preferredCarTypeForm.trim() || undefined,
        manualEntry,
        isAuto: isAutoOrder,
        dropoffImageUrl: dropoffImageUrl.trim() || undefined,
        amount: isAutoOrder ? 0 : undefined, // Explicit amount handling if needed
        ...(pickupAtIso ? { pickupAt: pickupAtIso } : {}),
      });
      const phoneVal = orderPhone.trim() || undefined;
      const pickupAddr = pickupAddress.trim();
      const dropoffAddr = dropoffAddress.trim();
      if (pickupAddr) {
        api.post('/addresses', { address: pickupAddr, type: 'pickup', phone: phoneVal }).catch(() => {});
      }
      if (dropoffAddr && dropoffAddr !== pickupAddr) {
        api.post('/addresses', { address: dropoffAddr, type: 'dropoff', phone: phoneVal }).catch(() => {});
      }
      setPickupAddress('');
      setMiddleAddress('');
      setDropoffAddress('');
      setPickupAtForm('');
      setOrderPhone('');
      setOrderPassengerName('');
      setPickupType('');
      setDropoffType('');
      setPreferredCarTypeForm('');
      setRouteTypeForm('LOCAL');
      setPickPoint(null);
      setManualEntry(false);
      setIsAutoOrder(false);
      setDropoffImageUrl('');
      setShowForm(false);
      toast.success(t('toast.orderCreated'));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create order');
      toast.error(t('toast.orderCreateFailed'));
    }
  }

  async function handleArrivedAtPickup(orderId: string) {
    setArrivingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/arrived-at-pickup`, {});
    } catch {
      // keep state
    } finally {
      setArrivingId(null);
    }
  }

  async function handleArrivedAtMiddle(orderId: string) {
    setArrivingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/arrived-at-middle`, {});
    } catch {
      // keep state
    } finally {
      setArrivingId(null);
    }
  }

  async function handleLeftMiddle(orderId: string) {
    setLeftMiddleId(orderId);
    try {
      await api.patch(`/orders/${orderId}/left-middle`, {});
    } catch {
      // keep state
    } finally {
      setLeftMiddleId(null);
    }
  }

  const _ordersTitle = effectiveIsDriver ? t('dashboard.myOrders') : t('dashboard.orders');
  void _findDriverByIdOrPhone; void _handleDelayOrder; void _handleSetManual; void _formatDuration; void _handleUseMyLocation; void _ordersTitle; void _setShowPlanPanel; void _setDriverAssignByIdInput;
  const emptyMessage = effectiveIsDriver ? t('dashboard.noMyOrders') : t('dashboard.noOrders');
  void [_findDriverByIdOrPhone, _handleDelayOrder, _handleSetManual, _formatDuration, _handleUseMyLocation, _ordersTitle, _setShowPlanPanel, _setDriverAssignByIdInput];
  /** Short address for driver: "Street, City" style (first 1–2 parts, max ~42 chars). */
  const shortAddress = (addr: string | null | undefined, maxLen = 42) => {
    if (!addr) return '';
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return addr.length <= maxLen ? addr : addr.slice(0, maxLen).trim() + '…';
    const short = [parts[0], parts[1]].join(', ');
    return short.length <= maxLen ? short : short.slice(0, maxLen).trim() + '…';
  };
  const assignedOrder = effectiveIsDriver
    ? orders.find((o) => o.status === 'ASSIGNED' && o.driverId === user?.id)
    : null;

  return (
    <div
      className={`dashboard-page ${effectiveIsDriver ? 'dashboard-page--driver' : ''} ${effectiveIsDriver && driverMapFullScreen ? 'dashboard-page--full-map' : ''}`}
    >
      {assignedOrder && (
        <div
          className="dashboard-assigned-popup"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="rd-panel" style={{ maxWidth: 420, width: '100%' }}>
            <h3>{t('dashboard.assignedPopupTitle')}</h3>
            <p className="rd-text-muted">
              {new Date(assignedOrder.pickupAt).toLocaleString()} — {assignedOrder.pickupAddress} →{' '}
              {assignedOrder.dropoffAddress || (
                <span style={{ color: '#ef4444' }}>Flexible Dropoff</span>
              )}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="rd-btn rd-btn-primary"
                disabled={!!statusUpdatingId}
                onClick={() => handleStatusChange(assignedOrder.id, 'IN_PROGRESS')}
              >
                {statusUpdatingId === assignedOrder.id ? '…' : t('dashboard.startRide')}
              </button>
              <button
                type="button"
                className="rd-btn rd-btn-danger"
                disabled={!!rejectingId}
                onClick={() => setRejectConfirmOrderId(assignedOrder.id)}
              >
                {rejectingId === assignedOrder.id ? '…' : t('dashboard.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {effectiveIsDriver && orderOffer && (
        <div
          className="dashboard-offer-popup"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="rd-panel"
            style={{ maxWidth: 400, width: '100%', padding: '1.25rem' }}
          >
            <h3 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem', color: 'var(--rd-accent-neon)' }}>
              New Order Offer
            </h3>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.75rem', color: offerCountdown < 5 ? 'var(--rd-color-critical)' : 'inherit' }}>
              {offerCountdown}s
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--rd-text-muted)', marginBottom: '0.5rem', textAlign: 'left' }}>
              <div><strong>Pickup:</strong> {shortAddress(orderOffer.pickupAddress)}</div>
              <div><strong>Dropoff:</strong> {shortAddress(orderOffer.dropoffAddress) || '—'}</div>
            </div>
            {offerRouteData && (
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'left', color: 'var(--rd-text)' }}>
                <span>ETA ~{Math.round(offerRouteData.driverToPickupMinutes ?? 0)} min to pickup</span>
                {' · '}
                <span>{(offerRouteData.distanceKm != null ? (offerRouteData.distanceKm / 1.60934).toFixed(1) : '0')} mi</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                type="button"
                className="rd-btn rd-btn-primary"
                onClick={() => handleAcceptOffer(orderOffer.id)}
                style={{ flex: 1 }}
              >
                Accept
              </button>
              <button
                type="button"
                className="rd-btn rd-btn-secondary"
                onClick={() => handleDeclineOffer(orderOffer.id)}
                style={{ flex: 1 }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`dashboard-page__top ${effectiveIsDriver ? 'dashboard-page__top--driver' : ''}`}>
        {!effectiveIsDriver && <h1>{t('dashboard.title')}</h1>}
        {effectiveIsDriver ? (
          <>
          <div className="dashboard-driver-status-top-center">
            <span className="dashboard-my-orders-panel__status-label">{t('dashboard.status')}</span>
            <span className={`rd-ws-pill ${connected ? 'connected' : ''}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              <span className="rd-ws-dot" />
              {connected ? t('status.connected') : reconnecting ? t('dashboard.reconnecting') : t('dashboard.driverStatusOffline')}
            </span>
            <button
              type="button"
              className={`rd-btn dashboard-status-btn rd-btn--small ${user?.available !== false ? 'dashboard-status-btn--offline' : 'dashboard-status-btn--online'}`}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.875rem' }}
              onClick={handleToggleAvailability}
              disabled={availabilityUpdating}
              aria-busy={availabilityUpdating}
            >
              <span className="dashboard-status-btn__icon" aria-hidden style={{ width: 18, height: 18 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              </span>
              <span className="dashboard-status-btn__label">
                {availabilityUpdating ? '…' : user?.available !== false ? t('dashboard.goOffline') : t('dashboard.startOnline')}
              </span>
            </button>
          </div>
          {currentDriverOrder && (
            <div className="driver-docked-actions driver-docked-actions--below-status">
          <div className="driver-docked-actions__header">
            <div>
              <div className="driver-docked-actions__title">
                {currentDriverOrder.status === 'ASSIGNED'
                  ? t('dashboard.navToPickup')
                  : t('dashboard.navToDropoff')}
              </div>
              {(currentDriverOrder.passenger?.name || currentDriverOrder.passenger?.phone) && (
                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                  {[currentDriverOrder.passenger?.name, currentDriverOrder.passenger?.phone]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
            {routeData &&
              (routeData.driverToPickupMinutes != null || routeData.durationMinutes != null) && (
                <div
                  style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--rd-accent-neon)' }}
                >
                  ~
                  {Math.round(
                    currentDriverOrder.status === 'ASSIGNED'
                      ? (routeData.driverToPickupMinutes ?? 0)
                      : (routeData.durationMinutes ?? 0),
                  )}{' '}
                  min
                </div>
              )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem', color: 'white' }}>
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              📍{' '}
              {currentDriverOrder.status === 'ASSIGNED'
                ? shortAddress(currentDriverOrder.pickupAddress)
                : shortAddress(currentDriverOrder.dropoffAddress)}
            </div>
          </div>
          {currentDriverOrder.status === 'ASSIGNED' &&
            currentDriverOrder.arrivedAtPickupAt &&
            !currentDriverOrder.leftPickupAt && (
              <div style={{ marginBottom: '0.5rem' }}>
                {currentDriverOrder.manualWaitMinutes != null ? (
                  <div className="wait-timer-badge" style={{ animation: 'none' }}>
                    <span>⏱ {currentDriverOrder.manualWaitMinutes} min</span>
                    <button type="button" className="rd-btn rd-btn--small" style={{ background: 'rgba(0,0,0,0.2)', border: 'none', marginLeft: '0.5rem' }} onClick={() => submitWaitInfoReset(currentDriverOrder.id)}>Reset</button>
                  </div>
                ) : manualTimerStart[currentDriverOrder.id] ? (
                  <div className="wait-timer-badge">
                    ⏱ {Math.floor((now - manualTimerStart[currentDriverOrder.id]) / 60000)}m {Math.floor(((now - manualTimerStart[currentDriverOrder.id]) % 60000) / 1000)}s
                    <button type="button" className="rd-btn rd-btn--small" style={{ background: 'rgba(0,0,0,0.2)', border: 'none', marginLeft: '0.5rem' }} onClick={() => setShowTimerNoteModal(currentDriverOrder.id)}>Stop</button>
                  </div>
                ) : (
                  <button type="button" className="rd-btn rd-btn-secondary" style={{ width: '100%', fontWeight: 700 }} onClick={() => handleStartTimer(currentDriverOrder.id)}>Start Wait Timer</button>
                )}
              </div>
            )}
          <div className="driver-docked-actions__grid">
            <button type="button" className="driver-docked-actions__btn" onClick={() => driverNavigateToCurrent(currentDriverOrder)}>
              <span style={{ fontSize: '1.25rem' }}>🗺️</span>
              {t('dashboard.navigationOnGoogle')}
            </button>
            <button type="button" className="driver-docked-actions__btn" onClick={() => driverNavigateToCurrentWaze(currentDriverOrder)}>
              <span style={{ fontSize: '1.25rem' }}>🚙</span>
              Waze
            </button>
            {currentDriverOrder.status === 'ASSIGNED' &&
              (currentDriverOrder.arrivedAtPickupAt ? (
                <button type="button" className="driver-docked-actions__btn driver-docked-actions__btn--primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(currentDriverOrder.id, 'IN_PROGRESS')}>
                  {statusUpdatingId === currentDriverOrder.id ? '…' : t('dashboard.startRide')}
                </button>
              ) : (
                <button type="button" className="driver-docked-actions__btn driver-docked-actions__btn--primary" style={{ background: 'var(--rd-accent-emerald)' }} disabled={!!arrivingId} onClick={() => handleArrivedAtPickup(currentDriverOrder.id)}>
                  {arrivingId === currentDriverOrder.id ? '…' : t('dashboard.arrivedAtPickup')}
                </button>
              ))}
            {currentDriverOrder.status === 'IN_PROGRESS' && (
              <>
                {currentDriverOrder.tripType === 'ROUNDTRIP' && !currentDriverOrder.arrivedAtMiddleAt && (
                  <button type="button" className="driver-docked-actions__btn driver-docked-actions__btn--primary" style={{ background: 'var(--rd-accent-neon)', color: '#0f172a' }} disabled={!!arrivingId} onClick={() => handleArrivedAtMiddle(currentDriverOrder.id)}>
                    {arrivingId === currentDriverOrder.id ? '…' : t('dashboard.arrivedAtSecondStop')}
                  </button>
                )}
                {currentDriverOrder.tripType === 'ROUNDTRIP' && currentDriverOrder.arrivedAtMiddleAt && !currentDriverOrder.leftMiddleAt && (
                  <>
                    <div style={{ gridColumn: 'span 2' }}>
                      {currentDriverOrder.manualWaitMiddleMinutes != null ? (
                        <div className="wait-timer-badge" style={{ animation: 'none', width: '100%', justifyContent: 'center' }}>
                          <span>⏱ {currentDriverOrder.manualWaitMiddleMinutes} min</span>
                          <button type="button" className="rd-btn rd-btn--small" style={{ background: 'rgba(0,0,0,0.2)', border: 'none', marginLeft: '0.5rem' }} onClick={() => submitWaitInfoReset(currentDriverOrder.id, 'middle')}>Reset</button>
                        </div>
                      ) : manualTimerStart[`${currentDriverOrder.id}_middle`] ? (
                        <div className="wait-timer-badge" style={{ width: '100%', justifyContent: 'center' }}>
                          ⏱ {Math.floor((now - manualTimerStart[`${currentDriverOrder.id}_middle`]) / 60000)}m {Math.floor(((now - manualTimerStart[`${currentDriverOrder.id}_middle`]) % 60000) / 1000)}s
                          <button type="button" className="rd-btn rd-btn--small" style={{ background: 'rgba(0,0,0,0.2)', border: 'none', marginLeft: '0.5rem' }} onClick={() => handleStopTimer(currentDriverOrder.id, 'middle')}>Stop</button>
                        </div>
                      ) : (
                        <button type="button" className="rd-btn rd-btn-secondary" style={{ width: '100%', fontWeight: 700, marginBottom: '0.5rem' }} onClick={() => handleStartTimer(currentDriverOrder.id, 'middle')}>Start Wait Timer</button>
                      )}
                    </div>
                    <button type="button" className="driver-docked-actions__btn driver-docked-actions__btn--primary" style={{ background: 'var(--rd-accent-emerald)', gridColumn: 'span 2' }} disabled={!!leftMiddleId} onClick={() => handleLeftMiddle(currentDriverOrder.id)}>
                      {leftMiddleId === currentDriverOrder.id ? '…' : t('dashboard.startToFinal')}
                    </button>
                  </>
                )}
                {(currentDriverOrder.tripType !== 'ROUNDTRIP' || currentDriverOrder.leftMiddleAt) && (
                  <button type="button" className="driver-docked-actions__btn driver-docked-actions__btn--primary" disabled={!!statusUpdatingId} onClick={() => setConfirmEndTripOrderId(currentDriverOrder.id)}>
                    {statusUpdatingId === currentDriverOrder.id ? '…' : t('dashboard.complete')}
                  </button>
                )}
                <button type="button" className="driver-docked-actions__btn driver-docked-actions__btn--ruby" style={{ gridColumn: currentDriverOrder.tripType === 'ROUNDTRIP' && !currentDriverOrder.leftMiddleAt ? 'span 2' : 'auto' }} disabled={!!stopUnderwayId || !!statusUpdatingId} onClick={() => handleStopUnderway(currentDriverOrder.id)}>
                  {t('dashboard.stopUnderway')}
                </button>
                <button type="button" className="driver-docked-actions__btn" onClick={() => setDriverMapFullScreen(false)}>
                  {t('dashboard.showList')}
                </button>
              </>
            )}
          </div>
          {currentDriverOrder.status !== 'IN_PROGRESS' && (
            <button type="button" className="rd-btn" style={{ width: '100%', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }} onClick={() => setDriverMapFullScreen(false)}>
              {t('dashboard.showList')}
            </button>
          )}
            </div>
          )}
        </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className={`rd-ws-pill ${connected ? 'connected' : ''}`}>
              <span className="rd-ws-dot" />
              {connected ? t('status.connected') : reconnecting ? t('dashboard.reconnecting') : 'Offline'}
            </span>
          </div>
        )}
      </div>
      {reconnecting && (
        <div className="dashboard-reconnecting" role="status" aria-live="polite">
          {t('dashboard.reconnecting')}
        </div>
      )}
      {effectiveIsDriver &&
        routeData &&
        (routeData.driverToPickupSteps?.length || routeData.steps?.length) &&
        (() => {
          const toPickup = orders.some((o) => o.id === selectedOrderId && o.status === 'ASSIGNED');
          const altRoutes = routeData.alternativeRoutes ?? [];
          const mainMin = toPickup
            ? (routeData.driverToPickupMinutes ?? 0)
            : (routeData.durationMinutes ?? 0);
          const mainDist = routeData.distanceKm ?? 0;
          const mainRoute =
            selectedRouteIndex === 0 || altRoutes.length === 0
              ? {
                  durationMinutes: mainMin,
                  distanceKm: mainDist,
                  trafficLevel: routeData.trafficLevel,
                  trafficDelayMinutes: routeData.trafficDelayMinutes,
                  hasTolls: routeData.hasTolls,
                  tollCount: routeData.tollCount,
                  summary: routeData.summary,
                }
              : null;
          const steps = toPickup ? (routeData.driverToPickupSteps ?? []) : (routeData.steps ?? []);
          const durationMin =
            altRoutes.length > 0 && selectedRouteIndex > 0 && altRoutes[selectedRouteIndex - 1]
              ? altRoutes[selectedRouteIndex - 1].durationMinutes
              : mainMin;
          const eta = new Date(Date.now() + durationMin * 60_000).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });
          const firstStep = steps[0];
          const firstInstr = firstStep?.instruction || (firstStep?.type === 11 ? t('dashboard.navHeadToDestination') : firstStep?.type === 10 ? t('dashboard.navArrive') : t('dashboard.navContinue'));
          const firstDistHint = firstStep ? formatDistanceHint(firstStep.distanceM) : '';
          const firstIcon = firstStep ? (STEP_TYPE_ICON[firstStep.type] ?? '↑') : '↑';
          return (
            <div style={{ marginBottom: '0.5rem' }}>
              {steps.length > 0 && (
                <div className="dashboard-nav-banner" role="region" aria-label={t('dashboard.routeInstructions')}>
                  <span className="dashboard-nav-banner__arrow" aria-hidden>{firstIcon}</span>
                  <div className="dashboard-nav-banner__content">
                    <div className="dashboard-nav-banner__instruction">{firstInstr}</div>
                    <div className="dashboard-nav-banner__detail">{firstDistHint}</div>
                  </div>
                </div>
              )}
              <NavBar
                steps={steps}
                durationMinutes={durationMin}
                phaseLabel={toPickup ? t('dashboard.navToPickup') : t('dashboard.navToDropoff')}
                eta={eta}
              />
              {steps.length > 0 && (
                <div
                  className="dashboard-route-instructions"
                  aria-label={t('dashboard.routeInstructions')}
                >
                  <div className="dashboard-route-instructions__title">
                    {t('dashboard.routeInstructions')}
                  </div>
                  <ul className="dashboard-route-instructions__list">
                    {steps.map((step, i) => {
                      const distStr = formatDistanceHint(step.distanceM);
                      const instr =
                        step.instruction ||
                        (step.type === 11
                          ? t('dashboard.navHeadToDestination')
                          : step.type === 10
                            ? t('dashboard.navArrive')
                            : t('dashboard.navContinue'));
                      const icon = STEP_TYPE_ICON[step.type] ?? '↑';
                      return (
                        <li key={i} className="dashboard-route-instructions__item">
                          <span className="dashboard-route-instructions__icon" aria-hidden>
                            {icon}
                          </span>
                          <span className="dashboard-route-instructions__text">
                            {t('dashboard.turnIn', { dist: distStr })}
                            {' · '}
                            {instr}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                  marginTop: '0.5rem',
                }}
              >
                <button type="button" className="rd-btn" onClick={refetchRoute}>
                  {t('dashboard.recheckEta')}
                </button>
                {altRoutes.length > 0 && (
                  <div
                    className="dashboard-route-options"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      width: '100%',
                      marginTop: '0.5rem',
                    }}
                  >
                    {[mainRoute, ...altRoutes].map((route, i) => {
                      const isSelected = selectedRouteIndex === i;
                      const trafficBadgeClass =
                        route?.trafficLevel === 'heavy'
                          ? 'rd-badge-critical'
                          : route?.trafficLevel === 'moderate'
                            ? 'rd-badge-warning'
                            : 'rd-badge-ok';
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`dashboard-route-option ${isSelected ? 'dashboard-route-option--selected' : ''}`}
                          onClick={() => setSelectedRouteIndex(i)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '0.75rem',
                            border: isSelected
                              ? '2px solid var(--color-primary)'
                              : '1px solid var(--color-border)',
                            borderRadius: '8px',
                            background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              width: '100%',
                              alignItems: 'center',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                              {i === 0
                                ? t('dashboard.routeMain')
                                : `${t('dashboard.routeAlt')} ${i}`}
                              {route?.summary && ` · ${route.summary}`}
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '1.1rem',
                                color: isSelected ? 'var(--color-primary)' : 'inherit',
                              }}
                            >
                              {route?.durationMinutes ?? mainMin} min
                              {route?.trafficDelayMinutes && route.trafficDelayMinutes > 0 && (
                                <span
                                  style={{
                                    fontSize: '0.85rem',
                                    color: 'var(--color-critical)',
                                    marginLeft: '0.25rem',
                                  }}
                                >
                                  +{route.trafficDelayMinutes}
                                </span>
                              )}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              alignItems: 'center',
                              fontSize: '0.85rem',
                            }}
                          >
                            <span className="rd-text-muted">
                              {route?.distanceKm ?? mainDist} km
                            </span>
                            {route?.trafficLevel && (
                              <span
                                className={`rd-badge ${trafficBadgeClass}`}
                                style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                              >
                                {route.trafficLevel} traffic
                              </span>
                            )}
                            {route?.hasTolls && (
                              <span
                                className="rd-badge"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.15rem 0.4rem',
                                  background: 'var(--color-warning-bg)',
                                  color: 'var(--color-warning)',
                                }}
                              >
                                🛣️ Toll road
                                {route.tollCount && route.tollCount > 1
                                  ? ` (${route.tollCount})`
                                  : ''}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  className="rd-btn"
                  onClick={() => setShowReportModal(true)}
                  disabled={!driverLocation}
                >
                  {t('dashboard.report')}
                </button>
                {(() => {
                  const sel = orders.find((o) => o.id === selectedOrderId);

                  // Flexible Dropoff: Driver can set destination if missing
                  if (
                    effectiveIsDriver &&
                    sel &&
                    !sel.dropoffAddress &&
                    (sel.status === 'ASSIGNED' || sel.status === 'IN_PROGRESS')
                  ) {
                    return (
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          width: '100%',
                          marginTop: '0.5rem',
                        }}
                      >
                        <input
                          className="rd-input"
                          placeholder={t('dashboard.enterDropoff') || 'Enter dropoff address'}
                          value={driverSetDestinationAddress}
                          onChange={(e) => setDriverSetDestinationAddress(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="rd-btn rd-btn-primary"
                          disabled={
                            driverSetDestinationLoading || !driverSetDestinationAddress.trim()
                          }
                          onClick={() => handleSetDriverDestination(sel.id)}
                        >
                          Set
                        </button>
                      </div>
                    );
                  }

                  if (sel && sel.pickupAddress) {
                    return (
                      <>
                        <button
                          type="button"
                          className="rd-btn"
                          title={t('dashboard.openRouteInGoogleMaps')}
                          onClick={() => openFullRouteInGoogleMaps(sel)}
                        >
                          {t('dashboard.openInGoogleMaps')}
                        </button>
                        <button
                          type="button"
                          className="rd-btn"
                          title={t('dashboard.openRouteInWaze')}
                          onClick={() => openFullRouteInWaze(sel)}
                        >
                          {t('dashboard.openInWaze')}
                        </button>
                        {effectiveIsDriver && sel.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            className="rd-btn rd-btn-primary"
                            onClick={() => handleCompleteOrder(sel.id)}
                          >
                            {t('dashboard.complete')}
                          </button>
                        )}
                      </>
                    );
                  }
                  if (routeData?.dropoffCoords) {
                    return (
                      <>
                        <button type="button" className="rd-btn" onClick={openInGoogleMaps}>
                          {t('dashboard.openInGoogleMaps')}
                        </button>
                        <button type="button" className="rd-btn" onClick={openInWaze}>
                          {t('dashboard.openInWaze')}
                        </button>
                        {effectiveIsDriver && sel && sel.status === 'IN_PROGRESS' && (
                          <button
                            type="button"
                            className="rd-btn rd-btn-primary"
                            onClick={() => handleCompleteOrder(sel.id)}
                          >
                            {t('dashboard.complete')}
                          </button>
                        )}
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          );
        })()}
      <div
        className={`dashboard-page__grid ${canCreateOrder ? 'dashboard-page__grid--with-create-order' : ''}`}
      >
        <div
          className="dashboard-page__map rd-map-container"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 320 }}
        >
          {!effectiveIsDriver &&
            selectedOrderId &&
            routeData &&
            (routeData.polyline || (routeData.alternativeRoutes?.length ?? 0) > 0) && (
              <div
                className="dashboard-route-selector"
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'var(--rd-bg-panel)',
                  borderBottom: '1px solid var(--rd-border)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <strong style={{ marginRight: '0.25rem' }}>{t('dashboard.chosenRoute')}:</strong>
                {[null, ...(routeData.alternativeRoutes ?? [])].map((alt, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`rd-btn ${selectedRouteIndex === i ? 'rd-btn-primary' : ''}`}
                    onClick={() => setSelectedRouteIndex(i)}
                  >
                    {i === 0 ? t('dashboard.routeMain') : `${t('dashboard.routeAlt')} ${i}`} (
                    {alt ? alt.durationMinutes : (routeData.durationMinutes ?? 0)} min)
                  </button>
                ))}
              </div>
            )}
          {!effectiveIsDriver && canAssign && selectedOrderId && (() => {
            const sel = orders.find((o) => o.id === selectedOrderId);
            if (!sel || sel.driverId || (sel.status !== 'SCHEDULED' && sel.status !== 'SEARCHING')) return null;
            const etas = driverEtas[selectedOrderId]?.drivers ?? [];
            const sortedEtas = [...etas].sort((a, b) => a.etaMinutesToPickup - b.etaMinutesToPickup);
            const assignSearch = (driverAssignSearch[selectedOrderId] ?? '').trim();
            const searchFilteredDrivers = assignSearch
              ? drivers.filter((d) => driverMatchesSearch(d as User, assignSearch))
              : [];
            return (
              <div
                className="dashboard-assign-panel"
                style={{
                  flexShrink: 0,
                  padding: '0.5rem 0.75rem',
                  background: 'var(--rd-bg-panel)',
                  borderBottom: '1px solid var(--rd-border)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{t('dashboard.assignDriver')} — {t('dashboard.bestSuggestions')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    className="rd-input"
                    placeholder={t('dashboard.searchDriverPlaceholder')}
                    value={driverAssignSearch[selectedOrderId] ?? ''}
                    onChange={(e) => setDriverAssignSearch((prev) => ({ ...prev, [selectedOrderId]: e.target.value }))}
                    style={{ minWidth: 180, maxWidth: 260 }}
                    aria-label={t('dashboard.searchDriverPlaceholder')}
                  />
                  {etas.length === 0 && (
                    <button
                      type="button"
                      className="rd-btn rd-btn--small"
                      onClick={() => loadDriverEtasForOrder(selectedOrderId)}
                    >
                      {t('dashboard.loadSuggestions')}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 160, overflowY: 'auto' }}>
                  {sortedEtas.slice(0, 8).map((d) => {
                    const dr = drivers.find((x) => x.id === d.id) as User | undefined;
                    return (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          padding: '0.25rem 0',
                          borderBottom: '1px solid var(--rd-border)',
                        }}
                      >
                        <span>
                          {dr?.nickname ?? d.nickname ?? d.id}
                          {(dr as any)?.driverId && ` (${(dr as any).driverId})`}
                          {' · '}
                          <strong>{d.etaMinutesToPickup} min</strong> {t('dashboard.toPickup')}
                          {' · '}
                          {d.etaMinutesPickupToDropoff} min trip
                        </span>
                        <button
                          type="button"
                          className="rd-btn rd-btn--small rd-btn-primary"
                          disabled={!!assigningId}
                          onClick={() => handleAssign(selectedOrderId, d.id)}
                        >
                          {assigningId === selectedOrderId ? '…' : t('dashboard.assign')}
                        </button>
                      </div>
                    );
                  })}
                  {assignSearch && searchFilteredDrivers.slice(0, 5).map((d) => (
                    <div
                      key={d.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.25rem 0',
                        borderBottom: '1px solid var(--rd-border)',
                      }}
                    >
                      <span>
                        {d.nickname ?? d.id}
                        {(d as any)?.driverId && ` (${(d as any).driverId})`}
                        {(d as any)?.email && ` · ${(d as any).email}`}
                      </span>
                      <button
                        type="button"
                        className="rd-btn rd-btn--small rd-btn-primary"
                        disabled={!!assigningId}
                        onClick={() => handleAssign(selectedOrderId, d.id)}
                      >
                        {assigningId === selectedOrderId ? '…' : t('dashboard.assign')}
                      </button>
                    </div>
                  ))}
                </div>
                {sortedEtas.length === 0 && !assignSearch && (
                  <p className="rd-text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
                    {t('dashboard.loadSuggestionsHint')}
                  </p>
                )}
              </div>
            );
          })()}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {/* Map style selector: for everyone, live per user (bottom right; driver: above report button) */}
            <div
              style={{
                position: 'absolute',
                bottom: effectiveIsDriver ? 68 : 12,
                right: 12,
                zIndex: 10,
              }}
            >
              <select
                value={mapStyle}
                onChange={(e) => {
                  const v = e.target.value as 'street' | 'satellite' | 'terrain' | 'dark';
                  setMapStyle(v);
                  try {
                    localStorage.setItem('rd_map_style', v);
                  } catch {}
                }}
                aria-label={t('dashboard.mapStyle')}
                title={t('dashboard.mapStyle')}
                className="rd-input"
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: 8,
                  background: 'white',
                  color: '#1e293b',
                  border: '1px solid rgba(0,0,0,0.15)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: '0.8rem',
                  minWidth: 100,
                }}
              >
                <option value="street">{t('dashboard.mapStyleStreet')}</option>
                <option value="satellite">{t('dashboard.mapStyleSatellite')}</option>
                <option value="terrain">{t('dashboard.mapStyleTerrain')}</option>
                <option value="dark">{t('dashboard.mapStyleDark')}</option>
              </select>
            </div>
            {effectiveIsDriver && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                disabled={!driverLocation}
                aria-label={t('dashboard.addReport')}
                title={t('dashboard.addReport')}
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  zIndex: 10,
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'white',
                  color: '#1e293b',
                  border: 'none',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                  cursor: driverLocation ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  opacity: driverLocation ? 1 : 0.6,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </button>
            )}
            <OrdersMap
              drivers={isDriver ? [] : driversForMap}
              showDriverMarkers={canAssign}
              routeData={routeData}
              currentUserLocation={isDriver ? driverLocation : undefined}
              driverMarkerStyle={undefined}
              currentUserSpeedMph={isDriver ? driverSpeedMph : undefined}
              currentUserStandingStartedAt={isDriver ? standingStartedAt : undefined}
              currentUserHeadingTo={isDriver ? (driverHeadingTo ?? undefined) : undefined}
              currentUserHeadingDegrees={isDriver ? (driverHeadingSmooth ?? driverHeadingDegrees) : undefined}
              driverView={effectiveIsDriver}
              onToggleFullscreen={effectiveIsDriver ? () => setDriverMapFullScreen((v) => !v) : undefined}
              mapExpanded={effectiveIsDriver ? driverMapFullScreen : undefined}
              onMapClick={canCreateOrder && showForm && pickMode ? handleMapClick : undefined}
              pickPoint={canCreateOrder && showForm ? pickPoint : undefined}
              navMode={isDriver && !!routeData && !!driverLocation}
              centerTrigger={mapCenterTrigger}
              reports={reportsOnMap}
              selectedRouteIndex={selectedRouteIndex}
              orderRiskLevel={
                selectedOrderId
                  ? (orders.find((x) => x.id === selectedOrderId)?.riskLevel ?? null)
                  : null
              }
              selectedOrderTooltip={selectedOrderTooltip}
              futureOrderPickups={
                canAssign
                  ? futureOrderCoords
                      .filter((f) => f.orderId !== selectedOrderId)
                      .map((f) => ({
                        orderId: f.orderId,
                        lat: f.pickupLat,
                        lng: f.pickupLng,
                        pickupAt: f.pickupAt,
                      }))
                  : []
              }
              problemZones={
                canAssign && showProblemZones && problemZones ? problemZones : undefined
              }
              zones={showZones ? zones : undefined}
              showZones={showZones}
              focusCenter={myLocationCenter}
              focusZoom={isDriver ? 15.5 : undefined}
              initialCenter={savedMapView?.center}
              initialZoom={savedMapView?.zoom}
              onMapViewChange={handleMapViewChange}
              myLocationLabel={isDriver ? t('dashboard.myLocation') : undefined}
              mapStyle={mapStyle}
              onMyLocation={
                isDriver
                  ? () => {
                      if (!navigator.geolocation) return;
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const lat = pos.coords.latitude;
                          const lng = pos.coords.longitude;
                          setMyLocationCenter({ lat, lng });
                          setMapCenterTrigger((t) => t + 1);
                        },
                        () => {},
                        { enableHighAccuracy: true, timeout: 10000 },
                      );
                    }
                  : undefined
              }
            />
            {/* Speedometer removed from map to avoid clutter. */}
            {/* Driver Trip Card moved to bottom panel */}
          </div>
          {effectiveIsDriver && currentDriverOrder && (
            <div
              className="dashboard-driver-status-bar"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 1rem',
                background: 'var(--rd-bg-panel, rgba(0,0,0,0.25))',
                borderTop: '1px solid var(--rd-border)',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className={`rd-btn rd-btn--small ${driverMapFullScreen ? 'rd-btn-primary' : ''}`}
                onClick={() => setDriverMapFullScreen((v) => !v)}
              >
                {driverMapFullScreen ? t('dashboard.showList') : t('dashboard.fullMap')}
              </button>
              {alerts.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--rd-text-muted)' }} role="status">
                  {t('dashboard.updatesCount', { count: alerts.length })}
                </div>
              )}
            </div>
          )}
        </div>
        {canCreateOrder && (
          <aside className="dashboard-page__create-order-panel" aria-label={t('dashboard.newOrderForm')}>
            {showForm ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('dashboard.newOrderForm')}</h3>
                  <button
                    type="button"
                    className="rd-btn rd-btn--small"
                    onClick={() => setShowForm(false)}
                    aria-label={t('dashboard.cancel')}
                  >
                    ▲
                  </button>
                </div>
                <form onSubmit={handleCreateOrder} className="dashboard-order-form">
                  <div className="dashboard-form-row">
                    <div className="rd-form-group" style={{ flex: 1 }}>
                      <label className="dashboard-form-label">Order Type</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className={`rd-btn ${!isAutoOrder ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                          onClick={() => setIsAutoOrder(false)}
                          style={{ flex: 1 }}
                        >
                          {t('dashboard.orderTypeManual')}
                        </button>
                        <button
                          type="button"
                          className={`rd-btn ${isAutoOrder ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                          onClick={() => setIsAutoOrder(true)}
                          style={{ flex: 1 }}
                        >
                          {t('dashboard.orderTypeAutoBroadcast')}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-form-row dashboard-form-row--two">
                    <div>
                      <label>{t('dashboard.tripType')}</label>
                      <select
                        className="rd-input"
                        value={tripTypeForm}
                        onChange={(e) => setTripTypeForm(e.target.value as 'ONE_WAY' | 'ROUNDTRIP')}
                      >
                        <option value="ONE_WAY">{t('dashboard.oneWay')}</option>
                        <option value="ROUNDTRIP">{t('dashboard.roundtrip')}</option>
                      </select>
                    </div>
                    <div>
                      <label>{t('dashboard.routeType')}</label>
                      <select
                        className="rd-input"
                        value={routeTypeForm}
                        onChange={(e) => setRouteTypeForm(e.target.value as 'LOCAL' | 'LONG')}
                      >
                        <option value="LOCAL">{t('dashboard.routeLocal')}</option>
                        <option value="LONG">{t('dashboard.routeLong')}</option>
                      </select>
                    </div>
                    <div>
                      <label>{t('dashboard.preferredCarType')}</label>
                      <select
                        className="rd-input"
                        value={preferredCarTypeForm}
                        onChange={(e) => setPreferredCarTypeForm(e.target.value)}
                      >
                        <option value="">{t('dashboard.preferredCarTypeNone')}</option>
                        <option value="SEDAN">{t('auth.carType_SEDAN')}</option>
                        <option value="MINIVAN">{t('auth.carType_MINIVAN')}</option>
                        <option value="SUV">{t('auth.carType_SUV')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="dashboard-form-section">
                    <label>{t('dashboard.pickupTimeOptional')}</label>
                    <input
                      type="datetime-local"
                      className="rd-input"
                      value={pickupAtForm}
                      onChange={(e) => setPickupAtForm(e.target.value)}
                      aria-describedby="pickup-time-desc"
                    />
                    <p id="pickup-time-desc" className="rd-text-muted dashboard-form-hint">
                      {t('dashboard.pickupTimePlaceholder')}
                    </p>
                  </div>
                  <div className="dashboard-form-address-section" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--rd-border)' }}>
                    <h3 className="rd-section-title" style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>
                      {t('dashboard.addressCategoryPickupDropoff')}
                    </h3>
                    <div className="dashboard-form-section">
                      <label>{tripTypeForm === 'ROUNDTRIP' ? t('dashboard.firstLocation') : t('dashboard.pickupAddress')}</label>
                      <div className="dashboard-address-row">
                        <input
                          type="text"
                          className="rd-input dashboard-address-input"
                          list="pickup-address-list"
                          value={pickupAddress}
                          onChange={(e) => setPickupAddress(e.target.value)}
                          placeholder={t('dashboard.addressPlaceholder')}
                          required
                        />
                        <datalist id="pickup-address-list">
                          {pickupAddress.length > 2 && pickupAddressSuggestions.map((addr) => <option key={addr} value={addr} />)}
                        </datalist>
                        <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => (m === 'pickup' ? null : 'pickup'))}>
                          {pickMode === 'pickup' ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                        </button>
                      </div>
                    </div>
                    {tripTypeForm === 'ROUNDTRIP' && (
                      <div className="dashboard-form-section">
                        <label>{t('dashboard.secondLocation')}</label>
                        <div className="dashboard-address-row">
                          <input type="text" className="rd-input dashboard-address-input" list="middle-address-list" value={middleAddress} onChange={(e) => setMiddleAddress(e.target.value)} placeholder={t('dashboard.addressPlaceholder')} />
                          <datalist id="middle-address-list">
                            {middleAddress.length > 2 && middleAddressSuggestions.map((addr) => <option key={addr} value={addr} />)}
                          </datalist>
                        </div>
                      </div>
                    )}
                    <div className="dashboard-form-section">
                      <label>{t('dashboard.dropoffAddress')}</label>
                      <div className="dashboard-address-row">
                        <input type="text" className="rd-input dashboard-address-input" list="dropoff-address-list" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder={t('dashboard.addressPlaceholder')} />
                        <datalist id="dropoff-address-list">
                          {dropoffAddress.length > 2 && dropoffAddressSuggestions.map((addr) => <option key={addr} value={addr} />)}
                        </datalist>
                        <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => (m === 'dropoff' ? null : 'dropoff'))}>
                          {pickMode === 'dropoff' ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                        </button>
                      </div>
                    </div>
                  </div>
                  {submitError && (
                    <p style={{ color: 'var(--rd-color-critical)', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>{submitError}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button type="submit" className="rd-btn rd-btn-primary">{t('dashboard.createOrder')}</button>
                    <button type="button" className="rd-btn" onClick={() => { setShowForm(false); setSubmitError(''); }}>{t('dashboard.cancel')}</button>
                  </div>
                </form>
              </>
            ) : (
              <button
                type="button"
                className="rd-btn rd-btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setPickupAtForm(getDefaultPickupAtForm()); setShowForm(true); }}
              >
                + {t('dashboard.newOrder')}
              </button>
            )}
          </aside>
        )}
        {effectiveIsDriver && !driverMapFullScreen && (
          <aside
            className="dashboard-page__sidebar dashboard-my-orders-panel rd-premium-panel"
            aria-label={t('dashboard.myOrders')}
          >
            <div className="rd-panel-header">
              <h2>{t('dashboard.myOrders')}</h2>
            </div>
            <div
              className="dashboard-order-tabs"
              style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
            >
              <button
                type="button"
                className={`rd-btn ${orderTab === 'active' ? 'rd-btn-primary' : ''}`}
                onClick={() => setOrderTab('active')}
              >
                {t('dashboard.tabActive')}
              </button>
              <button
                type="button"
                className={`rd-btn ${orderTab === 'completed' ? 'rd-btn-primary' : ''}`}
                onClick={() => setOrderTab('completed')}
              >
                {t('dashboard.tabMyCompleted')}
              </button>
              <button
                type="button"
                className="rd-btn rd-btn-secondary"
                onClick={refreshAll}
                disabled={loading || (orderTab === 'completed' && completedLoading)}
                title={t('dashboard.refreshAllTitle')}
              >
                {t('dashboard.refreshAll')}
              </button>
            </div>
            {filteredOrders.length === 0 ? (
              <div className="rd-text-muted" style={{ padding: '0.75rem 0', fontSize: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{emptyMessage}</p>
                <p style={{ margin: '0.35rem 0 0' }}>{t('dashboard.noMyOrdersHint')}</p>
              </div>
            ) : (
              <ul className="dashboard-my-orders-list-compact" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredOrders.map((o) => {
                  const isMine = o.driverId === user?.id;
                  const isTaken = !!o.driverId && !isMine;
                  const etaMin =
                    selectedOrderId === o.id && routeData?.durationMinutes != null
                      ? routeData.durationMinutes
                      : o.durationMinutes ?? null;
                  const mileageKm = o.distanceKm ?? null;
                  const mi = mileageKm != null ? (Number(mileageKm) / 1.60934).toFixed(1) : null;
                  return (
                    <li
                      key={o.id}
                      className="dashboard-my-orders-item dashboard-my-orders-item--compact"
                      role={isMine ? 'button' : undefined}
                      onClick={
                        isMine
                          ? () => {
                              setSelectedOrderId(o.id);
                              setMapCenterTrigger((n) => n + 1);
                            }
                          : undefined
                      }
                      onKeyDown={
                        isMine
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedOrderId(o.id);
                                setMapCenterTrigger((n) => n + 1);
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="dashboard-my-orders-item__row dashboard-my-orders-item__row--badge">
                        {isMine && (
                          <span className="rd-badge dashboard-my-orders-item__badge" style={{ fontSize: '0.65rem', background: 'var(--rd-accent-neon)', color: '#0f172a' }}>
                            {t('dashboard.assignedToYou')}
                          </span>
                        )}
                        {isTaken && (
                          <span className="rd-badge rd-badge-warning dashboard-my-orders-item__badge" style={{ fontSize: '0.65rem' }}>
                            {t('dashboard.taken')}
                          </span>
                        )}
                      </div>
                      <div className="dashboard-my-orders-item__row dashboard-my-orders-item__row--address" title={`${o.pickupAddress ?? ''} → ${o.dropoffAddress ?? ''}`}>
                        <span className="dashboard-my-orders-item__pickup">{shortAddress(o.pickupAddress, 28)}</span>
                        <span className="dashboard-my-orders-item__arrow"> → </span>
                        <span className="dashboard-my-orders-item__dropoff">{shortAddress(o.dropoffAddress, 28)}</span>
                      </div>
                      <div className="dashboard-my-orders-item__row dashboard-my-orders-item__row--meta">
                        {etaMin != null && <span>ETA ~{Math.round(etaMin)} min</span>}
                        {etaMin != null && mi != null && <span className="dashboard-my-orders-item__sep">·</span>}
                        {mi != null && <span>{mi} mi</span>}
                        {etaMin == null && mi == null && <span>—</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        )}
        {confirmEndTripOrderId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-end-trip-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div className="rd-panel" style={{ maxWidth: 360, width: '100%' }}>
              <h3 id="confirm-end-trip-title" style={{ margin: '0 0 0.5rem' }}>
                {t('dashboard.confirmEndTripTitle')}
              </h3>
              <p
                className="rd-text-muted"
                style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 600 }}
              >
                {t('dashboard.confirmEndTripTimer', { sec: confirmEndTripSecondsLeft })}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="rd-btn rd-btn-primary"
                  disabled={!!statusUpdatingId}
                  onClick={() => {
                    handleStatusChange(confirmEndTripOrderId, 'COMPLETED');
                    setConfirmEndTripOrderId(null);
                  }}
                >
                  {statusUpdatingId === confirmEndTripOrderId
                    ? '…'
                    : t('dashboard.confirmEndTripYes')}
                </button>
                <button
                  type="button"
                  className="rd-btn"
                  onClick={() => setConfirmEndTripOrderId(null)}
                >
                  {t('dashboard.confirmEndTripNo')}
                </button>
              </div>
            </div>
          </div>
        )}
        {deleteConfirmOrderId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-order-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setDeleteConfirmOrderId(null)}
            onKeyDown={(e) => e.key === 'Escape' && setDeleteConfirmOrderId(null)}
          >
            <div
              className="rd-panel"
              style={{ maxWidth: 360, width: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="confirm-delete-order-title" style={{ margin: '0 0 0.5rem' }}>
                {t('dashboard.confirmDeleteOrderTitle')}
              </h3>
              <p className="rd-text-muted" style={{ margin: '0 0 1rem' }}>
                {t('dashboard.confirmDeleteOrderMessage')}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="rd-btn rd-btn-danger"
                  disabled={!!deletingId}
                  onClick={() => deleteConfirmOrderId && handleDelete(deleteConfirmOrderId)}
                >
                  {deletingId === deleteConfirmOrderId ? '…' : t('common.delete')}
                </button>
                <button
                  type="button"
                  className="rd-btn"
                  onClick={() => setDeleteConfirmOrderId(null)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
        {rejectConfirmOrderId && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-reject-order-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setRejectConfirmOrderId(null)}
            onKeyDown={(e) => e.key === 'Escape' && setRejectConfirmOrderId(null)}
          >
            <div
              className="rd-panel"
              style={{ maxWidth: 360, width: '100%' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="confirm-reject-order-title" style={{ margin: '0 0 0.5rem' }}>
                {t('dashboard.confirmRejectOrderTitle')}
              </h3>
              <p className="rd-text-muted" style={{ margin: '0 0 1rem' }}>
                {t('dashboard.confirmRejectOrderMessage')}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="rd-btn rd-btn-danger"
                  disabled={!!rejectingId}
                  onClick={() => rejectConfirmOrderId && handleRejectOrder(rejectConfirmOrderId)}
                >
                  {rejectingId === rejectConfirmOrderId ? '…' : t('dashboard.confirmRejectButton')}
                </button>
                <button
                  type="button"
                  className="rd-btn"
                  onClick={() => setRejectConfirmOrderId(null)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showRouteSelection && (
        <RouteSelectionModal
          pickupAddress={pickupAddress}
          dropoffAddress={dropoffAddress}
          onSelect={(idx, route) => {
            setShowRouteSelection(false);
            // We could store the route here to save with order, but for now just showing it is enough as per Plan 1
            toast.success(
              `Selected Route ${idx + 1}: ${route.distanceKm.toFixed(1)}km, ${Math.round(route.durationMinutes)}min`,
            );
          }}
          onCancel={() => setShowRouteSelection(false)}
        />
      )}
      {driverTripsModalId && (
        <DriverTripsModal
          driverId={driverTripsModalId}
          driverName={drivers.find((d) => d.id === driverTripsModalId)?.nickname}
          onClose={() => setDriverTripsModalId(null)}
        />
      )}
      {selectedDriverDetail && (
        <div
          className="rd-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.driverInfoTitle')}
          tabIndex={0}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedDriverDetail(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedDriverDetail(null)}
        >
          <div
            className="rd-panel"
            style={{ maxWidth: 360, width: '90%', margin: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.75rem' }}>{t('dashboard.driverInfoTitle')}</h3>
            <div className="dashboard-stats-card" style={{ marginBottom: '0.75rem' }}>
              <div className="stat-row">
                <span>{t('auth.nickname')}</span>
                <span>{selectedDriverDetail.driver.nickname ?? '—'}</span>
              </div>
              <div className="stat-row">
                <span>{t('auth.phone')}</span>
                <span>{selectedDriverDetail.driver.phone ?? '—'}</span>
              </div>
              <div className="stat-row">
                <span>{t('drivers.driverId')}</span>
                <span>{(selectedDriverDetail.driver as User).driverId ?? '—'}</span>
              </div>
              <div className="stat-row">
                <span>{t('drivers.carId')}</span>
                <span>{(selectedDriverDetail.driver as User).carId ?? '—'}</span>
              </div>
              <div className="stat-row">
                <span>{t('auth.carType')}</span>
                <span>
                  {(selectedDriverDetail.driver as User).carType
                    ? t('auth.carType_' + (selectedDriverDetail.driver as User).carType)
                    : '—'}
                </span>
              </div>
              <div className="stat-row">
                <span>{t('auth.carPlateNumber')}</span>
                <span>{(selectedDriverDetail.driver as User).carPlateNumber ?? '—'}</span>
              </div>
              <div className="stat-row">
                <span>{t('dashboard.userId')}</span>
                <span className="rd-id-compact" title={selectedDriverDetail.driver.id}>
                  {shortId(selectedDriverDetail.driver.id)}
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '12px',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}
            >
              {selectedDriverDetail.driver.phone && (
                <a
                  href={`tel:${selectedDriverDetail.driver.phone}`}
                  className="rd-btn"
                  style={{
                    flex: 1,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#dcfce7',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  📞 Call
                </a>
              )}
              {selectedDriverDetail.driver.phone && (
                <button
                  type="button"
                  className="rd-btn"
                  style={{ flex: 1 }}
                  onClick={() => {
                    navigator.clipboard.writeText(selectedDriverDetail.driver.phone!);
                    toast.success(t('dashboard.phoneCopied') || 'Copied');
                  }}
                >
                  📋 Copy
                </button>
              )}
              <button
                type="button"
                className="rd-btn"
                style={{
                  flex: 1,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
                onClick={() => setDriverTripsModalId(selectedDriverDetail.driver.id)}
              >
                📜 History
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="rd-btn rd-btn-primary"
                onClick={() => {
                  handleAssign(selectedDriverDetail.orderId, selectedDriverDetail.driver.id);
                  setSelectedDriverDetail(null);
                }}
                disabled={!!assigningId}
              >
                {assigningId === selectedDriverDetail.orderId ? '…' : t('dashboard.assignDriver')}
              </button>
              <button
                type="button"
                className="rd-btn"
                onClick={() => setSelectedDriverDetail(null)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {postTripSummary && (
        <div
          className="rd-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.tripSummaryTitle')}
          tabIndex={0}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setPostTripSummary(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPostTripSummary(null)}
        >
          <div
            className="rd-panel dashboard-trip-summary-modal"
            style={{ maxWidth: 440, width: '90%', margin: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '0.75rem' }}>{t('dashboard.tripSummaryTitle')}</h3>
            <p className="rd-text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              {postTripSummary.pickupAddress} → {postTripSummary.dropoffAddress}
            </p>
            <div className="dashboard-stats-card" style={{ marginBottom: '0.75rem' }}>
              {postTripSummary.durationMinutes > 0 && (
                <div className="stat-row">
                  <span>{t('dashboard.tripDuration')}</span>
                  <span>
                    <strong>{Math.round(postTripSummary.durationMinutes)} min</strong>
                  </span>
                </div>
              )}
              {postTripSummary.arrivedAtPickupAt && (
                <div className="stat-row">
                  <span>{t('dashboard.timeArrived')}</span>
                  <span>{new Date(postTripSummary.arrivedAtPickupAt).toLocaleString()}</span>
                </div>
              )}
              {postTripSummary.leftPickupAt && (
                <div className="stat-row">
                  <span>{t('dashboard.timePickedUp')}</span>
                  <span>{new Date(postTripSummary.leftPickupAt).toLocaleString()}</span>
                </div>
              )}
              <div className="stat-row">
                <span>{t('dashboard.timeDroppedOff')}</span>
                <span>{new Date(postTripSummary.completedAt).toLocaleString()}</span>
              </div>
              {(postTripSummary.waitChargeAtPickupCents ?? 0) > 0 && (
                <div className="stat-row">
                  <span>{t('dashboard.waitChargePickup')}</span>
                  <span>${(postTripSummary.waitChargeAtPickupCents! / 100).toFixed(0)}</span>
                </div>
              )}
              {(postTripSummary.waitChargeAtMiddleCents ?? 0) > 0 && (
                <div className="stat-row">
                  <span>{t('dashboard.waitChargeSecond')}</span>
                  <span>${(postTripSummary.waitChargeAtMiddleCents! / 100).toFixed(0)}</span>
                </div>
              )}
              <div className="stat-row">
                <span>{t('dashboard.distance')}</span>
                <span>{(postTripSummary.distanceKm / 1.60934).toFixed(1)} mi</span>
              </div>
              <div className="stat-row">
                <span>{t('dashboard.earnings')}</span>
                <span>${(postTripSummary.earningsCents / 100).toFixed(2)}</span>
              </div>
            </div>
            <button
              type="button"
              className="rd-btn rd-btn-primary"
              onClick={() => setPostTripSummary(null)}
            >
              {t('dashboard.done')}
            </button>
          </div>
        </div>
      )}
      {showReportModal && (
        <div
          className="rd-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.addReport')}
          tabIndex={0}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowReportModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowReportModal(false)}
        >
          <div
            className="rd-panel"
            style={{ maxWidth: 400, width: '90%', margin: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>{t('dashboard.addReport')}</h3>
              <button type="button" className="rd-btn" style={{ padding: '0.25rem 0.5rem' }} onClick={() => setShowReportModal(false)} aria-label={t('dashboard.cancel')}>✕</button>
            </div>
            <p className="rd-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
              {t('dashboard.reportAtLocation')}
            </p>
            <form onSubmit={handleReportSubmit}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>{t('dashboard.reportType')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                {(['POLICE', 'TRAFFIC', 'WORK_ZONE', 'CAR_CRASH', 'OTHER'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`rd-btn ${reportType === type ? 'rd-btn-primary' : ''}`}
                    style={{ flexDirection: 'column', alignItems: 'center', padding: '0.75rem 0.5rem', fontSize: '1.5rem' }}
                    onClick={() => setReportType(type)}
                    title={t(REPORT_TYPE_KEYS[type])}
                  >
                    <span style={{ display: 'block', marginBottom: '0.25rem' }}>{REPORT_EMOJI[type]}</span>
                    <span style={{ fontSize: '0.7rem' }}>{t(REPORT_TYPE_KEYS[type])}</span>
                  </button>
                ))}
              </div>
              <label>{t('dashboard.reportDescription')}</label>
              <input
                type="text"
                className="rd-input"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder={t('dashboard.reportDescriptionOptional')}
                style={{ marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="rd-btn rd-btn-primary" disabled={reportSubmitting}>
                  {reportSubmitting ? '…' : t('dashboard.submit')}
                </button>
                <button type="button" className="rd-btn" onClick={() => setShowReportModal(false)}>
                  {t('dashboard.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {reportSuccessParams && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            color: 'black',
            padding: '16px 24px',
            borderRadius: '50px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
            maxWidth: '90vw',
            width: 'auto',
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#22c55e',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            {REPORT_EMOJI[reportSuccessParams.type] || '⚠️'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: '16px', lineHeight: '1.2' }}>
              {t('dashboard.reportSubmitted')}
            </span>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              {t('dashboard.reportOthersSeeOnMap')}
            </span>
          </div>
        </div>
      )}
      {showTimerNoteModal && (
        <div
          className="rd-modal-overlay"
          role="dialog"
          aria-modal="true"
          tabIndex={0}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="rd-panel" style={{ maxWidth: 360, width: '90%', margin: 16 }}>
            <h3 style={{ marginBottom: '1rem' }}>Stop Timer & Add Note</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Wait Notes (Optional)
            </label>
            <input
              type="text"
              className="rd-input"
              value={timerNoteVal}
              onChange={(e) => setTimerNoteVal(e.target.value)}
              placeholder="e.g. Passenger was late"
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="rd-btn rd-btn-primary" onClick={submitWaitInfo}>
                Save & Stop
              </button>
              <button type="button" className="rd-btn" onClick={() => setShowTimerNoteModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
