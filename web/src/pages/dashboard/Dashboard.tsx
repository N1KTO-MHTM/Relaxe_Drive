import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../../ws/useSocket';
import { useAuthStore } from '../../store/auth';
import { api } from '../../api/client';
import OrdersMap from '../../components/OrdersMap';
import type { OrderRouteData, DriverForMap, DriverReportMap } from '../../components/OrdersMap';
import NavBar, { formatDistanceHint, STEP_TYPE_ICON } from '../../components/NavBar';
import { useToastStore } from '../../store/toast';
import { downloadCsv } from '../../utils/exportCsv';
import { shortId } from '../../utils/shortId';
import type { Order, DriverEta, PlanningResult } from '../../types';
import './Dashboard.css';

/** Wait billing: first 5 min free. 20 min = $5, 30 = $10, 1h = $20, 1h20 = $25, 1h30 = $30, 2h = $40. */
function getWaitChargeDollars(totalMinutes: number): number {
  if (totalMinutes < 20) return 0;
  if (totalMinutes < 30) return 5;
  if (totalMinutes < 60) return 10;
  if (totalMinutes < 80) return 20;
  if (totalMinutes < 90) return 25;
  if (totalMinutes < 120) return 30;
  return 40;
}
function getTotalWaitMinutes(arrivedAt: string, leftAt: string | null): number {
  const arrived = new Date(arrivedAt).getTime();
  const end = leftAt ? new Date(leftAt).getTime() : Date.now();
  return Math.floor((end - arrived) / 60_000);
}

/** Ordered list of stop addresses for an order (from waypoints or single middleAddress). Always use this for display/links so data is from current order. */
function getOrderStops(order: Order): { address: string }[] {
  if (order.waypoints && order.waypoints.length > 0) return order.waypoints;
  if (order.middleAddress?.trim()) return [{ address: order.middleAddress.trim() }];
  return [];
}

/** Distance in meters (approximate). */
function distanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
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
  driverId?: string | null;
}

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
  /** Multiple stops (between pickup and dropoff). When non-empty, sent as waypoints; else roundtrip uses middleAddress. */
  const [waypointAddresses, setWaypointAddresses] = useState<string[]>([]);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [leftMiddleId, setLeftMiddleId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [delayOrderingId, setDelayOrderingId] = useState<string | null>(null);
  const [manualUpdatingId, setManualUpdatingId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [futureOrderCoords, setFutureOrderCoords] = useState<Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>>([]);
  const [problemZones, setProblemZones] = useState<{ late: { lat: number; lng: number }[]; cancelled: { lat: number; lng: number }[] } | null>(null);
  const [showProblemZones, setShowProblemZones] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [stopUnderwayId, setStopUnderwayId] = useState<string | null>(null);
  const [confirmEndTripOrderId, setConfirmEndTripOrderId] = useState<string | null>(null);
  const [confirmEndTripSecondsLeft, setConfirmEndTripSecondsLeft] = useState(60);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOrderId, setDeleteConfirmOrderId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sharingLocation, setSharingLocation] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<OrderRouteData | null>(null);
  const [driverEtas, setDriverEtas] = useState<Record<string, { drivers: DriverEta[] }>>({});
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverSpeedMph, setDriverSpeedMph] = useState<number | null>(null);
  const lastDriverLocationRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const [pickMode, setPickMode] = useState<'pickup' | 'dropoff' | `waypoint-${number}` | null>(null);
  const [pickPoint, setPickPoint] = useState<{ lat: number; lng: number } | null>(null);
  /** Optional scheduled pickup date/time (empty = use "now" on backend). Format: datetime-local value (YYYY-MM-DDTHH:mm). */
  const [pickupAtForm, setPickupAtForm] = useState('');
  const [pickupType, setPickupType] = useState('');
  const [dropoffType, setDropoffType] = useState('');
  const [preferredCarTypeForm, setPreferredCarTypeForm] = useState<string>('');
  const [reverseGeocodeLoading, setReverseGeocodeLoading] = useState(false);
  const [passengersSuggestions, setPassengersSuggestions] = useState<Array<{ id: string; phone?: string; name: string | null; pickupAddr: string | null; dropoffAddr: string | null; pickupType: string | null; dropoffType: string | null }>>([]);
  const [orderPhone, setOrderPhone] = useState('');
  const [orderPassengerName, setOrderPassengerName] = useState('');
  const [orderTab, setOrderTab] = useState<'active' | 'completed' | 'pickupDropoff'>('active');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSortBy, setOrderSortBy] = useState<'scheduled' | 'arrived' | 'pickedUp' | 'droppedOff'>('scheduled');
  const [findByIdQuery, setFindByIdQuery] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState<'all' | 'active' | 'busy' | 'offline'>('all');
  const [driverCarTypeFilter, setDriverCarTypeFilter] = useState<string>('');
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [mapCenterTrigger, setMapCenterTrigger] = useState(0);
  const [myLocationCenter, setMyLocationCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [alerts, setAlerts] = useState<Array<{ id: string; type: string; orderId?: string; driverId?: string; pickupAddress?: string; at: string }>>([]);
  const [reports, setReports] = useState<DriverReportMap[]>([]);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null);
  const [showPlanPanel, setShowPlanPanel] = useState(false);
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
  const [driverStats, setDriverStats] = useState<{ totalEarningsCents: number; totalMiles: number } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('TRAFFIC');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);
  const [reportsRefreshTrigger, setReportsRefreshTrigger] = useState(0);
  const [driverAssignSearch, setDriverAssignSearch] = useState<Record<string, string>>({});
  const [driverAssignByIdInput, setDriverAssignByIdInput] = useState<Record<string, string>>({});
  const [selectedDriverDetail, setSelectedDriverDetail] = useState<{ orderId: string; driver: User } | null>(null);
  const autoStopSentForOrderIdRef = useRef<string | null>(null);
  const [driverMapFullScreen, setDriverMapFullScreen] = useState(false);
  const DRIVER_MAP_ICON_KEY = 'relaxe_driver_map_icon';
  const [driverMapIcon, setDriverMapIcon] = useState<'car' | 'arrow'>(() => (localStorage.getItem(DRIVER_MAP_ICON_KEY) as 'car' | 'arrow') || 'car');

  const canCreateOrder = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const canAssign = canCreateOrder;
  const isDriver = user?.role === 'DRIVER';

  /** Driver's current trip (ASSIGNED or IN_PROGRESS) for Bolt-style card and auto-select */
  const currentDriverOrder = isDriver && user?.id
    ? orders.find((o) => (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS') && o.driverId === user.id)
    : null;

  /** Short "where driver is heading" for map marker popup */
  const driverHeadingTo = useMemo(() => {
    if (!currentDriverOrder) return null;
    const short = (s: string) => (s?.length > 28 ? s.slice(0, 25) + '…' : s) || '';
    if (currentDriverOrder.status === 'ASSIGNED') return `To pickup: ${short(currentDriverOrder.pickupAddress || '')}`;
    if (currentDriverOrder.status === 'IN_PROGRESS') return `To dropoff: ${short(currentDriverOrder.dropoffAddress || '')}`;
    return null;
  }, [currentDriverOrder?.id, currentDriverOrder?.status, currentDriverOrder?.pickupAddress, currentDriverOrder?.dropoffAddress]);

  // Auto-select driver's active order so map shows route immediately (Bolt-style)
  useEffect(() => {
    if (!isDriver || !user?.id || !currentDriverOrder) return;
    if (selectedOrderId !== currentDriverOrder.id) setSelectedOrderId(currentDriverOrder.id);
  }, [isDriver, user?.id, currentDriverOrder?.id, currentDriverOrder, selectedOrderId]);

  useEffect(() => {
    if (orderTab !== 'completed' && orderTab !== 'pickupDropoff') return;
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    setCompletedLoading(true);
    api.get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCompletedOrders(isDriver ? list.filter((o) => o.driverId === user?.id) : list);
      })
      .catch(() => setCompletedOrders([]))
      .finally(() => setCompletedLoading(false));
  }, [orderTab, isDriver, user?.id]);

  const filteredOrders = useMemo(() => {
    if (orderTab === 'pickupDropoff') return []; // pickupDropoff uses its own groups
    const list = orderTab === 'active' ? orders : completedOrders;
    let out = orderTab === 'active'
      ? list.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
      : list.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED');
    if (isDriver && orderTab === 'active') out = out.filter((o) => o.driverId === user?.id);
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
    const getSortTime = (o: Order) => {
      switch (orderSortBy) {
        case 'arrived': return o.arrivedAtPickupAt ? new Date(o.arrivedAtPickupAt).getTime() : new Date(o.pickupAt).getTime();
        case 'pickedUp': return o.leftPickupAt ? new Date(o.leftPickupAt).getTime() : new Date(o.pickupAt).getTime();
        case 'droppedOff': return o.completedAt ? new Date(o.completedAt).getTime() : new Date(o.pickupAt).getTime();
        default: return new Date(o.pickupAt).getTime();
      }
    };
    return out.sort((a, b) => getSortTime(b) - getSortTime(a));
  }, [orders, completedOrders, orderTab, orderStatusFilter, orderSortBy, findByIdQuery, isDriver, user?.id]);

  /** For Pick up / Drop off tab: orders grouped by phase (to pickup, to dropoff, completed). */
  const pickupDropoffGroups = useMemo(() => {
    if (orderTab !== 'pickupDropoff') return null;
    const q = findByIdQuery.trim().toLowerCase();
    const filterById = (list: Order[]) => {
      let out = list;
      if (isDriver) out = out.filter((o) => o.driverId === user?.id);
      if (q) {
        out = out.filter((o) => {
          if ((o.id ?? '').toLowerCase().includes(q)) return true;
          if ((o.passengerId ?? '').toLowerCase().includes(q)) return true;
          if (o.passenger?.id && o.passenger.id.toLowerCase().includes(q)) return true;
          if (o.passenger?.phone && o.passenger.phone.toLowerCase().includes(q)) return true;
          return false;
        });
      }
      return out;
    };
    const getSortTime = (o: Order) => new Date(o.pickupAt).getTime();
    const toPickup = filterById(orders.filter((o) => o.status === 'SCHEDULED' || o.status === 'ASSIGNED')).sort((a, b) => getSortTime(b) - getSortTime(a));
    const toDropoff = filterById(orders.filter((o) => o.status === 'IN_PROGRESS')).sort((a, b) => getSortTime(b) - getSortTime(a));
    const completedSorted = filterById(completedOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED')).sort((a, b) => (b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.pickupAt).getTime()) - (a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.pickupAt).getTime()));
    return [
      { key: 'toPickup' as const, titleKey: 'dashboard.tabToPickup', orders: toPickup },
      { key: 'toDropoff' as const, titleKey: 'dashboard.tabToDropoff', orders: toDropoff },
      { key: 'completed' as const, titleKey: 'dashboard.tabCompleted', orders: completedSorted },
    ];
  }, [orderTab, orders, completedOrders, findByIdQuery, isDriver, user?.id]);

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
    return Array.from(set).sort();
  }, [passengersSuggestions, orders]);

  /** Drivers filtered by status (active/busy/offline) and car type for sidebar and map. */
  const filteredDrivers = useMemo(() => {
    let list = drivers;
    if (driverStatusFilter !== 'all') {
      list = list.filter((d) => {
        const hasLocation = d.lat != null && d.lng != null;
        const busy = orders.some((o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'));
        if (driverStatusFilter === 'active') return hasLocation && !busy;
        if (driverStatusFilter === 'busy') return busy;
        if (driverStatusFilter === 'offline') return !hasLocation;
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
          ((d as { driverId?: string | null }).driverId ?? '').toLowerCase().includes(q) ||
          (d.id ?? '').toLowerCase().includes(q)
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
    return driverList.map((d) => {
      const onTripOrder = orders.find((o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'));
      const onTrip = !!onTripOrder;
      const status: 'busy' | 'available' | 'offline' = onTrip ? 'busy' : (d.lat != null && d.lng != null ? 'available' : 'offline');
      const etaData = onTripOrder && driverEtas[onTripOrder.id]?.drivers?.find((x) => x.id === d.id);
      return {
        id: d.id,
        nickname: d.nickname,
        phone: d.phone,
        lat: d.lat,
        lng: d.lng,
        status,
        carType: (d as { carType?: string | null }).carType ?? null,
        carPlateNumber: (d as { carPlateNumber?: string | null }).carPlateNumber ?? null,
        driverId: (d as { driverId?: string | null }).driverId ?? null,
        statusLabel: status === 'busy' ? t('dashboard.onTrip') : (status === 'available' ? t('dashboard.available') : t('dashboard.offline')),
        etaMinutesToPickup: etaData?.etaMinutesToPickup,
        etaMinutesTotal: etaData?.etaMinutesTotal,
        etaMinutesPickupToDropoff: etaData?.etaMinutesPickupToDropoff,
        assignedOrderPickup: onTripOrder?.pickupAddress ?? null,
        assignedOrderDropoff: onTripOrder?.dropoffAddress ?? null,
        busyUntil: (() => {
          if (!onTripOrder) return null;
          if (onTripOrder.completedAt) return new Date(onTripOrder.completedAt).toISOString();
          const etaMin = etaData?.etaMinutesPickupToDropoff ?? etaData?.etaMinutesTotal ?? 30;
          if (onTripOrder.leftPickupAt) {
            return new Date(new Date(onTripOrder.leftPickupAt).getTime() + etaMin * 60_000).toISOString();
          }
          return new Date(new Date(onTripOrder.pickupAt).getTime() + (etaData?.etaMinutesTotal ?? etaMin) * 60_000).toISOString();
        })(),
      };
    });
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
    if (!user?.id || isDriver || !canAssign) return null;
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
  }, [user?.id, isDriver, canAssign]);

  const handleMapViewChange = useMemo(() => {
    if (!user?.id || isDriver || !canAssign) return undefined;
    return (center: [number, number], zoom: number) => {
      try {
        localStorage.setItem(`relaxdrive_map_${user.id}`, JSON.stringify({ center, zoom }));
      } catch {
        /* ignore */
      }
    };
  }, [user?.id, isDriver, canAssign]);

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

  const PLACE_TYPES = [
    { value: '', labelKey: 'dashboard.placeTypeNone' },
    { value: 'home', labelKey: 'dashboard.placeHome' },
    { value: 'synagogue', labelKey: 'dashboard.placeSynagogue' },
    { value: 'school', labelKey: 'dashboard.placeSchool' },
    { value: 'hospital', labelKey: 'dashboard.placeHospital' },
    { value: 'store', labelKey: 'dashboard.placeStore' },
    { value: 'office', labelKey: 'dashboard.placeOffice' },
    { value: 'other', labelKey: 'dashboard.placeOther' },
  ];
  const canChangeStatus = !!user?.role;

  function loadOrders() {
    setLoading(true);
    api.get<Order[]>('/orders').then((data) => {
      setOrders(Array.isArray(data) ? data : []);
    }).catch(() => {
      setOrders([]);
    }).finally(() => {
      setLoading(false);
    });
  }

  /** Refresh all data: orders, drivers, reports, route, and completed list if on that tab. */
  function refreshAll() {
    loadOrders();
    if (canAssign) {
      api.get<User[]>('/users').then((data) => {
        setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
      }).catch(() => {});
    }
    setReportsRefreshTrigger((prev) => prev + 1);
    setRouteRefreshKey((prev) => prev + 1);
    setMapCenterTrigger((prev) => prev + 1);
    if (orderTab === 'completed') {
      setCompletedLoading(true);
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      api.get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`)
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setCompletedOrders(isDriver ? list.filter((o) => o.driverId === user?.id) : list);
        })
        .catch(() => setCompletedOrders([]))
        .finally(() => setCompletedLoading(false));
    }
  }

  useEffect(() => {
    loadOrders();
  }, [showForm]);

  const refreshAllRef = useRef(refreshAll);
  refreshAllRef.current = refreshAll;

  /** Load all data everywhere when dashboard opens (and when user changes). */
  useEffect(() => {
    if (user) refreshAllRef.current();
  }, [user?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAllRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Dispatcher: poll drivers/list so map shows drivers who came back from minimized browser
  useEffect(() => {
    if (!canAssign || typeof document === 'undefined') return;
    const DRIVER_POLL_MS = 12000;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        api.get<User[]>('/users').then((data) => {
          setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
        }).catch(() => {});
      }
    }, DRIVER_POLL_MS);
    return () => clearInterval(t);
  }, [canAssign]);

  /** Trigger one immediate location send (so driver appears on map right after going online). */
  const sendLocationOnceRef = useRef<(() => void) | null>(null);

  function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dlat = (lat2 - lat1) * Math.PI / 180;
    const dlng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function updateDriverLocation(lat: number, lng: number) {
    const now = Date.now();
    const prev = lastDriverLocationRef.current;
    if (prev && now - prev.ts > 1000) {
      const distM = haversineM(prev.lat, prev.lng, lat, lng);
      const dtH = (now - prev.ts) / 3600000;
      if (dtH > 0) setDriverSpeedMph(Math.round((distM / 1609.34) / dtH * 10) / 10);
    }
    lastDriverLocationRef.current = { lat, lng, ts: now };
    setDriverLocation({ lat, lng });
  }

  useEffect(() => {
    if (user?.role !== 'DRIVER') return;
    let cancelled = false;
    api.get<{ totalEarningsCents: number; totalMiles: number }>('/users/me/stats').then((data) => {
      if (!cancelled) setDriverStats({ totalEarningsCents: data.totalEarningsCents, totalMiles: data.totalMiles });
    }).catch(() => {
      if (!cancelled) setDriverStats(null);
    });
    return () => { cancelled = true; };
  }, [user?.role]);

  useEffect(() => {
    const state = location.state as {
      createOrderDate?: string;
      focusOrderId?: string;
      openForm?: boolean;
      passengerPrefill?: { phone?: string; name?: string; pickupAddr?: string; dropoffAddr?: string; pickupType?: string; dropoffType?: string };
    } | null;
    const focusOrderId = state?.focusOrderId;
    if (focusOrderId && canCreateOrder) {
      setSelectedOrderId(focusOrderId);
      setFocusMode(true);
      setOrderTab('active');
      navigate(location.pathname, { replace: true, state: state && typeof state === 'object' ? { ...state, focusOrderId: undefined } : {} });
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
      if (fromUrl) { const p = new URLSearchParams(searchParams); p.delete('createOrderDate'); setSearchParams(p, { replace: true }); }
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
    return () => { socket.off('orders', onOrders); };
  }, [socket, user?.id, user?.role]);

  useEffect(() => {
    if (!socket || !canAssign) return;
    const onPlanning = (data: unknown) => setPlanningResult(data as PlanningResult);
    socket.on('planning.update', onPlanning);
    return () => { socket.off('planning.update', onPlanning); };
  }, [socket, canAssign]);

  useEffect(() => {
    if (!canAssign) return;
    api.get<PlanningResult>('/planning').then(setPlanningResult).catch(() => {});
  }, [canAssign]);

  useEffect(() => {
    if (!selectedOrderId) setFocusMode(false);
  }, [selectedOrderId]);

  useEffect(() => {
    if (!canAssign) return;
    api.get<Array<{ orderId: string; pickupAt: string; pickupLat: number; pickupLng: number }>>('/planning/order-coords').then(setFutureOrderCoords).catch(() => {});
  }, [canAssign]);

  useEffect(() => {
    if (!canAssign || !showProblemZones) return;
    api.get<{ late: { lat: number; lng: number }[]; cancelled: { lat: number; lng: number }[] }>('/planning/problem-zones').then(setProblemZones).catch(() => setProblemZones(null));
  }, [canAssign, showProblemZones]);

  useEffect(() => {
    if (!socket) return;
    const onAlert = (data: unknown) => {
      const d = data as { type?: string; orderId?: string; driverId?: string; pickupAddress?: string; pickupAt?: string; at?: string };
      if (d?.type) {
        setAlerts((prev) => [{ id: `${d.at ?? Date.now()}-${d.orderId ?? ''}-${d.type}`, type: d.type ?? 'unknown', orderId: d.orderId, driverId: d.driverId, pickupAddress: d.pickupAddress, pickupAt: d.pickupAt, at: d.at ?? '' }, ...prev.slice(0, 49)]);
      }
    };
    socket.on('alerts', onAlert);
    return () => { socket.off('alerts', onAlert); };
  }, [socket]);

  // Browser notifications: driver on assignment, dispatcher/admin on new order (only when tab in background)
  useEffect(() => {
    if (!socket || !user || typeof document === 'undefined' || !('Notification' in window)) return;
    const onAlert = (data: unknown) => {
      const d = data as { type?: string; orderId?: string; driverId?: string; pickupAddress?: string; pickupAt?: string };
      if (!d?.type || !document.hidden) return;
      const pickup = d.pickupAddress ?? '';
      if (user.role === 'DRIVER' && d.type === 'order.assigned' && d.driverId === user.id) {
        if (Notification.permission === 'granted') {
          new Notification(t('dashboard.alertOrderAssigned', { pickup }) || 'Order assigned', { body: pickup });
        }
      } else if ((user.role === 'ADMIN' || user.role === 'DISPATCHER') && d.type === 'order.created') {
        if (Notification.permission === 'granted') {
          new Notification(t('dashboard.alertOrderCreated', { pickup }) || 'New order', { body: pickup });
        }
      } else if (d.type === 'reminder_pickup_soon') {
        const forDriver = user.role === 'DRIVER' && d.driverId === user.id;
        const forDispatcher = user.role === 'ADMIN' || user.role === 'DISPATCHER';
        if ((forDriver || forDispatcher) && Notification.permission === 'granted') {
          new Notification(t('dashboard.alertReminderPickupTitle') || 'Pickup soon', { body: pickup || (d.pickupAt ? new Date(d.pickupAt).toLocaleTimeString() : '') });
        }
      }
    };
    socket.on('alerts', onAlert);
    return () => { socket.off('alerts', onAlert); };
  }, [socket, user?.id, user?.role, t]);

  // Request notification permission when dashboard is shown (once)
  useEffect(() => {
    if (!user || typeof document === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default' && (user.role === 'DRIVER' || user.role === 'ADMIN' || user.role === 'DISPATCHER')) {
      Notification.requestPermission().catch(() => {});
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!canAssign) return;
    const load = () => {
      api.get<User[]>('/users').then((data) => {
        setDrivers(Array.isArray(data) ? data.filter((u) => u.role === 'DRIVER') : []);
      }).catch(() => setDrivers([]));
    };
    load();
    const interval = setInterval(load, 6000); // refresh driver positions every 6s (less aggressive; visibility refresh below keeps map responsive)
    return () => clearInterval(interval);
  }, [canAssign]);

  useEffect(() => {
    const hasInProgress = orders.some((o) => o.status === 'IN_PROGRESS' && o.startedAt);
    const hasWaitTimer = orders.some((o) =>
      (o.status === 'ASSIGNED' && o.arrivedAtPickupAt && !o.leftPickupAt) ||
      (o.status === 'IN_PROGRESS' && o.arrivedAtMiddleAt && !o.leftMiddleAt)
    );
    if (!hasInProgress && !hasWaitTimer) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
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
    if (isDriver) {
      const active = orders.filter((o) => (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS') && o.driverId === user?.id);
      if (active.length === 0) {
        setSelectedOrderId(null);
        return;
      }
      const first = active.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())[0];
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
    const toSelect = (withDriver.length > 0 ? withDriver : active).sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())[0];
    setSelectedOrderId(toSelect?.id ?? null);
  }, [isDriver, canAssign, orders, user?.id]);

  // Load passengers for suggestions when create form is shown
  useEffect(() => {
    if (!canCreateOrder || !showForm) return;
    api.get<Array<{ id: string; phone?: string; name: string | null; pickupAddr: string | null; dropoffAddr: string | null; pickupType: string | null; dropoffType: string | null }>>('/passengers').then((data) => {
      setPassengersSuggestions(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [canCreateOrder, showForm]);

  // Preload driver ETAs when an order is selected (dispatcher) so dropdown shows ETA without extra click
  useEffect(() => {
    if (!selectedOrderId || !canAssign) return;
    if (driverEtas[selectedOrderId]) return;
    api.get<{ drivers: DriverEta[] }>(`/orders/${selectedOrderId}/driver-etas`).then((data) => {
      setDriverEtas((prev) => ({ ...prev, [selectedOrderId]: { drivers: data.drivers || [] } }));
    }).catch(() => {});
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
        api.get<{ drivers: DriverEta[] }>(`/orders/${id}/driver-etas`).then((data) => ({ id, drivers: data.drivers || [] }))
      )
    ).then((results) => {
      setDriverEtas((prev) => {
        const next = { ...prev };
        results.forEach(({ id, drivers }) => { next[id] = { drivers }; });
        return next;
      });
    }).catch(() => {});
  }, [canAssign, orders, driverEtas]);

  useEffect(() => {
    if (!selectedOrderId) {
      setRouteData(null);
      return;
    }
    let cancelled = false;
    const fetchRoute = (fromLat?: number, fromLng?: number) => {
      const params = new URLSearchParams();
      if (fromLat != null && fromLng != null) { params.set('fromLat', String(fromLat)); params.set('fromLng', String(fromLng)); }
      if (isDriver) params.set('alternatives', '1');
      const q = params.toString() ? `?${params.toString()}` : '';
      api.get<OrderRouteData>(`/orders/${selectedOrderId}/route${q}`).then((data) => {
        if (!cancelled) { setRouteData(data); setSelectedRouteIndex(0); }
      }).catch(() => {
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
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } else {
        fetchRoute();
      }
    } else {
      fetchRoute();
    }
    return () => { cancelled = true; };
  }, [selectedOrderId, isDriver, driverLocation?.lat, driverLocation?.lng, routeRefreshKey]);

  useEffect(() => {
    const bbox = (() => {
      if (routeData?.pickupCoords && routeData?.dropoffCoords) {
        const lats = [routeData.pickupCoords.lat, routeData.dropoffCoords.lat];
        const lngs = [routeData.pickupCoords.lng, routeData.dropoffCoords.lng];
        if (driverLocation) { lats.push(driverLocation.lat); lngs.push(driverLocation.lng); }
        const pad = 0.25;
        return { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad };
      }
      if (driverLocation) {
        const pad = 0.3;
        return { minLat: driverLocation.lat - pad, maxLat: driverLocation.lat + pad, minLng: driverLocation.lng - pad, maxLng: driverLocation.lng + pad };
      }
      const pad = 2;
      return { minLat: 41.1112 - pad, maxLat: 41.1112 + pad, minLng: -74.0438 - pad, maxLng: -74.0438 + pad };
    })();
    api.get<DriverReportMap[]>(`/reports?minLat=${bbox.minLat}&maxLat=${bbox.maxLat}&minLng=${bbox.minLng}&maxLng=${bbox.maxLng}&sinceMinutes=120`)
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]));
  }, [routeData?.pickupCoords, routeData?.dropoffCoords, driverLocation?.lat, driverLocation?.lng, reportsRefreshTrigger]);

  useEffect(() => {
    if (!socket) return;
    const onReport = (data: unknown) => {
      const r = data as DriverReportMap;
      if (r?.id && typeof r.lat === 'number' && typeof r.lng === 'number') {
        setReports((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
      }
    };
    socket.on('report', onReport);
    return () => { socket.off('report', onReport); };
  }, [socket]);

  const MOVE_AWAY_METERS = 80;
  useEffect(() => {
    if (!isDriver || !driverLocation || !routeData?.pickupCoords || !selectedOrderId) return;
    const sentId = autoStopSentForOrderIdRef.current;
    if (sentId && orders.some((o) => o.id === sentId && o.leftPickupAt)) {
      autoStopSentForOrderIdRef.current = null;
    }
    const order = orders.find(
      (o) => o.id === selectedOrderId && o.status === 'ASSIGNED' && o.arrivedAtPickupAt && !o.leftPickupAt,
    );
    if (!order) return;
    const dist = distanceMeters(
      driverLocation.lat, driverLocation.lng,
      routeData.pickupCoords.lat, routeData.pickupCoords.lng,
    );
    if (dist > MOVE_AWAY_METERS && autoStopSentForOrderIdRef.current !== order.id) {
      autoStopSentForOrderIdRef.current = order.id;
      handleStatusChange(order.id, 'IN_PROGRESS', true);
    }
  }, [isDriver, orders, driverLocation, routeData?.pickupCoords, selectedOrderId]);

  function loadDriverEtasForOrder(orderId: string) {
    if (driverEtas[orderId]) return;
    api.get<{ drivers: DriverEta[] }>(`/orders/${orderId}/driver-etas`).then((data) => {
      setDriverEtas((prev) => ({ ...prev, [orderId]: { drivers: data.drivers || [] } }));
    }).catch(() => {});
  }

  function driverMatchesSearch(d: User, q: string): boolean {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    const did = ((d as { driverId?: string | null }).driverId ?? '').toLowerCase();
    const phone = (d.phone ?? '').toLowerCase();
    const nick = (d.nickname ?? '').toLowerCase();
    const id = (d.id ?? '').toLowerCase();
    return did.includes(s) || phone.includes(s) || nick.includes(s) || id.includes(s);
  }

  function findDriverByIdOrPhone(value: string): User | null {
    const v = value.trim();
    if (!v) return null;
    const list = drivers.filter((d) => {
      const did = (d as { driverId?: string | null }).driverId ?? '';
      const phone = d.phone ?? '';
      return did === v || phone === v || did.toLowerCase() === v.toLowerCase() || phone.includes(v);
    });
    return list.length === 1 ? list[0] : null;
  }

  // Live geo: driver location sent to server so dispatcher sees it. Uses watchPosition so updates
  // can continue when tab is in background (e.g. browser minimized on phone). Stops only when driver taps "Go offline".
  useEffect(() => {
    if (user?.role !== 'DRIVER' || !navigator.geolocation || user?.available === false) return;
    const hasActiveOrder = orders.some((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
    const sendIntervalMs = hasActiveOrder ? 5000 : 10000; // throttle API: 5s on trip, 10s when free
    let lastSentTs = 0;
    const geoOptions: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 8000 };
    const onPosition = (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
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
          api.patch('/users/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude }).catch(() => {});
        },
        () => {},
        geoOptions
      );
    };
    sendLocationOnceRef.current();
    const watchId = navigator.geolocation.watchPosition(onPosition, () => {}, geoOptions);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendLocationOnceRef.current?.();
        api.patch('/users/me/available', { available: true }).catch(() => {});
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
        if (!order || order.driverId || order.status === 'COMPLETED' || order.status === 'CANCELLED') continue;
        if (autoAssignedOrderIdsRef.current.has(row.orderId)) continue;
        toAssign.push({ orderId: row.orderId, driverId: row.suggestedDriverId });
      }
    } else {
      for (const o of orders) {
        if (o.driverId || !o.suggestedDriverId || o.status === 'COMPLETED' || o.status === 'CANCELLED') continue;
        if (autoAssignedOrderIdsRef.current.has(o.id)) continue;
        toAssign.push({ orderId: o.id, driverId: o.suggestedDriverId });
      }
    }
    toAssign.forEach(({ orderId, driverId }) => {
      autoAssignedOrderIdsRef.current.add(orderId);
      handleAssignRef.current(orderId, driverId);
    });
  }, [autoAssignEnabled, canAssign, planningResult, orders]);

  async function handleDelayOrder(orderId: string, delayMinutes: number) {
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

  async function handleSetManual(orderId: string, manualAssignment: boolean) {
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

  async function handleStatusChange(orderId: string, status: 'IN_PROGRESS' | 'COMPLETED', silent = false) {
    setStatusUpdatingId(orderId);
    const order = orders.find((o) => o.id === orderId);
    const body: { status: 'IN_PROGRESS' | 'COMPLETED'; distanceKm?: number; earningsCents?: number } = { status };
    if (status === 'COMPLETED') {
      const distanceKm = selectedOrderId === orderId && routeData
        ? (selectedRouteIndex === 0
          ? (routeData.distanceKm ?? 0)
          : (routeData.alternativeRoutes?.[selectedRouteIndex - 1]?.distanceKm ?? 0))
        : 0;
      body.distanceKm = distanceKm;
      body.earningsCents = 0;
    }
    try {
      await api.patch(`/orders/${orderId}/status`, body);
      if (!silent) toast.success(status === 'COMPLETED' ? t('toast.orderCompleted') : t('toast.rideStarted'));
      if (status === 'COMPLETED' && order && !silent) {
        const distanceKm = body.distanceKm ?? 0;
        const durationMinutes = selectedOrderId === orderId && routeData ? (routeData.durationMinutes ?? 0) : 0;
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
        api.get<{ totalEarningsCents: number; totalMiles: number }>('/users/me/stats').then((data) => {
          setDriverStats({ totalEarningsCents: data.totalEarningsCents, totalMiles: data.totalMiles });
        }).catch(() => {});
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
      await api.patch(`/orders/${orderId}/stop-underway`, {});
      toast.success(t('dashboard.stoppedUnderway'));
      const data = await api.get<Order[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        ?? (e as { message?: string })?.message
        ?? t('toast.statusUpdateFailed');
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
      await api.post('/reports', { lat: driverLocation.lat, lng: driverLocation.lng, type: reportType, description: reportDescription || undefined });
      toast.success(t('dashboard.reportSubmitted'));
      setShowReportModal(false);
      setReportDescription('');
    } catch {
      toast.error(t('dashboard.reportFailed'));
    } finally {
      setReportSubmitting(false);
    }
  }

  function openInGoogleMaps() {
    if (!routeData?.pickupCoords || !routeData?.dropoffCoords) return;
    const origin = driverLocation ? `${driverLocation.lat},${driverLocation.lng}` : `${routeData.pickupCoords.lat},${routeData.pickupCoords.lng}`;
    const dest = `${routeData.dropoffCoords.lat},${routeData.dropoffCoords.lng}`;
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, '_blank');
  }

  function openInWaze() {
    if (!routeData?.dropoffCoords) return;
    const dest = `${routeData.dropoffCoords.lat},${routeData.dropoffCoords.lng}`;
    window.open(`https://waze.com/ul?ll=${dest}&navigate=yes`, '_blank');
  }

  function openAddressInGoogleMaps(address: string) {
    if (!address?.trim()) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`, '_blank');
  }

  function openAddressInWaze(address: string) {
    if (!address?.trim()) return;
    window.open(`https://waze.com/ul?q=${encodeURIComponent(address.trim())}&navigate=yes`, '_blank');
  }

  /** Open full route (pickup → stops → dropoff) in Google Maps. Uses addresses so data is always current. */
  function openFullRouteInGoogleMaps(order: Order) {
    const origin = order.pickupAddress.trim();
    const dest = order.dropoffAddress.trim();
    const stops = getOrderStops(order);
    const waypointsParam = stops.length > 0
      ? '&waypoints=' + stops.map((s) => encodeURIComponent(s.address.trim())).join('|')
      : '';
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}${waypointsParam}`,
      '_blank',
    );
  }

  /** Open full route in Waze. Waze URL supports one destination; we use dropoff so driver can navigate to final. */
  function openFullRouteInWaze(order: Order) {
    const dest = order.dropoffAddress.trim();
    window.open(`https://waze.com/ul?q=${encodeURIComponent(dest)}&navigate=yes`, '_blank');
  }

  /** Bolt-style: one-tap navigate — driver→pickup when ASSIGNED, full route when IN_PROGRESS */
  function driverNavigateToCurrent(order: Order) {
    if (order.status === 'ASSIGNED') {
      const dest = order.pickupAddress.trim();
      if (driverLocation) {
        window.open(
          `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${encodeURIComponent(dest)}`,
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

  async function handleShareLocation() {
    if (!navigator.geolocation) return;
    setSharingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((ok, err) => {
        navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 10000 });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      await api.patch('/users/me/location', { lat, lng });
      updateDriverLocation(lat, lng);
    } catch {
      // ignore
    } finally {
      setSharingLocation(false);
    }
  }

  function handleToggleAvailability() {
    const next = user?.available === false;
    api.patch('/users/me/available', { available: next })
      .then(() => {
        setUser(user ? { ...user, available: next } : null);
        if (next && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              updateDriverLocation(lat, lng);
              api.patch('/users/me/location', { lat, lng })
                .then(() => toast.success(t('toast.youAreOnMap')))
                .catch(() => {});
            },
            () => toast.error(t('toast.locationRequiredForMap')),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        } else if (next) {
          sendLocationOnceRef.current?.();
        }
      })
      .catch(() => toast.error(t('toast.statusUpdateFailed')));
  }

  async function handleDelete(orderId: string) {
    if (!canAssign) return;
    setDeleteConfirmOrderId(null);
    setDeletingId(orderId);
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success(t('toast.orderDeleted'));
    } catch {
      toast.error(t('toast.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRejectOrder(orderId: string) {
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

  function formatDuration(startedAt: string): string {
    const start = new Date(startedAt).getTime();
    const elapsed = Math.floor((now - start) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
  }

  async function setAddressFromCoords(lat: number, lng: number, which: 'pickup' | 'dropoff' | { type: 'waypoint'; index: number }) {
    setReverseGeocodeLoading(true);
    try {
      const res = await api.get<{ address: string | null }>(`/geo/reverse?lat=${lat}&lng=${lng}`);
      const addr = res?.address ?? '';
      if (which === 'pickup') {
        setPickupAddress(addr);
      } else if (which === 'dropoff') {
        setDropoffAddress(addr);
      } else {
        setWaypointAddresses((prev) => {
          const n = [...prev];
          while (n.length <= which.index) n.push('');
          n[which.index] = addr;
          return n;
        });
      }
      setPickPoint({ lat, lng });
    } catch {
      if (which === 'pickup') setPickupAddress('');
      else if (which === 'dropoff') setDropoffAddress('');
      else setWaypointAddresses((prev) => { const n = [...prev]; n[which.index] = ''; return n; });
    } finally {
      setReverseGeocodeLoading(false);
      setPickMode(null);
    }
  }

  function handleMapClick(lat: number, lng: number) {
    if (pickMode === 'pickup') setAddressFromCoords(lat, lng, 'pickup');
    else if (pickMode === 'dropoff') setAddressFromCoords(lat, lng, 'dropoff');
    else if (pickMode?.startsWith('waypoint-')) {
      const idx = parseInt(pickMode.replace('waypoint-', ''), 10);
      if (!Number.isNaN(idx)) setAddressFromCoords(lat, lng, { type: 'waypoint', index: idx });
    }
  }

  function handleUseMyLocation(which: 'pickup' | 'dropoff') {
    if (!navigator.geolocation) return;
    setReverseGeocodeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => setAddressFromCoords(pos.coords.latitude, pos.coords.longitude, which),
      () => {
        setReverseGeocodeLoading(false);
        setPickMode(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    const isRoundtrip = tripTypeForm === 'ROUNDTRIP';
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setSubmitError('Fill pickup and dropoff addresses');
      return;
    }
    const stopsList = waypointAddresses.map((a) => a.trim()).filter(Boolean);
    if (isRoundtrip && !middleAddress.trim() && stopsList.length === 0) {
      setSubmitError('Roundtrip requires at least one stop (second location or waypoints)');
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
      const waypointsPayload = stopsList.length > 0 ? stopsList.map((address) => ({ address })) : undefined;
      await api.post('/orders', {
        tripType: tripTypeForm,
        routeType: routeTypeForm,
        pickupAddress: pickupAddress.trim(),
        middleAddress: isRoundtrip && !waypointsPayload ? middleAddress.trim() || undefined : undefined,
        waypoints: waypointsPayload,
        dropoffAddress: dropoffAddress.trim(),
        pickupType: pickupType || undefined,
        dropoffType: dropoffType || undefined,
        phone: orderPhone.trim() || undefined,
        passengerName: orderPassengerName.trim() || undefined,
        preferredCarType: preferredCarTypeForm.trim() || undefined,
        ...(pickupAtIso ? { pickupAt: pickupAtIso } : {}),
      });
      setPickupAddress('');
      setMiddleAddress('');
      setWaypointAddresses([]);
      setDropoffAddress('');
      setPickupAtForm('');
      setOrderPhone('');
      setOrderPassengerName('');
      setPickupType('');
      setDropoffType('');
      setPreferredCarTypeForm('');
      setRouteTypeForm('LOCAL');
      setPickPoint(null);
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

  const ordersTitle = isDriver ? t('dashboard.myOrders') : t('dashboard.orders');
  const emptyMessage = isDriver ? t('dashboard.noMyOrders') : t('dashboard.noOrders');
  const assignedOrder = isDriver ? orders.find((o) => o.status === 'ASSIGNED' && o.driverId === user?.id) : null;

  return (
    <div className={`dashboard-page ${isDriver ? 'dashboard-page--driver' : ''} ${isDriver && driverMapFullScreen ? 'dashboard-page--full-map' : ''}`}>
      {assignedOrder && (
        <div className="dashboard-assigned-popup" role="dialog" aria-modal="true" style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="rd-panel" style={{ maxWidth: 420, width: '100%' }}>
            <h3>{t('dashboard.assignedPopupTitle')}</h3>
            <p className="rd-text-muted">
              {new Date(assignedOrder.pickupAt).toLocaleString()} — {assignedOrder.pickupAddress} → {assignedOrder.dropoffAddress}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(assignedOrder.id, 'IN_PROGRESS')}>
                {statusUpdatingId === assignedOrder.id ? '…' : t('dashboard.startRide')}
              </button>
              <button type="button" className="rd-btn rd-btn-danger" disabled={!!rejectingId} onClick={() => handleRejectOrder(assignedOrder.id)}>
                {rejectingId === assignedOrder.id ? '…' : t('dashboard.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="dashboard-page__top">
        <h1>{isDriver ? t('dashboard.myOrders') : t('dashboard.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isDriver && (
            <button type="button" className="rd-btn" onClick={() => { downloadCsv(filteredOrders, 'orders.csv', [
              { key: 'id', label: 'ID' },
              { key: 'status', label: t('dashboard.orderStatus') },
              { key: 'pickupAt', label: t('dashboard.timeScheduled') },
              { key: 'arrivedAtPickupAt', label: t('dashboard.timeArrived') },
              { key: 'leftPickupAt', label: t('dashboard.timePickedUp') },
              { key: 'completedAt', label: t('dashboard.timeDroppedOff') },
              { key: 'pickupAddress', label: t('dashboard.pickupAddress') },
              { key: 'dropoffAddress', label: t('dashboard.dropoffAddress') },
            ]); toast.success(t('toast.exportDone')); }}>
              {t('dashboard.exportCsv')}
            </button>
          )}
          {isDriver ? (
            <div className="dashboard-driver-top-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="rd-btn" disabled={sharingLocation} onClick={handleShareLocation}>
                  {sharingLocation ? '…' : t('dashboard.shareLocation')}
                </button>
                <button
                  type="button"
                  className={user?.available !== false ? 'rd-btn dashboard-status-btn dashboard-status-btn--offline' : 'rd-btn dashboard-status-btn dashboard-status-btn--online'}
                  onClick={handleToggleAvailability}
                >
                  {user?.available !== false ? t('dashboard.goOffline') : t('dashboard.startOnline')}
                </button>
                <span className="dashboard-map-icon-choice" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="rd-text-muted" style={{ fontSize: '0.8rem' }}>{t('dashboard.myMarkerOnMap')}:</span>
                  <button type="button" className={`rd-btn rd-btn--small ${driverMapIcon === 'car' ? 'rd-btn-primary' : ''}`} onClick={() => { setDriverMapIcon('car'); localStorage.setItem(DRIVER_MAP_ICON_KEY, 'car'); }} title={t('dashboard.mapIconCar')}>{t('dashboard.mapIconCar')}</button>
                  <button type="button" className={`rd-btn rd-btn--small ${driverMapIcon === 'arrow' ? 'rd-btn-primary' : ''}`} onClick={() => { setDriverMapIcon('arrow'); localStorage.setItem(DRIVER_MAP_ICON_KEY, 'arrow'); }} title={t('dashboard.mapIconArrow')}>{t('dashboard.mapIconArrow')}</button>
                </span>
                {currentDriverOrder && (
                  <button type="button" className={`rd-btn ${driverMapFullScreen ? 'rd-btn-primary' : ''}`} onClick={() => setDriverMapFullScreen((v) => !v)}>
                    {driverMapFullScreen ? t('dashboard.showList') : t('dashboard.fullMap')}
                  </button>
                )}
              </div>
              <span className={`rd-ws-pill ${connected ? 'connected' : ''}`}>
                <span className="rd-ws-dot" />
                {connected ? t('status.connected') : reconnecting ? t('dashboard.reconnecting') : 'Offline'}
              </span>
            </div>
          ) : null}
          {!isDriver && (
            <span className={`rd-ws-pill ${connected ? 'connected' : ''}`}>
              <span className="rd-ws-dot" />
              {connected ? t('status.connected') : reconnecting ? t('dashboard.reconnecting') : 'Offline'}
            </span>
          )}
        </div>
      </div>
      {reconnecting && (
        <div className="dashboard-reconnecting" role="status" aria-live="polite">
          {t('dashboard.reconnecting')}
        </div>
      )}
      {isDriver && routeData && (routeData.driverToPickupSteps?.length || routeData.steps?.length) && (() => {
        const toPickup = orders.some((o) => o.id === selectedOrderId && o.status === 'ASSIGNED');
        const altRoutes = routeData.alternativeRoutes ?? [];
        const mainMin = toPickup ? (routeData.driverToPickupMinutes ?? 0) : (routeData.durationMinutes ?? 0);
        const steps = toPickup ? (routeData.driverToPickupSteps ?? []) : (routeData.steps ?? []);
        const durationMin = altRoutes.length > 0 && selectedRouteIndex > 0 && altRoutes[selectedRouteIndex - 1]
          ? altRoutes[selectedRouteIndex - 1].durationMinutes
          : mainMin;
        const eta = new Date(Date.now() + durationMin * 60_000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        return (
          <div style={{ marginBottom: '0.5rem' }}>
            <NavBar
              steps={steps}
              durationMinutes={durationMin}
              phaseLabel={toPickup ? t('dashboard.navToPickup') : t('dashboard.navToDropoff')}
              eta={eta}
            />
            {steps.length > 0 && (
              <div className="dashboard-route-instructions" aria-label={t('dashboard.routeInstructions')}>
                <div className="dashboard-route-instructions__title">{t('dashboard.routeInstructions')}</div>
                <ul className="dashboard-route-instructions__list">
                  {steps.map((step, i) => {
                    const distStr = formatDistanceHint(step.distanceM);
                    const instr = step.instruction || (step.type === 11 ? t('dashboard.navHeadToDestination') : step.type === 10 ? t('dashboard.navArrive') : t('dashboard.navContinue'));
                    const icon = STEP_TYPE_ICON[step.type] ?? '↑';
                    return (
                      <li key={i} className="dashboard-route-instructions__item">
                        <span className="dashboard-route-instructions__icon" aria-hidden>{icon}</span>
                        <span className="dashboard-route-instructions__text">
                          {t('dashboard.turnIn', { dist: distStr })}{' · '}{instr}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <button type="button" className="rd-btn" onClick={refetchRoute}>{t('dashboard.recheckEta')}</button>
              {altRoutes.length > 0 && (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                  {[null, ...altRoutes].map((alt, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`rd-btn ${selectedRouteIndex === i ? 'rd-btn-primary' : ''}`}
                      onClick={() => setSelectedRouteIndex(i)}
                    >
                      {i === 0 ? t('dashboard.routeMain') : `${t('dashboard.routeAlt')} ${i}`} ({alt ? alt.durationMinutes : mainMin} min)
                    </button>
                  ))}
                </span>
              )}
              <button type="button" className="rd-btn" onClick={() => setShowReportModal(true)} disabled={!driverLocation}>{t('dashboard.report')}</button>
              {(() => {
                const sel = orders.find((o) => o.id === selectedOrderId);
                if (sel && (getOrderStops(sel).length > 0 || sel.pickupAddress)) {
                  return (
                    <>
                      <button type="button" className="rd-btn" title={t('dashboard.openRouteInGoogleMaps')} onClick={() => openFullRouteInGoogleMaps(sel)}>{t('dashboard.openInGoogleMaps')}</button>
                      <button type="button" className="rd-btn" title={t('dashboard.openRouteInWaze')} onClick={() => openFullRouteInWaze(sel)}>{t('dashboard.openInWaze')}</button>
                    </>
                  );
                }
                if (routeData?.dropoffCoords) {
                  return (
                    <>
                      <button type="button" className="rd-btn" onClick={openInGoogleMaps}>{t('dashboard.openInGoogleMaps')}</button>
                      <button type="button" className="rd-btn" onClick={openInWaze}>{t('dashboard.openInWaze')}</button>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        );
      })()}
      <div className="dashboard-page__grid">
        <aside className={`dashboard-page__sidebar rd-panel ${isDriver && driverMapFullScreen ? 'dashboard-page__sidebar--hidden' : ''}`}>
          <div className="rd-panel-header">
            <h2>{ordersTitle}</h2>
            {canCreateOrder && (
              <button
                type="button"
                className="rd-btn rd-btn-primary"
                onClick={() => {
                  if (!showForm) setPickupAtForm(getDefaultPickupAtForm());
                  setShowForm(!showForm);
                }}
              >
                + {t('dashboard.newOrder')}
              </button>
            )}
          </div>
          {canCreateOrder && (
            <div className="dashboard-order-form-wrap">
              {showForm && (
                <>
                  <button type="button" className="dashboard-order-form-toggle" onClick={() => setShowForm(false)} aria-expanded="true">
                    <span>{t('dashboard.newOrderForm')}</span>
                    <span className="dashboard-order-form-chevron" aria-hidden>▲</span>
                  </button>
                  <form onSubmit={handleCreateOrder} className="dashboard-order-form">
              <div className="dashboard-form-row dashboard-form-row--compact">
                <label className="dashboard-form-label--inline">{t('dashboard.clientSuggestion')}</label>
                <select
                  className="rd-input"
                  style={{ minWidth: 140 }}
                  value={passengersSuggestions.find((p) => p.phone === orderPhone)?.id ?? ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    const p = passengersSuggestions.find((x) => x.id === id);
                    if (p) {
                      setOrderPhone(p.phone ?? '');
                      setOrderPassengerName(p.name ?? '');
                      setPickupAddress(p.pickupAddr ?? '');
                      setDropoffAddress(p.dropoffAddr ?? '');
                      setPickupType(p.pickupType ?? '');
                      setDropoffType(p.dropoffType ?? '');
                    } else {
                      setOrderPhone('');
                      setOrderPassengerName('');
                    }
                  }}
                >
                  <option value="">—</option>
                  {passengersSuggestions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.phone ?? ''} {p.name ? `— ${p.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dashboard-form-row dashboard-form-row--two">
                <div>
                  <label>{t('dashboard.tripType')}</label>
                  <select className="rd-input" value={tripTypeForm} onChange={(e) => setTripTypeForm(e.target.value as 'ONE_WAY' | 'ROUNDTRIP')}>
                    <option value="ONE_WAY">{t('dashboard.oneWay')}</option>
                    <option value="ROUNDTRIP">{t('dashboard.roundtrip')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('dashboard.routeType')}</label>
                  <select className="rd-input" value={routeTypeForm} onChange={(e) => setRouteTypeForm(e.target.value as 'LOCAL' | 'LONG')}>
                    <option value="LOCAL">{t('dashboard.routeLocal')}</option>
                    <option value="LONG">{t('dashboard.routeLong')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('dashboard.preferredCarType')}</label>
                  <select className="rd-input" value={preferredCarTypeForm} onChange={(e) => setPreferredCarTypeForm(e.target.value)}>
                    <option value="">{t('dashboard.preferredCarTypeNone')}</option>
                    <option value="SEDAN">{t('auth.carType_SEDAN')}</option>
                    <option value="MINIVAN">{t('auth.carType_MINIVAN')}</option>
                    <option value="SUV">{t('auth.carType_SUV')}</option>
                  </select>
                </div>
              </div>
              <p className="rd-text-muted dashboard-form-hint">{t('dashboard.driverArriveTimeHint')}</p>
              <div className="dashboard-form-section">
                <label>{t('dashboard.pickupTimeOptional')}</label>
                <input type="datetime-local" className="rd-input" value={pickupAtForm} onChange={(e) => setPickupAtForm(e.target.value)} aria-describedby="pickup-time-desc" />
                <p id="pickup-time-desc" className="rd-text-muted dashboard-form-hint">{t('dashboard.pickupTimePlaceholder')}</p>
              </div>
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
                    aria-describedby={pickupAddress.trim() && existingAddresses.some((a) => a.toLowerCase() === pickupAddress.trim().toLowerCase()) ? 'pickup-existing-hint' : undefined}
                  />
                  <datalist id="pickup-address-list">
                    {existingAddresses.map((addr) => (
                      <option key={addr} value={addr} />
                    ))}
                  </datalist>
                  <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => m === 'pickup' ? null : 'pickup')}>
                    {pickMode === 'pickup' ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                  </button>
                  <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => handleUseMyLocation('pickup')}>
                    {t('dashboard.useMyLocation')}
                  </button>
                </div>
                {pickupAddress.trim() && existingAddresses.some((a) => a.toLowerCase() === pickupAddress.trim().toLowerCase()) && (
                  <p id="pickup-existing-hint" className="rd-text-muted dashboard-form-hint" style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                    {t('dashboard.addressMatchExisting')}
                  </p>
                )}
              </div>
              <div className="dashboard-form-row dashboard-form-row--two">
                <div>
                  <label>{t('dashboard.placeTypePickup')}</label>
                  <select className="rd-input" value={pickupType} onChange={(e) => setPickupType(e.target.value)}>
                    {PLACE_TYPES.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{t('dashboard.placeTypeDropoff')}</label>
                  <select className="rd-input" value={dropoffType} onChange={(e) => setDropoffType(e.target.value)}>
                    {PLACE_TYPES.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="dashboard-form-section">
                <label>{t('dashboard.numberOfStops')}</label>
                <select
                  className="rd-input"
                  value={waypointAddresses.length}
                  onChange={(e) => setWaypointAddresses(Array(Number((e.target as HTMLSelectElement).value)).fill(''))}
                >
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              {waypointAddresses.length > 0 && (
                <div className="dashboard-form-section dashboard-form-section--stops">
                  <label>{t('dashboard.additionalStops')}</label>
                  {waypointAddresses.map((addr, idx) => (
                    <div key={idx} className="dashboard-stop-row">
                      <input type="text" className="rd-input dashboard-address-input" value={addr} onChange={(e) => setWaypointAddresses((prev) => { const n = [...prev]; n[idx] = e.target.value; return n; })} placeholder={t('dashboard.stopAddressPlaceholder')} />
                      <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => m === `waypoint-${idx}` ? null : `waypoint-${idx}`)} title={t('dashboard.pickOnMap')}>
                        {pickMode === `waypoint-${idx}` ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                      </button>
                      <button type="button" className="rd-btn rd-btn--small" onClick={() => setWaypointAddresses((prev) => prev.filter((_, i) => i !== idx))} aria-label={t('dashboard.removeStop')}>−</button>
                    </div>
                  ))}
                  <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setWaypointAddresses((prev) => [...prev, ''])}>+ {t('dashboard.addStop')}</button>
                </div>
              )}
              {tripTypeForm === 'ROUNDTRIP' && (
                <div className="dashboard-form-section">
                  <label>{t('dashboard.secondLocation')}</label>
                  <input type="text" className="rd-input" value={middleAddress} onChange={(e) => setMiddleAddress(e.target.value)} placeholder={t('dashboard.secondLocation')} />
                </div>
              )}
              <div className="dashboard-form-section">
                <label>{tripTypeForm === 'ROUNDTRIP' ? t('dashboard.finalLocation') : t('dashboard.dropoffAddress')}</label>
                <div className="dashboard-address-row">
                  <input
                    type="text"
                    className="rd-input dashboard-address-input"
                    list="dropoff-address-list"
                    value={dropoffAddress}
                    onChange={(e) => setDropoffAddress(e.target.value)}
                    placeholder={t('dashboard.addressPlaceholder')}
                    required
                    aria-describedby={dropoffAddress.trim() && existingAddresses.some((a) => a.toLowerCase() === dropoffAddress.trim().toLowerCase()) ? 'dropoff-existing-hint' : undefined}
                  />
                  <datalist id="dropoff-address-list">
                    {existingAddresses.map((addr) => (
                      <option key={addr} value={addr} />
                    ))}
                  </datalist>
                  <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => m === 'dropoff' ? null : 'dropoff')}>
                    {pickMode === 'dropoff' ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                  </button>
                  <button type="button" className="rd-btn rd-btn--small" disabled={!!reverseGeocodeLoading} onClick={() => handleUseMyLocation('dropoff')}>
                    {t('dashboard.useMyLocation')}
                  </button>
                </div>
                {dropoffAddress.trim() && existingAddresses.some((a) => a.toLowerCase() === dropoffAddress.trim().toLowerCase()) && (
                  <p id="dropoff-existing-hint" className="rd-text-muted dashboard-form-hint" style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                    {t('dashboard.addressMatchExisting')}
                  </p>
                )}
              </div>
              {reverseGeocodeLoading && <p className="rd-text-muted dashboard-form-hint">{t('dashboard.detectingAddress')}</p>}
              {pickMode && (
                <p className="rd-text-muted dashboard-form-hint">
                  {pickMode === 'pickup' ? t('dashboard.clickMapPickup') : pickMode === 'dropoff' ? t('dashboard.clickMapDropoff') : pickMode.startsWith('waypoint-') ? t('dashboard.clickMapStop', { n: parseInt(pickMode.replace('waypoint-', ''), 10) + 1 }) : ''}
                </p>
              )}
              {submitError && <p className="rd-text-critical">{submitError}</p>}
              <button type="submit" className="rd-btn rd-btn-primary">{t('dashboard.createOrder')}</button>
            </form>
                </>
              )}
              {!showForm && canCreateOrder && (
                <button type="button" className="dashboard-order-form-toggle dashboard-order-form-toggle--closed" onClick={() => { setPickupAtForm(getDefaultPickupAtForm()); setShowForm(true); }} aria-expanded="false">
                  <span>{t('dashboard.newOrderForm')}</span>
                  <span className="dashboard-order-form-chevron" aria-hidden>▼</span>
                </button>
              )}
            </div>
          )}
          {focusMode && canAssign && selectedOrderId && (
            <div style={{ marginBottom: '0.75rem' }}>
              <button type="button" className="rd-btn rd-btn-secondary" onClick={() => setFocusMode(false)}>
                {t('dashboard.exitFocusMode')}
              </button>
            </div>
          )}
          <div className="dashboard-order-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className={`rd-btn ${orderTab === 'active' ? 'rd-btn-primary' : ''}`} onClick={() => setOrderTab('active')}>
              {t('dashboard.tabActive')}
            </button>
            <button type="button" className={`rd-btn ${orderTab === 'completed' ? 'rd-btn-primary' : ''}`} onClick={() => setOrderTab('completed')}>
              {isDriver ? t('dashboard.tabMyCompleted') : t('dashboard.tabCompleted')}
            </button>
            <button type="button" className={`rd-btn ${orderTab === 'pickupDropoff' ? 'rd-btn-primary' : ''}`} onClick={() => setOrderTab('pickupDropoff')}>
              {t('dashboard.tabPickupDropoff')}
            </button>
            {!isDriver && (
              <select className="rd-input" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)} style={{ width: 'auto', minWidth: 120 }}>
                <option value="">{t('dashboard.filterStatus')}</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            )}
            <select className="rd-input" value={orderSortBy} onChange={(e) => setOrderSortBy(e.target.value as 'scheduled' | 'arrived' | 'pickedUp' | 'droppedOff')} style={{ width: 'auto', minWidth: 140 }}>
              <option value="scheduled">{t('dashboard.sortByScheduled')}</option>
              <option value="arrived">{t('dashboard.sortByArrived')}</option>
              <option value="pickedUp">{t('dashboard.sortByPickedUp')}</option>
              <option value="droppedOff">{t('dashboard.sortByDroppedOff')}</option>
            </select>
            {!isDriver && (
              <input
                type="text"
                className="rd-input dashboard-find-by-id"
                placeholder={t('dashboard.findById')}
                value={findByIdQuery}
                onChange={(e) => setFindByIdQuery(e.target.value)}
                style={{ width: 'auto', minWidth: 140 }}
                aria-label={t('dashboard.findById')}
              />
            )}
            <button type="button" className="rd-btn rd-btn-secondary" onClick={refreshAll} disabled={loading || (orderTab === 'completed' && completedLoading) || (orderTab === 'pickupDropoff' && completedLoading)} title={t('dashboard.refreshAllTitle')}>
              {t('dashboard.refreshAll')}
            </button>
            {canAssign && (
              <>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoAssignEnabled} onChange={(e) => setAutoAssignEnabled(e.target.checked)} />
                  <span>{t('dashboard.enableAutoAssign')}</span>
                </label>
                <button type="button" className="rd-btn" onClick={() => setShowPlanPanel((v) => !v)}>
                  {t('dashboard.viewPlan')}
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showProblemZones} onChange={(e) => setShowProblemZones(e.target.checked)} />
                  <span>{t('dashboard.problemZones')}</span>
                </label>
                <button type="button" className={`rd-btn ${focusMode ? 'rd-btn-primary' : ''}`} onClick={() => setFocusMode((v) => !v)}>
                  {t('dashboard.focusMode')}
                </button>
              </>
            )}
          </div>
          {canAssign && showPlanPanel && planningResult && (
            <div className="dashboard-plan-panel rd-panel" style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--rd-border)', borderRadius: 'var(--rd-radius-lg)' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{t('dashboard.planningWindow')}</h3>
              <div className="dashboard-plan-stats" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span>{t('dashboard.planOrdersCount', { count: planningResult.ordersCount })}</span>
                <span>{t('dashboard.planDriversAvailable', { count: planningResult.driversAvailable })}</span>
                {planningResult.shortage && <span className="rd-badge rd-badge-warning">{t('dashboard.planShortage')}</span>}
              </div>
              {planningResult.riskyOrders.length > 0 && (
                <div>
                  <strong>{t('dashboard.riskyOrders')}</strong>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0.25rem 0 0' }}>
                    {planningResult.riskyOrders.map((r) => (
                      <li key={r.orderId} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        {r.orderId.slice(0, 8)}… — {r.reason} — {t('dashboard.pickupAt')}: {new Date(r.pickupAt).toLocaleTimeString()}
                        {r.suggestedDrivers.length > 0 && ` (${t('dashboard.suggestedDrivers')}: ${r.suggestedDrivers.length})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {(loading || (orderTab === 'completed' && completedLoading) || (orderTab === 'pickupDropoff' && completedLoading)) ? (
            <p className="rd-text-muted">{t('common.loading')}</p>
          ) : orderTab === 'pickupDropoff' && pickupDropoffGroups && pickupDropoffGroups.every((g) => g.orders.length === 0) ? (
            <p className="rd-text-muted">{t('dashboard.noOrders')}</p>
          ) : orderTab === 'pickupDropoff' && pickupDropoffGroups ? (
            <>
              {pickupDropoffGroups.map((group) => (
                <section key={group.key} style={{ marginBottom: '1.5rem' }}>
                  <h3 className="rd-section-title" style={{ marginBottom: '0.5rem' }}>{t(group.titleKey)} ({group.orders.length})</h3>
                  {group.orders.length === 0 ? (
                    <p className="rd-text-muted" style={{ fontSize: '0.875rem' }}>{t('dashboard.noOrders')}</p>
                  ) : (
                    <ul className="dashboard-orders-list">
                      {group.orders.map((o) => (
                        <li key={o.id} className={`dashboard-order-item ${o.riskLevel === 'HIGH' ? 'dashboard-order-item--risk-high' : o.riskLevel === 'MEDIUM' ? 'dashboard-order-item--risk-medium' : ''}`}>
                          <span className={`rd-badge ${o.status === 'ASSIGNED' ? 'rd-badge-assigned' : o.status === 'IN_PROGRESS' ? 'rd-badge-ok' : o.status === 'SCHEDULED' ? 'rd-badge-pending' : ''}`}>{o.status}</span>
                          {o.riskLevel && (
                            <span className={`rd-badge ${o.riskLevel === 'HIGH' ? 'rd-badge-critical' : o.riskLevel === 'MEDIUM' ? 'rd-badge-warning' : ''}`} style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }} title={t('dashboard.riskLevel')}>{o.riskLevel}</span>
                          )}
                          {getOrderStops(o).length > 0 && (
                            <span className="rd-badge rd-badge-pending" style={{ marginLeft: '0.25rem', fontSize: '0.75rem' }}>{t('dashboard.stopsCount', { count: getOrderStops(o).length })}</span>
                          )}
                          {autoAssignEnabled && o.suggestedDriverId && (
                            <div className="rd-text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                              {t('dashboard.suggestedDriver')}: {drivers.find((d) => d.id === o.suggestedDriverId)?.nickname ?? o.suggestedDriverId}
                            </div>
                          )}
                          {(o.passenger?.name || o.passenger?.phone) && (
                            <div>
                              {t('dashboard.passenger')}: {o.passenger?.name}{o.passenger?.name && o.passenger?.phone ? ' · ' : ''}
                              {o.passenger?.phone ? <a href={`tel:${o.passenger.phone}`} className="dashboard-tel-link">{o.passenger.phone}</a> : ''}
                            </div>
                          )}
                          {o.preferredCarType && (
                            <div>{t('dashboard.preferredCarType')}: {o.preferredCarType === 'SEDAN' ? t('auth.carType_SEDAN') : o.preferredCarType === 'MINIVAN' ? t('auth.carType_MINIVAN') : o.preferredCarType === 'SUV' ? t('auth.carType_SUV') : o.preferredCarType}</div>
                          )}
                          <div>{t('dashboard.orderCreated')}: {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</div>
                          {!isDriver && (
                            <div className="dashboard-order-pickup-time">
                              {t('dashboard.timeScheduled')}: <strong>{o.pickupAt ? new Date(o.pickupAt).toLocaleString() : '—'}</strong>
                            </div>
                          )}
                          {o.driverId && (() => {
                            const driver = drivers.find((d) => d.id === o.driverId);
                            return (
                              <div className="dashboard-assigned-driver" style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                                {t('dashboard.assignedDriver')}: <strong>{driver ? driver.nickname : <span className="rd-id-compact" title={o.driverId ?? undefined}>{shortId(o.driverId)}</span>}</strong>
                                {driver?.phone && <span className="rd-text-muted"> (<a href={`tel:${driver.phone}`} className="dashboard-tel-link">{driver.phone}</a>)</span>}
                              </div>
                            );
                          })()}
                          {o.driverId && (
                            <div className="dashboard-route-times">
                              <div className="dashboard-route-times__leg">
                                <div className="dashboard-route-times__label">{t('dashboard.pickupAddress')}</div>
                                <div className="dashboard-route-times__address">{o.pickupAddress}</div>
                                {!isDriver && <div className="dashboard-route-times__row">{o.driverId ? t('dashboard.driverArriveTime') : t('dashboard.timeScheduled')}: {new Date(o.pickupAt).toLocaleString()}</div>}
                                {o.arrivedAtPickupAt && <div className="dashboard-route-times__row">{t('dashboard.timeArrived')}: {new Date(o.arrivedAtPickupAt).toLocaleString()}</div>}
                                {o.leftPickupAt && <div className="dashboard-route-times__row">{t('dashboard.timePickedUp')}: {new Date(o.leftPickupAt).toLocaleString()}</div>}
                              </div>
                              {getOrderStops(o).map((stop, idx) => (
                                <div key={idx} className="dashboard-route-times__leg dashboard-route-times__leg--stop">
                                  <div className="dashboard-route-times__label">{getOrderStops(o).length > 1 ? t('dashboard.stopLocationN', { n: idx + 1 }) : t('dashboard.stopLocation')}</div>
                                  <div className="dashboard-route-times__address">{stop.address}</div>
                                  {idx === 0 && o.arrivedAtMiddleAt && <div className="dashboard-route-times__row">{t('dashboard.timeArrivedAtStop')}: {new Date(o.arrivedAtMiddleAt).toLocaleString()}</div>}
                                  {idx === 0 && o.leftMiddleAt && <div className="dashboard-route-times__row">{t('dashboard.timeLeftStop')}: {new Date(o.leftMiddleAt).toLocaleString()}</div>}
                                </div>
                              ))}
                              <div className="dashboard-route-times__leg">
                                <div className="dashboard-route-times__label">{t('dashboard.dropoffAddress')}</div>
                                <div className="dashboard-route-times__address">{o.dropoffAddress}</div>
                                {o.completedAt && <div className="dashboard-route-times__row">{t('dashboard.timeDroppedOff')}: {new Date(o.completedAt).toLocaleString()}</div>}
                              </div>
                            </div>
                          )}
                          {!o.driverId && (
                            <>
                              <div>{o.driverId ? t('dashboard.driverArriveTime') : t('dashboard.timeScheduled')}: {new Date(o.pickupAt).toLocaleString()}</div>
                              <div className="rd-text-muted" style={{ fontSize: '0.875rem' }}>{o.pickupAddress}{getOrderStops(o).length > 0 ? ` → ${getOrderStops(o).map((s) => s.address).join(' → ')} → ` : ' → '}{o.dropoffAddress}</div>
                            </>
                          )}
                          {isDriver && o.status === 'COMPLETED' && o.leftPickupAt && o.completedAt && (
                            <div className="dashboard-completed-trip-info">
                              <div className="rd-section-title" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{t('dashboard.tripInfo')}</div>
                              <div className="stat-row"><span>{t('dashboard.tripDuration')}</span><span><strong>{Math.round((new Date(o.completedAt).getTime() - new Date(o.leftPickupAt).getTime()) / 60_000)} min</strong></span></div>
                              <div className="rd-text-muted" style={{ fontSize: '0.875rem' }}>{o.pickupAddress} → {o.dropoffAddress}</div>
                              {o.arrivedAtPickupAt && <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.timeArrived')}: {new Date(o.arrivedAtPickupAt).toLocaleString()}</div>}
                              <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.timePickedUp')}: {new Date(o.leftPickupAt).toLocaleString()}</div>
                              <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.timeDroppedOff')}: {new Date(o.completedAt).toLocaleString()}</div>
                              {(o.waitChargeAtPickupCents ?? 0) > 0 && <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.waitChargePickup')}: ${(o.waitChargeAtPickupCents! / 100).toFixed(0)}</div>}
                              {(o.waitChargeAtMiddleCents ?? 0) > 0 && <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.waitChargeSecond')}: ${(o.waitChargeAtMiddleCents! / 100).toFixed(0)}</div>}
                            </div>
                          )}
                          {o.status === 'IN_PROGRESS' && o.startedAt && (
                            <div className="dashboard-order-duration">
                              {t('dashboard.duration')}: <strong>{formatDuration(o.startedAt)}</strong>
                            </div>
                          )}
                          {!o.driverId && (
                            <div className="rd-text-muted">
                              {getOrderStops(o).length > 0
                                ? `${o.pickupAddress} → ${getOrderStops(o).map((s) => s.address).join(' → ')} → ${o.dropoffAddress}`
                                : `${o.pickupAddress} → ${o.dropoffAddress}`}
                              {o.routeType && (
                                <span className="rd-badge rd-badge-pending" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                                  {o.routeType === 'LONG' ? t('dashboard.routeLong') : t('dashboard.routeLocal')}
                                </span>
                              )}
                            </div>
                          )}
                          {isDriver && o.status === 'ASSIGNED' && !o.arrivedAtPickupAt && (
                            <button type="button" className="rd-btn rd-btn-success" disabled={!!arrivingId} onClick={() => handleArrivedAtPickup(o.id)}>
                              {arrivingId === o.id ? '…' : t('dashboard.arrivedAtPickup')}
                            </button>
                          )}
                          {isDriver && o.arrivedAtPickupAt && (() => {
                            const totalMin = getTotalWaitMinutes(o.arrivedAtPickupAt!, o.leftPickupAt ?? null);
                            void now;
                            const ended = !!o.leftPickupAt;
                            const charge = (o.waitChargeAtPickupCents ?? 0) / 100;
                            return (
                              <div className="dashboard-wait-timer-card">
                                <div className="dashboard-wait-timer-card__title">{t('dashboard.waitTimerTitlePickup')}</div>
                                <div className="dashboard-wait-timer-card__row">
                                  <span className="rd-text-muted">{t('dashboard.waitTimerStarted')}:</span>
                                  <span>{new Date(o.arrivedAtPickupAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {ended ? (
                                  <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--result">
                                    <span>{t('dashboard.waitTimerEnded')}</span>
                                    <span>{t('dashboard.waitTimerWaited', { min: totalMin })}</span>
                                    <span>{charge > 0 ? `$${charge.toFixed(0)}` : t('dashboard.waitTimerNoCharge')}</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--live">
                                      <span>{t('dashboard.waitTimerWaiting')}:</span>
                                      <strong>{totalMin} min</strong>
                                    </div>
                                    {totalMin < 5 && (
                                      <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerStartsIn', { min: 5 - totalMin })}</div>
                                    )}
                                    {totalMin >= 5 && totalMin < 20 && (
                                      <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerFirst5Free')}</div>
                                    )}
                                    {totalMin >= 20 && (
                                      <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerChargeFrom20')}: <strong>${getWaitChargeDollars(totalMin)}</strong></div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {isDriver && o.tripType === 'ROUNDTRIP' && o.status === 'IN_PROGRESS' && o.leftPickupAt && !o.arrivedAtMiddleAt && (
                            <button type="button" className="rd-btn" disabled={!!arrivingId} onClick={() => handleArrivedAtMiddle(o.id)}>
                              {arrivingId === o.id ? '…' : t('dashboard.arrivedAtSecondStop')}
                            </button>
                          )}
                          {isDriver && o.tripType === 'ROUNDTRIP' && o.arrivedAtMiddleAt && (() => {
                            const totalMin = getTotalWaitMinutes(o.arrivedAtMiddleAt!, o.leftMiddleAt ?? null);
                            void now;
                            const ended = !!o.leftMiddleAt;
                            const charge = (o.waitChargeAtMiddleCents ?? 0) / 100;
                            return (
                              <div className="dashboard-wait-timer-card dashboard-wait-timer-card--second">
                                <div className="dashboard-wait-timer-card__title">{t('dashboard.waitTimerTitleSecond')}</div>
                                <div className="dashboard-wait-timer-card__row">
                                  <span className="rd-text-muted">{t('dashboard.waitTimerStarted')}:</span>
                                  <span>{new Date(o.arrivedAtMiddleAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {ended ? (
                                  <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--result">
                                    <span>{t('dashboard.waitTimerEnded')}</span>
                                    <span>{t('dashboard.waitTimerWaited', { min: totalMin })}</span>
                                    <span>{charge > 0 ? `$${charge.toFixed(0)}` : t('dashboard.waitTimerNoCharge')}</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--live">
                                      <span>{t('dashboard.waitTimerWaiting')}:</span>
                                      <strong>{totalMin} min</strong>
                                    </div>
                                    {totalMin < 5 && (
                                      <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerStartsIn', { min: 5 - totalMin })}</div>
                                    )}
                                    {totalMin >= 5 && totalMin < 20 && (
                                      <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerFirst5Free')}</div>
                                    )}
                                    {totalMin >= 20 && (
                                      <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerChargeFrom20')}: <strong>${getWaitChargeDollars(totalMin)}</strong></div>
                                    )}
                                    <button type="button" className="rd-btn rd-btn-primary dashboard-wait-timer-card__btn" disabled={!!leftMiddleId} onClick={() => handleLeftMiddle(o.id)}>
                                      {leftMiddleId === o.id ? '…' : t('dashboard.startToFinal')}
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {canAssign && (
                            <div className="dashboard-order-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                              <button type="button" className="rd-btn" onClick={() => { setSelectedOrderId(selectedOrderId === o.id ? null : o.id); if (o.id !== selectedOrderId && (!o.driverId || o.riskLevel === 'HIGH' || o.riskLevel === 'MEDIUM')) setMapCenterTrigger((n) => n + 1); }}>
                                {t('dashboard.showOnMap')}
                              </button>
                              <button type="button" className="rd-btn" onClick={() => { setSelectedOrderId(o.id); setMapCenterTrigger((n) => n + 1); }}>
                                {t('dashboard.centerOnMap')}
                              </button>
                              {canAssign && (
                                <button type="button" className="rd-btn rd-btn-primary" onClick={() => { setSelectedOrderId(o.id); setFocusMode(true); setMapCenterTrigger((n) => n + 1); }}>
                                  {t('dashboard.focusMode')}
                                </button>
                              )}
                              <button type="button" className="rd-btn" onClick={() => loadDriverEtasForOrder(o.id)}>
                                {t('dashboard.checkEta')}
                              </button>
                            </div>
                          )}
                          {canAssign && (o.status === 'SCHEDULED' && !o.driverId || o.status === 'ASSIGNED') && (() => {
                            const baseList = driverEtas[o.id]?.drivers
                              ? driverEtas[o.id].drivers.map((e) => drivers.find((d) => d.id === e.id)).filter((u): u is User => u != null)
                              : (o.preferredCarType?.trim() ? drivers.filter((d) => (d as { carType?: string | null }).carType === o.preferredCarType!.trim().toUpperCase()) : drivers);
                            const searchQ = (driverAssignSearch[o.id] ?? '').trim();
                            const filteredDriversForOrder = searchQ ? baseList.filter((d) => driverMatchesSearch(d, searchQ)) : baseList;
                            const best = driverEtas[o.id]?.drivers?.[0];
                            const bestDriver = best ? drivers.find((d) => d.id === best.id) : null;
                            return (
                              <div className="dashboard-order-assign" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                                <label htmlFor={`driver-pd-${o.id}`} className="dashboard-order-assign-label" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                                  {o.status === 'ASSIGNED' ? t('dashboard.swapDriver') : t('dashboard.assignDriver')}
                                </label>
                                {o.status === 'SCHEDULED' && best && (
                                  <button type="button" className="rd-text-muted" style={{ fontSize: '0.8125rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }} onClick={() => bestDriver && setSelectedDriverDetail({ orderId: o.id, driver: bestDriver })} title={t('dashboard.driverInfoClick')}>
                                    {t('dashboard.bestDriverSuggestionWithId', { name: best.nickname, id: bestDriver ? (bestDriver as User).driverId ?? best.id : best.id, min: Math.round(Number(best.etaMinutesToPickup) || 0) })}
                                  </button>
                                )}
                                <input type="text" className="rd-input" placeholder={t('dashboard.searchDriverByCarIdOrPhone')} value={driverAssignSearch[o.id] ?? ''} onChange={(e) => setDriverAssignSearch((prev) => ({ ...prev, [o.id]: e.target.value }))} style={{ width: '100%', maxWidth: 320 }} aria-label={t('dashboard.searchDriverByCarIdOrPhone')} />
                                <select className="rd-input" id={`driver-pd-${o.id}`} onFocus={() => loadDriverEtasForOrder(o.id)} onChange={(e) => { const v = e.target.value; if (v) handleAssign(o.id, v); }} aria-label={o.status === 'ASSIGNED' ? t('dashboard.swapDriver') : t('dashboard.assignDriver')}>
                                  <option value="">{filteredDriversForOrder.length === 0 ? t('dashboard.noDriversToAssign') : (o.status === 'ASSIGNED' ? t('dashboard.swapDriver') : t('dashboard.selectDriver'))}</option>
                                  {filteredDriversForOrder.map((d) => {
                                    const eta = driverEtas[o.id]?.drivers?.find((x) => x.id === d.id);
                                    const toPickup = Math.round(Number(eta?.etaMinutesToPickup) || 0);
                                    const total = Math.round(Number(eta?.etaMinutesTotal) || 0);
                                    const did = (d as User).driverId ?? d.id;
                                    const label = eta ? `${did} · ${d.nickname} — ETA ${toPickup} min to pickup, ${total} min total` : `${did} · ${d.nickname}${d.phone ? ` — ${d.phone}` : ''}`;
                                    return <option key={d.id} value={d.id}>{label}</option>;
                                  })}
                                </select>
                                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input type="text" className="rd-input" placeholder={t('dashboard.driverIdOrPhone')} value={driverAssignByIdInput[o.id] ?? ''} onChange={(e) => setDriverAssignByIdInput((prev) => ({ ...prev, [o.id]: e.target.value }))} style={{ width: 120 }} aria-label={t('dashboard.driverIdOrPhone')} />
                                  <button type="button" className="rd-btn rd-btn--small" disabled={!!assigningId || !(driverAssignByIdInput[o.id] ?? '').trim()} onClick={() => { const v = driverAssignByIdInput[o.id] ?? ''; const found = findDriverByIdOrPhone(v); if (found) { handleAssign(o.id, found.id); setDriverAssignByIdInput((prev) => ({ ...prev, [o.id]: '' })); } else if (v.trim()) toast.error(t('dashboard.driverNotFoundByIdOrPhone')); }}>
                                    {assigningId === o.id ? '…' : t('dashboard.assignById')}
                                  </button>
                                </div>
                                {drivers.length === 0 && o.status === 'SCHEDULED' && !o.driverId && <span className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.noDriversToAssignHint')}</span>}
                                {assigningId === o.id && <span className="rd-text-muted">…</span>}
                              </div>
                            );
                          })()}
                          {canAssign && (o.status === 'SCHEDULED' || o.status === 'ASSIGNED') && (o.riskLevel === 'HIGH' || o.riskLevel === 'MEDIUM') && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                              <button type="button" className="rd-btn rd-btn-secondary" disabled={!!delayOrderingId} onClick={() => handleDelayOrder(o.id, 5)}>{delayOrderingId === o.id ? '…' : t('dashboard.delayMinutes', { min: 5 })}</button>
                              <button type="button" className="rd-btn rd-btn-secondary" disabled={!!delayOrderingId} onClick={() => handleDelayOrder(o.id, 10)}>{delayOrderingId === o.id ? '…' : t('dashboard.delayMinutes', { min: 10 })}</button>
                              <button type="button" className="rd-btn" title={o.manualAssignment ? t('dashboard.unmarkManual') : t('dashboard.markManual')} disabled={!!manualUpdatingId} onClick={() => handleSetManual(o.id, !o.manualAssignment)}>{manualUpdatingId === o.id ? '…' : (o.manualAssignment ? t('dashboard.unmarkManual') : t('dashboard.markManual'))}</button>
                            </div>
                          )}
                          {isDriver && o.driverId === user?.id && <div className="rd-text-muted">{t('dashboard.yourAssignment')}</div>}
                          {canChangeStatus && o.status === 'ASSIGNED' && (
                            <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(o.id, 'IN_PROGRESS')}>
                              {statusUpdatingId === o.id ? '…' : (o.arrivedAtPickupAt ? t('dashboard.startRide') : t('dashboard.accept'))}
                            </button>
                          )}
                          {canChangeStatus && o.status === 'IN_PROGRESS' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => (isDriver && o.driverId === user?.id ? setConfirmEndTripOrderId(o.id) : handleStatusChange(o.id, 'COMPLETED'))}>
                                {statusUpdatingId === o.id ? '…' : t('dashboard.complete')}
                              </button>
                              <button type="button" className="rd-btn rd-btn-danger" disabled={!!stopUnderwayId || !!statusUpdatingId} onClick={() => handleStopUnderway(o.id)} title={t('dashboard.stopUnderwayHint')}>
                                {stopUnderwayId === o.id ? '…' : t('dashboard.stopUnderway')}
                              </button>
                            </div>
                          )}
                          {canAssign && (
                            <button type="button" className="rd-btn rd-btn-danger" disabled={!!deletingId} style={{ marginTop: '0.25rem' }} onClick={() => setDeleteConfirmOrderId(o.id)}>
                              {deletingId === o.id ? '…' : t('dashboard.delete')}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          ) : (focusMode && canAssign && selectedOrderId ? filteredOrders.filter((o) => o.id === selectedOrderId) : filteredOrders).length === 0 ? (
            <>
              <p className="rd-text-muted">{orderTab === 'completed' ? t('dashboard.noCompletedOrders') : emptyMessage}</p>
              {isDriver && orderTab === 'active' && filteredOrders.length === 0 && t('dashboard.noMyOrdersHint') && (
                <p className="rd-text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{t('dashboard.noMyOrdersHint')}</p>
              )}
            </>
          ) : (
            <>
              {!isDriver && !(focusMode && selectedOrderId) && <h3 className="rd-section-title">{orderTab === 'active' ? t('dashboard.activeOrders') : t('dashboard.completedOrders')}</h3>}
              {focusMode && canAssign && selectedOrderId && <h3 className="rd-section-title">{t('dashboard.focusModeTitle')}</h3>}
              <ul className="dashboard-orders-list">
              {(focusMode && canAssign && selectedOrderId ? filteredOrders.filter((o) => o.id === selectedOrderId) : filteredOrders).map((o) => (
                <li key={o.id} className={`dashboard-order-item ${o.riskLevel === 'HIGH' ? 'dashboard-order-item--risk-high' : o.riskLevel === 'MEDIUM' ? 'dashboard-order-item--risk-medium' : ''}`}>
                  <span className={`rd-badge ${o.status === 'ASSIGNED' ? 'rd-badge-assigned' : o.status === 'IN_PROGRESS' ? 'rd-badge-ok' : o.status === 'SCHEDULED' ? 'rd-badge-pending' : ''}`}>{o.status}</span>
                  {o.riskLevel && (
                    <span className={`rd-badge ${o.riskLevel === 'HIGH' ? 'rd-badge-critical' : o.riskLevel === 'MEDIUM' ? 'rd-badge-warning' : ''}`} style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }} title={t('dashboard.riskLevel')}>{o.riskLevel}</span>
                  )}
                  {getOrderStops(o).length > 0 && (
                    <span className="rd-badge rd-badge-pending" style={{ marginLeft: '0.25rem', fontSize: '0.75rem' }}>{t('dashboard.stopsCount', { count: getOrderStops(o).length })}</span>
                  )}
                  {autoAssignEnabled && o.suggestedDriverId && (
                    <div className="rd-text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      {t('dashboard.suggestedDriver')}: {drivers.find((d) => d.id === o.suggestedDriverId)?.nickname ?? o.suggestedDriverId}
                    </div>
                  )}
                  {(o.passenger?.name || o.passenger?.phone) && (
                    <div>
                      {t('dashboard.passenger')}: {o.passenger?.name}{o.passenger?.name && o.passenger?.phone ? ' · ' : ''}
                      {o.passenger?.phone ? <a href={`tel:${o.passenger.phone}`} className="dashboard-tel-link">{o.passenger.phone}</a> : ''}
                    </div>
                  )}
                  {o.preferredCarType && (
                    <div>{t('dashboard.preferredCarType')}: {o.preferredCarType === 'SEDAN' ? t('auth.carType_SEDAN') : o.preferredCarType === 'MINIVAN' ? t('auth.carType_MINIVAN') : o.preferredCarType === 'SUV' ? t('auth.carType_SUV') : o.preferredCarType}</div>
                  )}
                  <div>{t('dashboard.orderCreated')}: {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</div>
                  {!isDriver && (
                    <div className="dashboard-order-pickup-time">
                      {t('dashboard.timeScheduled')}: <strong>{o.pickupAt ? new Date(o.pickupAt).toLocaleString() : '—'}</strong>
                    </div>
                  )}
                  {o.driverId && (() => {
                    const driver = drivers.find((d) => d.id === o.driverId);
                    return (
                      <div className="dashboard-assigned-driver" style={{ marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                        {t('dashboard.assignedDriver')}: <strong>{driver ? driver.nickname : <span className="rd-id-compact" title={o.driverId ?? undefined}>{shortId(o.driverId)}</span>}</strong>
                        {driver?.phone && <span className="rd-text-muted"> (<a href={`tel:${driver.phone}`} className="dashboard-tel-link">{driver.phone}</a>)</span>}
                      </div>
                    );
                  })()}
                  {o.driverId && (
                    <div className="dashboard-route-times">
                      <div className="dashboard-route-times__leg">
                        <div className="dashboard-route-times__label">{t('dashboard.pickupAddress')}</div>
                        <div className="dashboard-route-times__address">{o.pickupAddress}</div>
                        {!isDriver && <div className="dashboard-route-times__row">{o.driverId ? t('dashboard.driverArriveTime') : t('dashboard.timeScheduled')}: {new Date(o.pickupAt).toLocaleString()}</div>}
                        {o.arrivedAtPickupAt && <div className="dashboard-route-times__row">{t('dashboard.timeArrived')}: {new Date(o.arrivedAtPickupAt).toLocaleString()}</div>}
                        {o.leftPickupAt && <div className="dashboard-route-times__row">{t('dashboard.timePickedUp')}: {new Date(o.leftPickupAt).toLocaleString()}</div>}
                      </div>
                      {getOrderStops(o).map((stop, idx) => (
                        <div key={idx} className="dashboard-route-times__leg dashboard-route-times__leg--stop">
                          <div className="dashboard-route-times__label">{getOrderStops(o).length > 1 ? t('dashboard.stopLocationN', { n: idx + 1 }) : t('dashboard.stopLocation')}</div>
                          <div className="dashboard-route-times__address">{stop.address}</div>
                          {idx === 0 && o.arrivedAtMiddleAt && <div className="dashboard-route-times__row">{t('dashboard.timeArrivedAtStop')}: {new Date(o.arrivedAtMiddleAt).toLocaleString()}</div>}
                          {idx === 0 && o.leftMiddleAt && <div className="dashboard-route-times__row">{t('dashboard.timeLeftStop')}: {new Date(o.leftMiddleAt).toLocaleString()}</div>}
                        </div>
                      ))}
                      <div className="dashboard-route-times__leg">
                        <div className="dashboard-route-times__label">{t('dashboard.dropoffAddress')}</div>
                        <div className="dashboard-route-times__address">{o.dropoffAddress}</div>
                        {o.completedAt && <div className="dashboard-route-times__row">{t('dashboard.timeDroppedOff')}: {new Date(o.completedAt).toLocaleString()}</div>}
                      </div>
                    </div>
                  )}
                  {!o.driverId && (
                    <>
                      <div>{o.driverId ? t('dashboard.driverArriveTime') : t('dashboard.timeScheduled')}: {new Date(o.pickupAt).toLocaleString()}</div>
                      <div className="rd-text-muted" style={{ fontSize: '0.875rem' }}>{o.pickupAddress}{getOrderStops(o).length > 0 ? ` → ${getOrderStops(o).map((s) => s.address).join(' → ')} → ` : ' → '}{o.dropoffAddress}</div>
                    </>
                  )}
                  {isDriver && o.status === 'COMPLETED' && o.leftPickupAt && o.completedAt && (
                    <div className="dashboard-completed-trip-info">
                      <div className="rd-section-title" style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{t('dashboard.tripInfo')}</div>
                      <div className="stat-row"><span>{t('dashboard.tripDuration')}</span><span><strong>{Math.round((new Date(o.completedAt).getTime() - new Date(o.leftPickupAt).getTime()) / 60_000)} min</strong></span></div>
                      <div className="rd-text-muted" style={{ fontSize: '0.875rem' }}>{o.pickupAddress} → {o.dropoffAddress}</div>
                      {o.arrivedAtPickupAt && <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.timeArrived')}: {new Date(o.arrivedAtPickupAt).toLocaleString()}</div>}
                      <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.timePickedUp')}: {new Date(o.leftPickupAt).toLocaleString()}</div>
                      <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.timeDroppedOff')}: {new Date(o.completedAt).toLocaleString()}</div>
                      {(o.waitChargeAtPickupCents ?? 0) > 0 && <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.waitChargePickup')}: ${(o.waitChargeAtPickupCents! / 100).toFixed(0)}</div>}
                      {(o.waitChargeAtMiddleCents ?? 0) > 0 && <div className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.waitChargeSecond')}: ${(o.waitChargeAtMiddleCents! / 100).toFixed(0)}</div>}
                    </div>
                  )}
                  {o.status === 'IN_PROGRESS' && o.startedAt && (
                    <div className="dashboard-order-duration">
                      {t('dashboard.duration')}: <strong>{formatDuration(o.startedAt)}</strong>
                    </div>
                  )}
                  {!o.driverId && (
                    <div className="rd-text-muted">
                      {getOrderStops(o).length > 0
                        ? `${o.pickupAddress} → ${getOrderStops(o).map((s) => s.address).join(' → ')} → ${o.dropoffAddress}`
                        : `${o.pickupAddress} → ${o.dropoffAddress}`}
                      {o.routeType && (
                        <span className="rd-badge rd-badge-pending" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                          {o.routeType === 'LONG' ? t('dashboard.routeLong') : t('dashboard.routeLocal')}
                        </span>
                      )}
                    </div>
                  )}
                  {isDriver && o.status === 'ASSIGNED' && !o.arrivedAtPickupAt && (
                    <button type="button" className="rd-btn rd-btn-success" disabled={!!arrivingId} onClick={() => handleArrivedAtPickup(o.id)}>
                      {arrivingId === o.id ? '…' : t('dashboard.arrivedAtPickup')}
                    </button>
                  )}
                  {isDriver && o.arrivedAtPickupAt && (() => {
                    const totalMin = getTotalWaitMinutes(o.arrivedAtPickupAt!, o.leftPickupAt ?? null);
                    void now;
                    const ended = !!o.leftPickupAt;
                    const charge = (o.waitChargeAtPickupCents ?? 0) / 100;
                    return (
                      <div className="dashboard-wait-timer-card">
                        <div className="dashboard-wait-timer-card__title">{t('dashboard.waitTimerTitlePickup')}</div>
                        <div className="dashboard-wait-timer-card__row">
                          <span className="rd-text-muted">{t('dashboard.waitTimerStarted')}:</span>
                          <span>{new Date(o.arrivedAtPickupAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {ended ? (
                          <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--result">
                            <span>{t('dashboard.waitTimerEnded')}</span>
                            <span>{t('dashboard.waitTimerWaited', { min: totalMin })}</span>
                            <span>{charge > 0 ? `$${charge.toFixed(0)}` : t('dashboard.waitTimerNoCharge')}</span>
                          </div>
                        ) : (
                          <>
                            <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--live">
                              <span>{t('dashboard.waitTimerWaiting')}:</span>
                              <strong>{totalMin} min</strong>
                            </div>
                            {totalMin < 5 && (
                              <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerStartsIn', { min: 5 - totalMin })}</div>
                            )}
                            {totalMin >= 5 && totalMin < 20 && (
                              <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerFirst5Free')}</div>
                            )}
                            {totalMin >= 20 && (
                              <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerChargeFrom20')}: <strong>${getWaitChargeDollars(totalMin)}</strong></div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {isDriver && o.tripType === 'ROUNDTRIP' && o.status === 'IN_PROGRESS' && o.leftPickupAt && !o.arrivedAtMiddleAt && (
                    <button type="button" className="rd-btn" disabled={!!arrivingId} onClick={() => handleArrivedAtMiddle(o.id)}>
                      {arrivingId === o.id ? '…' : t('dashboard.arrivedAtSecondStop')}
                    </button>
                  )}
                  {isDriver && o.tripType === 'ROUNDTRIP' && o.arrivedAtMiddleAt && (() => {
                    const totalMin = getTotalWaitMinutes(o.arrivedAtMiddleAt!, o.leftMiddleAt ?? null);
                    void now;
                    const ended = !!o.leftMiddleAt;
                    const charge = (o.waitChargeAtMiddleCents ?? 0) / 100;
                    return (
                      <div className="dashboard-wait-timer-card dashboard-wait-timer-card--second">
                        <div className="dashboard-wait-timer-card__title">{t('dashboard.waitTimerTitleSecond')}</div>
                        <div className="dashboard-wait-timer-card__row">
                          <span className="rd-text-muted">{t('dashboard.waitTimerStarted')}:</span>
                          <span>{new Date(o.arrivedAtMiddleAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {ended ? (
                          <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--result">
                            <span>{t('dashboard.waitTimerEnded')}</span>
                            <span>{t('dashboard.waitTimerWaited', { min: totalMin })}</span>
                            <span>{charge > 0 ? `$${charge.toFixed(0)}` : t('dashboard.waitTimerNoCharge')}</span>
                          </div>
                        ) : (
                          <>
                            <div className="dashboard-wait-timer-card__row dashboard-wait-timer-card__row--live">
                              <span>{t('dashboard.waitTimerWaiting')}:</span>
                              <strong>{totalMin} min</strong>
                            </div>
                            {totalMin < 5 && (
                              <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerStartsIn', { min: 5 - totalMin })}</div>
                            )}
                            {totalMin >= 5 && totalMin < 20 && (
                              <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerFirst5Free')}</div>
                            )}
                            {totalMin >= 20 && (
                              <div className="dashboard-wait-timer-card__note">{t('dashboard.waitTimerChargeFrom20')}: <strong>${getWaitChargeDollars(totalMin)}</strong></div>
                            )}
                            <button type="button" className="rd-btn rd-btn-primary dashboard-wait-timer-card__btn" disabled={!!leftMiddleId} onClick={() => handleLeftMiddle(o.id)}>
                              {leftMiddleId === o.id ? '…' : t('dashboard.startToFinal')}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {canAssign && (
                    <div className="dashboard-order-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <button type="button" className="rd-btn" onClick={() => {
                        const next = selectedOrderId === o.id ? null : o.id;
                        setSelectedOrderId(next);
                        if (next && (!o.driverId || o.riskLevel === 'HIGH' || o.riskLevel === 'MEDIUM')) setMapCenterTrigger((n) => n + 1);
                      }}>
                        {t('dashboard.showOnMap')}
                      </button>
                      <button type="button" className="rd-btn" onClick={() => { setSelectedOrderId(o.id); setMapCenterTrigger((n) => n + 1); }}>
                        {t('dashboard.centerOnMap')}
                      </button>
                      {canAssign && (
                        <button type="button" className="rd-btn rd-btn-primary" onClick={() => { setSelectedOrderId(o.id); setFocusMode(true); setMapCenterTrigger((n) => n + 1); }}>
                          {t('dashboard.focusMode')}
                        </button>
                      )}
                      <button type="button" className="rd-btn" onClick={() => loadDriverEtasForOrder(o.id)}>
                        {t('dashboard.checkEta')}
                      </button>
                    </div>
                  )}
                  {canAssign && (o.status === 'SCHEDULED' && !o.driverId || o.status === 'ASSIGNED') && (() => {
                        const baseList = driverEtas[o.id]?.drivers
                          ? driverEtas[o.id].drivers.map((e) => drivers.find((u) => u.id === e.id)).filter((u): u is User => u != null)
                          : (o.preferredCarType?.trim() ? drivers.filter((d) => (d as { carType?: string | null }).carType === o.preferredCarType!.trim().toUpperCase()) : drivers);
                        const searchQ = (driverAssignSearch[o.id] ?? '').trim();
                        const filteredDrivers = searchQ ? baseList.filter((d) => driverMatchesSearch(d, searchQ)) : baseList;
                        const best = driverEtas[o.id]?.drivers?.[0];
                        const bestDriver = best ? drivers.find((d) => d.id === best.id) : null;
                        return (
                          <div className="dashboard-order-assign" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                            <label htmlFor={`driver-${o.id}`} className="dashboard-order-assign-label" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {o.status === 'ASSIGNED' ? t('dashboard.swapDriver') : t('dashboard.assignDriver')}
                            </label>
                            {o.status === 'SCHEDULED' && best && (
                              <button
                                type="button"
                                className="rd-text-muted"
                                style={{ fontSize: '0.8125rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                                onClick={() => bestDriver && setSelectedDriverDetail({ orderId: o.id, driver: bestDriver })}
                                title={t('dashboard.driverInfoClick')}
                              >
                                {t('dashboard.bestDriverSuggestionWithId', {
                                  name: best.nickname,
                                  id: bestDriver ? (bestDriver as User).driverId ?? best.id : best.id,
                                  min: Math.round(Number(best.etaMinutesToPickup) || 0),
                                })}
                              </button>
                            )}
                            <input
                              type="text"
                              className="rd-input"
                              placeholder={t('dashboard.searchDriverByCarIdOrPhone')}
                              value={driverAssignSearch[o.id] ?? ''}
                              onChange={(e) => setDriverAssignSearch((prev) => ({ ...prev, [o.id]: e.target.value }))}
                              style={{ width: '100%', maxWidth: 320 }}
                              aria-label={t('dashboard.searchDriverByCarIdOrPhone')}
                            />
                            <select
                              className="rd-input"
                              id={`driver-${o.id}`}
                              onFocus={() => loadDriverEtasForOrder(o.id)}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v) handleAssign(o.id, v);
                              }}
                              aria-label={o.status === 'ASSIGNED' ? t('dashboard.swapDriver') : t('dashboard.assignDriver')}
                            >
                              <option value="">{filteredDrivers.length === 0 ? t('dashboard.noDriversToAssign') : (o.status === 'ASSIGNED' ? t('dashboard.swapDriver') : t('dashboard.selectDriver'))}</option>
                              {filteredDrivers.map((d) => {
                                const eta = driverEtas[o.id]?.drivers?.find((x) => x.id === d.id);
                                const toPickup = Math.round(Number(eta?.etaMinutesToPickup) || 0);
                                const total = Math.round(Number(eta?.etaMinutesTotal) || 0);
                                const did = (d as User).driverId ?? d.id;
                                const label = eta
                                  ? `${did} · ${d.nickname} — ETA ${toPickup} min to pickup, ${total} min total`
                                  : `${did} · ${d.nickname}${d.phone ? ` — ${d.phone}` : ''}`;
                                return (
                                  <option key={d.id} value={d.id}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                type="text"
                                className="rd-input"
                                placeholder={t('dashboard.driverIdOrPhone')}
                                value={driverAssignByIdInput[o.id] ?? ''}
                                onChange={(e) => setDriverAssignByIdInput((prev) => ({ ...prev, [o.id]: e.target.value }))}
                                style={{ width: 120 }}
                                aria-label={t('dashboard.driverIdOrPhone')}
                              />
                              <button
                                type="button"
                                className="rd-btn rd-btn--small"
                                disabled={!!assigningId || !(driverAssignByIdInput[o.id] ?? '').trim()}
                                onClick={() => {
                                  const v = driverAssignByIdInput[o.id] ?? '';
                                  const found = findDriverByIdOrPhone(v);
                                  if (found) {
                                    handleAssign(o.id, found.id);
                                    setDriverAssignByIdInput((prev) => ({ ...prev, [o.id]: '' }));
                                  } else if (v.trim()) {
                                    toast.error(t('dashboard.driverNotFoundByIdOrPhone'));
                                  }
                                }}
                              >
                                {assigningId === o.id ? '…' : t('dashboard.assignById')}
                              </button>
                            </div>
                            {drivers.length === 0 && o.status === 'SCHEDULED' && !o.driverId && (
                              <span className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>{t('dashboard.noDriversToAssignHint')}</span>
                            )}
                            {assigningId === o.id && <span className="rd-text-muted">…</span>}
                          </div>
                        );
                      })()}
                  {canAssign && (o.status === 'SCHEDULED' || o.status === 'ASSIGNED') && (o.riskLevel === 'HIGH' || o.riskLevel === 'MEDIUM') && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <button type="button" className="rd-btn rd-btn-secondary" disabled={!!delayOrderingId} onClick={() => handleDelayOrder(o.id, 5)}>
                        {delayOrderingId === o.id ? '…' : t('dashboard.delayMinutes', { min: 5 })}
                      </button>
                      <button type="button" className="rd-btn rd-btn-secondary" disabled={!!delayOrderingId} onClick={() => handleDelayOrder(o.id, 10)}>
                        {delayOrderingId === o.id ? '…' : t('dashboard.delayMinutes', { min: 10 })}
                      </button>
                      <button type="button" className="rd-btn" title={o.manualAssignment ? t('dashboard.unmarkManual') : t('dashboard.markManual')} disabled={!!manualUpdatingId} onClick={() => handleSetManual(o.id, !o.manualAssignment)}>
                        {manualUpdatingId === o.id ? '…' : (o.manualAssignment ? t('dashboard.unmarkManual') : t('dashboard.markManual'))}
                      </button>
                    </div>
                  )}
                  {isDriver && o.driverId === user?.id && (
                    <div className="rd-text-muted">{t('dashboard.yourAssignment')}</div>
                  )}
                  {canChangeStatus && o.status === 'ASSIGNED' && (
                    <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(o.id, 'IN_PROGRESS')}>
                      {statusUpdatingId === o.id ? '…' : (o.arrivedAtPickupAt ? t('dashboard.startRide') : t('dashboard.accept'))}
                    </button>
                  )}
                  {canChangeStatus && o.status === 'IN_PROGRESS' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => (isDriver && o.driverId === user?.id ? setConfirmEndTripOrderId(o.id) : handleStatusChange(o.id, 'COMPLETED'))}>
                        {statusUpdatingId === o.id ? '…' : t('dashboard.complete')}
                      </button>
                      <button type="button" className="rd-btn rd-btn-danger" disabled={!!stopUnderwayId || !!statusUpdatingId} onClick={() => handleStopUnderway(o.id)} title={t('dashboard.stopUnderwayHint')}>
                        {stopUnderwayId === o.id ? '…' : t('dashboard.stopUnderway')}
                      </button>
                    </div>
                  )}
                  {canAssign && (
                    <button type="button" className="rd-btn rd-btn-danger" disabled={!!deletingId} style={{ marginTop: '0.25rem' }} onClick={() => setDeleteConfirmOrderId(o.id)}>
                      {deletingId === o.id ? '…' : t('dashboard.delete')}
                    </button>
                  )}
                </li>
              ))}
              </ul>
            </>
          )}
        </aside>
        <div className="dashboard-page__map rd-map-container" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!isDriver && selectedOrderId && routeData && (routeData.polyline || (routeData.alternativeRoutes?.length ?? 0) > 0) && (
            <div className="dashboard-route-selector" style={{ padding: '0.5rem 0.75rem', background: 'var(--rd-bg-panel)', borderBottom: '1px solid var(--rd-border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              <strong style={{ marginRight: '0.25rem' }}>{t('dashboard.chosenRoute')}:</strong>
              {[null, ...(routeData.alternativeRoutes ?? [])].map((alt, i) => (
                <button key={i} type="button" className={`rd-btn ${selectedRouteIndex === i ? 'rd-btn-primary' : ''}`} onClick={() => setSelectedRouteIndex(i)}>
                  {i === 0 ? t('dashboard.routeMain') : `${t('dashboard.routeAlt')} ${i}`} ({alt ? alt.durationMinutes : (routeData.durationMinutes ?? 0)} min)
                </button>
              ))}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <OrdersMap
            drivers={isDriver ? [] : driversForMap}
            showDriverMarkers={canAssign}
            routeData={routeData}
            currentUserLocation={isDriver ? driverLocation : undefined}
            driverMarkerStyle={isDriver ? driverMapIcon : undefined}
            currentUserSpeedMph={isDriver ? driverSpeedMph : undefined}
            currentUserHeadingTo={isDriver ? driverHeadingTo ?? undefined : undefined}
            onMapClick={canCreateOrder && showForm && pickMode ? handleMapClick : undefined}
            pickPoint={canCreateOrder && showForm ? pickPoint : undefined}
            navMode={isDriver && !!routeData && !!driverLocation}
            centerTrigger={mapCenterTrigger}
            reports={isDriver ? [] : reports}
            selectedRouteIndex={selectedRouteIndex}
            onRecenter={() => setMapCenterTrigger((t) => t + 1)}
            recenterLabel={t('dashboard.recenter')}
            orderRiskLevel={selectedOrderId ? (orders.find((x) => x.id === selectedOrderId)?.riskLevel ?? null) : null}
            selectedOrderTooltip={selectedOrderTooltip}
            futureOrderPickups={canAssign ? futureOrderCoords.filter((f) => f.orderId !== selectedOrderId).map((f) => ({ orderId: f.orderId, lat: f.pickupLat, lng: f.pickupLng, pickupAt: f.pickupAt })) : []}
            problemZones={canAssign && showProblemZones && problemZones ? problemZones : undefined}
            focusCenter={!isDriver ? myLocationCenter : undefined}
            initialCenter={savedMapView?.center}
            initialZoom={savedMapView?.zoom}
            onMapViewChange={handleMapViewChange}
            myLocationLabel={!isDriver && canAssign ? t('dashboard.myLocation') : undefined}
            onMyLocation={!isDriver && canAssign ? () => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  setMyLocationCenter({ lat, lng });
                  setMapCenterTrigger((t) => t + 1);
                },
                () => {},
                { enableHighAccuracy: true, timeout: 10000 }
              );
            } : undefined}
          />
          {isDriver && currentDriverOrder && (
            <div className="driver-trip-card">
              <div className="driver-trip-card__phase">
                {currentDriverOrder.status === 'ASSIGNED' ? t('dashboard.navToPickup') : t('dashboard.navToDropoff')}
              </div>
              <div className="driver-trip-card__address">
                {currentDriverOrder.status === 'ASSIGNED' ? currentDriverOrder.pickupAddress : currentDriverOrder.dropoffAddress}
              </div>
              {routeData && (routeData.driverToPickupMinutes != null || routeData.durationMinutes != null) && (
                <div className="driver-trip-card__eta">
                  ~{Math.round(currentDriverOrder.status === 'ASSIGNED' ? (routeData.driverToPickupMinutes ?? 0) : (routeData.durationMinutes ?? 0))} min
                </div>
              )}
              {(currentDriverOrder.passenger?.name || currentDriverOrder.passenger?.phone) && (
                <div className="driver-trip-card__passenger">
                  {[currentDriverOrder.passenger?.name, currentDriverOrder.passenger?.phone].filter(Boolean).join(' · ')}
                </div>
              )}
              <div className="driver-trip-card__actions">
                <button type="button" className="rd-btn rd-btn-primary driver-trip-card__navigate" onClick={() => driverNavigateToCurrent(currentDriverOrder)}>
                  {t('dashboard.navigate')}
                </button>
                <button type="button" className="rd-btn" onClick={() => driverNavigateToCurrentWaze(currentDriverOrder)}>
                  Waze
                </button>
                {currentDriverOrder.status === 'ASSIGNED' && (
                  currentDriverOrder.arrivedAtPickupAt ? (
                    <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(currentDriverOrder.id, 'IN_PROGRESS')}>
                      {statusUpdatingId === currentDriverOrder.id ? '…' : t('dashboard.startRide')}
                    </button>
                  ) : (
                    <button type="button" className="rd-btn rd-btn-success" disabled={!!arrivingId} onClick={() => handleArrivedAtPickup(currentDriverOrder.id)}>
                      {arrivingId === currentDriverOrder.id ? '…' : t('dashboard.arrivedAtPickup')}
                    </button>
                  )
                )}
                {currentDriverOrder.status === 'IN_PROGRESS' && (
                  <>
                    <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => setConfirmEndTripOrderId(currentDriverOrder.id)}>
                      {statusUpdatingId === currentDriverOrder.id ? '…' : t('dashboard.complete')}
                    </button>
                    <button type="button" className="rd-btn rd-btn-danger" disabled={!!stopUnderwayId || !!statusUpdatingId} onClick={() => handleStopUnderway(currentDriverOrder.id)} title={t('dashboard.stopUnderwayHint')}>
                      {stopUnderwayId === currentDriverOrder.id ? '…' : t('dashboard.stopUnderway')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
        {confirmEndTripOrderId && (
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-end-trip-title" style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}>
            <div className="rd-panel" style={{ maxWidth: 360, width: '100%' }}>
              <h3 id="confirm-end-trip-title" style={{ margin: '0 0 0.5rem' }}>{t('dashboard.confirmEndTripTitle')}</h3>
              <p className="rd-text-muted" style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 600 }}>
                {t('dashboard.confirmEndTripTimer', { sec: confirmEndTripSecondsLeft })}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => { handleStatusChange(confirmEndTripOrderId, 'COMPLETED'); setConfirmEndTripOrderId(null); }}>
                  {statusUpdatingId === confirmEndTripOrderId ? '…' : t('dashboard.confirmEndTripYes')}
                </button>
                <button type="button" className="rd-btn" onClick={() => setConfirmEndTripOrderId(null)}>
                  {t('dashboard.confirmEndTripNo')}
                </button>
              </div>
            </div>
          </div>
        )}
        {deleteConfirmOrderId && (
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-order-title" style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }} onClick={() => setDeleteConfirmOrderId(null)} onKeyDown={(e) => e.key === 'Escape' && setDeleteConfirmOrderId(null)}>
            <div className="rd-panel" style={{ maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
              <h3 id="confirm-delete-order-title" style={{ margin: '0 0 0.5rem' }}>{t('dashboard.confirmDeleteOrderTitle')}</h3>
              <p className="rd-text-muted" style={{ margin: '0 0 1rem' }}>{t('dashboard.confirmDeleteOrderMessage')}</p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="rd-btn rd-btn-danger" disabled={!!deletingId} onClick={() => deleteConfirmOrderId && handleDelete(deleteConfirmOrderId)}>
                  {deletingId === deleteConfirmOrderId ? '…' : t('common.delete')}
                </button>
                <button type="button" className="rd-btn" onClick={() => setDeleteConfirmOrderId(null)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
        {!isDriver && (
          <aside className="dashboard-page__sidebar dashboard-drivers-sidebar rd-panel">
            <div className="rd-panel-header">
              <h2>{t('dashboard.drivers')}</h2>
            </div>
            <p className="rd-text-muted dashboard-drivers-subtitle">{t('dashboard.driversSubtitle')}</p>
            {canAssign && (
              <>
                <div className="dashboard-drivers-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="search"
                    className="rd-input dashboard-drivers-search"
                    placeholder={t('dashboard.driverSearchPlaceholder')}
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    style={{ minWidth: 140, flex: '1 1 140px' }}
                    aria-label={t('dashboard.driverSearchPlaceholder')}
                  />
                  <select className="rd-input" value={driverStatusFilter} onChange={(e) => setDriverStatusFilter(e.target.value as 'all' | 'active' | 'busy' | 'offline')} style={{ width: 'auto', minWidth: 100 }}>
                    <option value="all">{t('dashboard.driverStatusAll')}</option>
                    <option value="active">{t('dashboard.driverStatusActive')}</option>
                    <option value="busy">{t('dashboard.driverStatusBusy')}</option>
                    <option value="offline">{t('dashboard.driverStatusOffline')}</option>
                  </select>
                  <select className="rd-input" value={driverCarTypeFilter} onChange={(e) => setDriverCarTypeFilter(e.target.value)} style={{ width: 'auto', minWidth: 100 }}>
                    <option value="">{t('dashboard.driverCarAll')}</option>
                    <option value="SEDAN">{t('auth.carType_SEDAN')}</option>
                    <option value="MINIVAN">{t('auth.carType_MINIVAN')}</option>
                    <option value="SUV">{t('auth.carType_SUV')}</option>
                  </select>
                </div>
                <ul className="dashboard-drivers-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {filteredDrivers.length === 0 && <li className="rd-text-muted" style={{ padding: '0.75rem 0' }}>{t('dashboard.noDrivers')}</li>}
                {filteredDrivers.map((d) => {
                  const hasLocation = d.lat != null && d.lng != null;
                  const busy = orders.some((o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'));
                  const notAvailable = d.role === 'DRIVER' && d.available === false;
                  const statusKey = notAvailable ? 'unavailable' : (busy ? 'busy' : (hasLocation ? 'locationOn' : 'offline'));
                  const statusClass = notAvailable ? '' : (busy ? 'rd-badge-warning' : (hasLocation ? 'rd-badge-ok' : ''));
                  const cardMod = notAvailable ? 'dashboard-driver-card--offline' : (busy ? 'dashboard-driver-card--warning' : (hasLocation ? 'dashboard-driver-card--ok' : 'dashboard-driver-card--offline'));
                  const carLabel = d.carType ? t('auth.carType_' + d.carType) : null;
                  return (
                    <li key={d.id} className={`dashboard-driver-card ${cardMod}`}>
                      <div className="dashboard-driver-card__avatar" aria-hidden />
                      <div className="dashboard-driver-card__body">
                        <div className="dashboard-driver-card__row">
                          <strong className="dashboard-driver-card__name">{d.nickname}</strong>
                          <span className={`rd-badge dashboard-driver-card__status ${statusClass}`}>{t(`dashboard.${statusKey}`)}</span>
                        </div>
                        {d.phone && <div className="dashboard-driver-card__line"><span className="dashboard-driver-card__label">{t('drivers.phone')}</span><span>{d.phone}</span></div>}
                        {(carLabel || d.carPlateNumber) && (
                          <div className="dashboard-driver-card__line">
                            <span className="dashboard-driver-card__label">{t('dashboard.car')}</span>
                            <span>{[carLabel, d.carPlateNumber].filter(Boolean).join(' · ')}</span>
                          </div>
                        )}
                        {d.driverId && <div className="dashboard-driver-card__line"><span className="dashboard-driver-card__label">{t('drivers.driverId')}</span><span>{d.driverId}</span></div>}
                        <Link to={`/drivers?open=${d.id}`} className="dashboard-driver-card__link">{t('drivers.viewDetails')}</Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
            <div className="dashboard-alerts-card">
              <h3 className="dashboard-alerts-card__title">{t('dashboard.alerts')}</h3>
              {alerts.length === 0 ? (
                <div className="alert-item rd-text-muted">{t('dashboard.noAlerts')}</div>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="alert-item">
                    {a.type === 'order.assigned' && (
                      <span className="rd-text-muted">
                        {t('dashboard.alertOrderAssigned', { pickup: a.pickupAddress ?? '—' })}
                      </span>
                    )}
                    {a.type === 'order.created' && (
                      <span className="rd-text-muted">
                        {t('dashboard.alertOrderCreated', { pickup: a.pickupAddress ?? '—' })}
                      </span>
                    )}
                    {a.type === 'order.rejected' && (
                      <span className="rd-text-muted">
                        {t('dashboard.alertOrderRejected', { pickup: a.pickupAddress ?? '—' })}
                      </span>
                    )}
                    {a.type === 'order.completed' && (
                      <span className="rd-text-muted">{t('dashboard.alertOrderCompleted')}</span>
                    )}
                    {a.type === 'order.stopped_underway' && (
                      <span className="rd-text-muted">{t('dashboard.alertStoppedUnderway')}</span>
                    )}
                    {a.type === 'reminder_pickup_soon' && (
                      <span className="rd-text-muted">
                        {t('dashboard.alertReminderPickup', {
                          pickup: (a as { pickupAddress?: string }).pickupAddress ?? '—',
                          at: (a as { at?: string }).at
                            ? new Date((a as { at: string }).at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                            : '—',
                        })}
                      </span>
                    )}
                    {a.type === 'cost_limit_exceeded' && (
                      <span className="rd-text-muted">{t('dashboard.alertCostLimitExceeded')}</span>
                    )}
                    {!['order.assigned', 'order.created', 'order.rejected', 'order.completed', 'order.stopped_underway', 'reminder_pickup_soon', 'cost_limit_exceeded'].includes(a.type) && (
                      <span className="rd-text-muted">{a.type}</span>
                    )}
                  </div>
                ))
              )}
              {typeof document !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (user?.role === 'DRIVER' || user?.role === 'ADMIN' || user?.role === 'DISPATCHER') && (
                <p className="rd-text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: 0 }}>{t('dashboard.notificationsHint')}</p>
              )}
            </div>
          </aside>
        )}
        {isDriver && (
          <aside className="dashboard-page__sidebar rd-panel">
            <div className="rd-panel-header" style={{ marginBottom: '0.5rem' }}>
              <h2>{t('dashboard.driverInfo')}</h2>
            </div>
            <div className="dashboard-stats-card" style={{ marginBottom: '1rem' }}>
              <div className="stat-row"><span>{t('auth.nickname')}</span><span>{user?.nickname ?? '—'}</span></div>
              <div className="stat-row"><span>{t('auth.phone')}</span><span>{user?.phone ?? '—'}</span></div>
              <div className="stat-row"><span>{t('auth.carType')}</span><span>{user?.carType ? t('auth.carType_' + user.carType) : '—'}</span></div>
              <div className="stat-row"><span>{t('auth.carPlateNumber')}</span><span>{user?.carPlateNumber ?? '—'}</span></div>
              <div className="stat-row"><span>{t('drivers.driverId')}</span><span>{user?.driverId ?? '—'}</span></div>
            </div>
            <div className="rd-panel-header">
              <h2>{t('dashboard.myStatus')}</h2>
            </div>
            <div className="dashboard-driver-status-compact" style={{ marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {user?.available !== false ? t('dashboard.youAreOnline') : t('dashboard.youAreOffline')}
                {' · '}
                <span className={`rd-ws-pill ${connected ? 'connected' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="rd-ws-dot" />
                  {connected ? t('status.connected') : reconnecting ? t('dashboard.reconnecting') : 'Offline'}
                </span>
              </p>
              <p className="rd-text-muted" style={{ marginTop: '0.25rem', marginBottom: 0, fontSize: '0.8125rem' }}>
                <Link to="/about">{t('dashboard.locationGuideLink')}</Link>
              </p>
            </div>
            <div className="rd-panel-header" style={{ marginTop: '0.5rem' }}>
              <h2>{t('dashboard.driverStats')}</h2>
            </div>
            <div className="dashboard-stats-card">
              <div className="stat-row"><span>{t('dashboard.summary')}</span><span>{orders.filter((o) => o.status === 'COMPLETED').length}</span></div>
              <div className="stat-row"><span>{t('dashboard.todayRides')}</span><span>{orders.filter((o) => o.status === 'IN_PROGRESS' || o.status === 'COMPLETED').length}</span></div>
              <div className="stat-row"><span>{t('dashboard.totalEarned')}</span><span>{driverStats != null ? `$${(driverStats.totalEarningsCents / 100).toFixed(2)}` : '—'}</span></div>
              <div className="stat-row"><span>{t('dashboard.totalMiles')}</span><span>{driverStats != null ? driverStats.totalMiles.toFixed(1) : '—'}</span></div>
            </div>
            <div className="dashboard-alerts-card" style={{ marginTop: '1rem' }}>
              <div className="rd-panel-header" style={{ marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('dashboard.alerts')}</h3>
              </div>
              {alerts.filter((a) => (a.type === 'order.assigned' && a.driverId === user?.id) || (a.type === 'reminder_pickup_soon' && a.driverId === user?.id)).length === 0 ? (
                <div className="alert-item rd-text-muted">{t('dashboard.noAlerts')}</div>
              ) : (
                alerts
                  .filter((a) => (a.type === 'order.assigned' && a.driverId === user?.id) || (a.type === 'reminder_pickup_soon' && a.driverId === user?.id))
                  .slice(0, 10)
                  .map((a) => (
                    <div key={a.id} className="alert-item">
                      {a.type === 'order.assigned' && (
                        <span className="rd-text-muted">{t('dashboard.alertOrderAssigned', { pickup: a.pickupAddress ?? '—' })}</span>
                      )}
                      {a.type === 'reminder_pickup_soon' && (
                        <span className="rd-text-muted">
                          {t('dashboard.alertReminderPickup', {
                            pickup: (a as { pickupAddress?: string }).pickupAddress ?? '—',
                            at: (a as { at?: string }).at ? new Date((a as { at: string }).at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—',
                          })}
                        </span>
                      )}
                    </div>
                  ))
              )}
            </div>
          </aside>
        )}
      </div>
      {selectedDriverDetail && (
        <div className="rd-modal-overlay" role="dialog" aria-modal="true" aria-label={t('dashboard.driverInfoTitle')} tabIndex={0} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelectedDriverDetail(null)} onKeyDown={(e) => e.key === 'Escape' && setSelectedDriverDetail(null)}>
          <div className="rd-panel" style={{ maxWidth: 360, width: '90%', margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.75rem' }}>{t('dashboard.driverInfoTitle')}</h3>
            <div className="dashboard-stats-card" style={{ marginBottom: '0.75rem' }}>
              <div className="stat-row"><span>{t('auth.nickname')}</span><span>{selectedDriverDetail.driver.nickname ?? '—'}</span></div>
              <div className="stat-row"><span>{t('auth.phone')}</span><span>{selectedDriverDetail.driver.phone ?? '—'}</span></div>
              <div className="stat-row"><span>{t('drivers.driverId')}</span><span>{(selectedDriverDetail.driver as User).driverId ?? '—'}</span></div>
              <div className="stat-row"><span>{t('auth.carType')}</span><span>{(selectedDriverDetail.driver as User).carType ? t('auth.carType_' + (selectedDriverDetail.driver as User).carType) : '—'}</span></div>
              <div className="stat-row"><span>{t('auth.carPlateNumber')}</span><span>{(selectedDriverDetail.driver as User).carPlateNumber ?? '—'}</span></div>
              <div className="stat-row"><span>{t('dashboard.userId')}</span><span className="rd-id-compact" title={selectedDriverDetail.driver.id}>{shortId(selectedDriverDetail.driver.id)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="rd-btn rd-btn-primary" onClick={() => { handleAssign(selectedDriverDetail.orderId, selectedDriverDetail.driver.id); setSelectedDriverDetail(null); }} disabled={!!assigningId}>
                {assigningId === selectedDriverDetail.orderId ? '…' : t('dashboard.assignDriver')}
              </button>
              <button type="button" className="rd-btn" onClick={() => setSelectedDriverDetail(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
      {postTripSummary && (
        <div className="rd-modal-overlay" role="dialog" aria-modal="true" aria-label={t('dashboard.tripSummaryTitle')} tabIndex={0} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPostTripSummary(null)} onKeyDown={(e) => e.key === 'Escape' && setPostTripSummary(null)}>
          <div className="rd-panel dashboard-trip-summary-modal" style={{ maxWidth: 440, width: '90%', margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.75rem' }}>{t('dashboard.tripSummaryTitle')}</h3>
            <p className="rd-text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              {postTripSummary.pickupAddress} → {postTripSummary.dropoffAddress}
            </p>
            <div className="dashboard-stats-card" style={{ marginBottom: '0.75rem' }}>
              {postTripSummary.durationMinutes > 0 && (
                <div className="stat-row"><span>{t('dashboard.tripDuration')}</span><span><strong>{Math.round(postTripSummary.durationMinutes)} min</strong></span></div>
              )}
              {postTripSummary.arrivedAtPickupAt && (
                <div className="stat-row"><span>{t('dashboard.timeArrived')}</span><span>{new Date(postTripSummary.arrivedAtPickupAt).toLocaleString()}</span></div>
              )}
              {postTripSummary.leftPickupAt && (
                <div className="stat-row"><span>{t('dashboard.timePickedUp')}</span><span>{new Date(postTripSummary.leftPickupAt).toLocaleString()}</span></div>
              )}
              <div className="stat-row"><span>{t('dashboard.timeDroppedOff')}</span><span>{new Date(postTripSummary.completedAt).toLocaleString()}</span></div>
              {(postTripSummary.waitChargeAtPickupCents ?? 0) > 0 && (
                <div className="stat-row"><span>{t('dashboard.waitChargePickup')}</span><span>${(postTripSummary.waitChargeAtPickupCents! / 100).toFixed(0)}</span></div>
              )}
              {(postTripSummary.waitChargeAtMiddleCents ?? 0) > 0 && (
                <div className="stat-row"><span>{t('dashboard.waitChargeSecond')}</span><span>${(postTripSummary.waitChargeAtMiddleCents! / 100).toFixed(0)}</span></div>
              )}
              <div className="stat-row"><span>{t('dashboard.distance')}</span><span>{(postTripSummary.distanceKm / 1.60934).toFixed(1)} mi</span></div>
              <div className="stat-row"><span>{t('dashboard.earnings')}</span><span>${(postTripSummary.earningsCents / 100).toFixed(2)}</span></div>
            </div>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setPostTripSummary(null)}>{t('dashboard.done')}</button>
          </div>
        </div>
      )}
      {showReportModal && (
        <div className="rd-modal-overlay" role="dialog" aria-modal="true" aria-label={t('dashboard.report')} tabIndex={0} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowReportModal(false)} onKeyDown={(e) => e.key === 'Escape' && setShowReportModal(false)}>
          <div className="rd-panel" style={{ maxWidth: 400, width: '90%', margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.75rem' }}>{t('dashboard.report')}</h3>
            <p className="rd-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{t('dashboard.reportAtLocation')}</p>
            <form onSubmit={handleReportSubmit}>
              <label>{t('dashboard.reportType')}</label>
              <select className="rd-input" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="POLICE">{t('dashboard.reportPolice')}</option>
                <option value="TRAFFIC">{t('dashboard.reportTraffic')}</option>
                <option value="WORK_ZONE">{t('dashboard.reportWorkZone')}</option>
                <option value="CAR_CRASH">{t('dashboard.reportCrash')}</option>
                <option value="OTHER">{t('dashboard.reportOther')}</option>
              </select>
              <label>{t('dashboard.reportDescription')}</label>
              <input type="text" className="rd-input" value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder={t('dashboard.reportDescriptionOptional')} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="rd-btn rd-btn-primary" disabled={reportSubmitting}>{reportSubmitting ? '…' : t('dashboard.submit')}</button>
                <button type="button" className="rd-btn" onClick={() => setShowReportModal(false)}>{t('dashboard.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
