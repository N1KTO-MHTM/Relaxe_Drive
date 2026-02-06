import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../../ws/useSocket';
import { useAuthStore } from '../../store/auth';
import { api } from '../../api/client';
import OrdersMap from '../../components/OrdersMap';
import type { OrderRouteData, DriverForMap, DriverReportMap } from '../../components/OrdersMap';
import NavBar from '../../components/NavBar';
import { useToastStore } from '../../store/toast';
import { downloadCsv } from '../../utils/exportCsv';
import type { Order, DriverEta } from '../../types';
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
}

export default function Dashboard() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket, connected } = useSocket();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToastStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pickupAt, setPickupAt] = useState('');
  const [tripTypeForm, setTripTypeForm] = useState<'ONE_WAY' | 'ROUNDTRIP'>('ONE_WAY');
  const [routeTypeForm, setRouteTypeForm] = useState<'LOCAL' | 'LONG'>('LOCAL');
  const [pickupAddress, setPickupAddress] = useState('');
  const [middleAddress, setMiddleAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [leftMiddleId, setLeftMiddleId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sharingLocation, setSharingLocation] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<OrderRouteData | null>(null);
  const [driverEtas, setDriverEtas] = useState<Record<string, { drivers: DriverEta[] }>>({});
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickMode, setPickMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [pickPoint, setPickPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupType, setPickupType] = useState('');
  const [dropoffType, setDropoffType] = useState('');
  const [reverseGeocodeLoading, setReverseGeocodeLoading] = useState(false);
  const [passengersSuggestions, setPassengersSuggestions] = useState<Array<{ id: string; phone?: string; name: string | null; pickupAddr: string | null; dropoffAddr: string | null; pickupType: string | null; dropoffType: string | null }>>([]);
  const [orderPhone, setOrderPhone] = useState('');
  const [orderPassengerName, setOrderPassengerName] = useState('');
  const [orderTab, setOrderTab] = useState<'active' | 'completed'>('active');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [mapCenterTrigger, setMapCenterTrigger] = useState(0);
  const [alerts, setAlerts] = useState<Array<{ id: string; type: string; orderId?: string; driverId?: string; pickupAddress?: string; at: string }>>([]);
  const [reports, setReports] = useState<DriverReportMap[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [postTripSummary, setPostTripSummary] = useState<{
    pickupAddress: string;
    dropoffAddress: string;
    distanceKm: number;
    durationMinutes: number;
    earningsCents: number;
  } | null>(null);
  const [driverStats, setDriverStats] = useState<{ totalEarningsCents: number; totalMiles: number } | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('TRAFFIC');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);
  const autoStopSentForOrderIdRef = useRef<string | null>(null);

  const canCreateOrder = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const isDriver = user?.role === 'DRIVER';

  useEffect(() => {
    if (orderTab !== 'completed') return;
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
    const list = orderTab === 'active' ? orders : completedOrders;
    let out = orderTab === 'active'
      ? list.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
      : list.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED');
    if (orderStatusFilter) out = out.filter((o) => o.status === orderStatusFilter);
    return out.sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime());
  }, [orders, completedOrders, orderTab, orderStatusFilter]);

  const driversForMap: DriverForMap[] = useMemo(() => drivers.map((d) => ({
    id: d.id,
    nickname: d.nickname,
    phone: d.phone,
    lat: d.lat,
    lng: d.lng,
    status: orders.some((o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS')) ? 'busy' : (d.lat != null && d.lng != null ? 'available' : 'offline'),
  })), [drivers, orders]);

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
  const canAssign = canCreateOrder;
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

  useEffect(() => {
    loadOrders();
  }, [showForm]);

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
      openForm?: boolean;
      passengerPrefill?: { phone?: string; name?: string; pickupAddr?: string; dropoffAddr?: string; pickupType?: string; dropoffType?: string };
    } | null;
    const fromState = state?.createOrderDate;
    const fromUrl = searchParams.get('createOrderDate');
    const date = fromState ?? fromUrl;
    if (date && canCreateOrder) {
      setPickupAt(date + 'T09:00');
      setShowForm(true);
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
    const interval = setInterval(load, 5000); // refresh driver positions for map every 5s
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

  // Auto-select an order so the map shows the route: driver = active order, dispatcher = first order
  useEffect(() => {
    if (isDriver) {
      const active = orders.filter((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
      if (active.length === 0) {
        setSelectedOrderId(null);
        return;
      }
      const first = active.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())[0];
      setSelectedOrderId(first.id);
      return;
    }
    // Dispatcher: show route for first order so map is useful without clicking "Show route"
    if (!canAssign || orders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    const first = [...orders].sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())[0];
    setSelectedOrderId(first.id);
  }, [isDriver, canAssign, orders]);

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
        const pad = 0.02;
        return { minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad, minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad };
      }
      if (driverLocation) {
        const pad = 0.05;
        return { minLat: driverLocation.lat - pad, maxLat: driverLocation.lat + pad, minLng: driverLocation.lng - pad, maxLng: driverLocation.lng + pad };
      }
      return null;
    })();
    if (!bbox) return;
    api.get<DriverReportMap[]>(`/reports?minLat=${bbox.minLat}&maxLat=${bbox.maxLat}&minLng=${bbox.minLng}&maxLng=${bbox.maxLng}&sinceMinutes=120`)
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]));
  }, [routeData?.pickupCoords, routeData?.dropoffCoords, driverLocation?.lat, driverLocation?.lng]);

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

  // Авто-отправка геолокации водителя: при открытом сайте и при возврате на вкладку (в т.ч. если была свёрнута)
  useEffect(() => {
    if (user?.role !== 'DRIVER' || !navigator.geolocation) return;
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setDriverLocation({ lat, lng });
          api.patch('/users/me/location', { lat, lng }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    };
    sendLocation();
    const hasActiveOrder = orders.some((o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS');
    const intervalMs = hasActiveOrder ? 15000 : 45000; // чаще при активном заказе (навигация)
    const interval = setInterval(sendLocation, intervalMs);
    const onVisible = () => { sendLocation(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, user?.role, orders.map((o) => o.status).join(',')]);

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
        setPostTripSummary({
          pickupAddress: order.pickupAddress ?? '',
          dropoffAddress: order.dropoffAddress ?? '',
          distanceKm,
          durationMinutes,
          earningsCents: body.earningsCents ?? 0,
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

  async function handleShareLocation() {
    if (!navigator.geolocation) return;
    setSharingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((ok, err) => {
        navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 10000 });
      });
      await api.patch('/users/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      // ignore
    } finally {
      setSharingLocation(false);
    }
  }

  async function handleDelete(orderId: string) {
    if (!canAssign) return;
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

  async function setAddressFromCoords(lat: number, lng: number, which: 'pickup' | 'dropoff') {
    setReverseGeocodeLoading(true);
    try {
      const res = await api.get<{ address: string | null }>(`/geo/reverse?lat=${lat}&lng=${lng}`);
      const addr = res?.address ?? '';
      if (which === 'pickup') {
        setPickupAddress(addr);
      } else {
        setDropoffAddress(addr);
      }
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
    if (!pickupAt || !pickupAddress.trim() || !dropoffAddress.trim()) {
      setSubmitError('Fill pickup time and addresses');
      return;
    }
    if (isRoundtrip && !middleAddress.trim()) {
      setSubmitError('Roundtrip requires second location');
      return;
    }
    try {
      await api.post('/orders', {
        pickupAt: new Date(pickupAt).toISOString(),
        tripType: tripTypeForm,
        routeType: routeTypeForm,
        pickupAddress: pickupAddress.trim(),
        middleAddress: isRoundtrip ? middleAddress.trim() : undefined,
        dropoffAddress: dropoffAddress.trim(),
        pickupType: pickupType || undefined,
        dropoffType: dropoffType || undefined,
        phone: orderPhone.trim() || undefined,
        passengerName: orderPassengerName.trim() || undefined,
      });
      setPickupAt('');
      setPickupAddress('');
      setMiddleAddress('');
      setDropoffAddress('');
      setOrderPhone('');
      setOrderPassengerName('');
      setPickupType('');
      setDropoffType('');
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
    <div className={`dashboard-page ${isDriver ? 'dashboard-page--driver' : ''}`}>
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
              { key: 'pickupAt', label: t('dashboard.pickupAt') },
              { key: 'pickupAddress', label: t('dashboard.pickupAddress') },
              { key: 'dropoffAddress', label: t('dashboard.dropoffAddress') },
            ]); toast.success(t('toast.exportDone')); }}>
              {t('dashboard.exportCsv')}
            </button>
          )}
          {isDriver && (
            <button type="button" className="rd-btn" disabled={sharingLocation} onClick={handleShareLocation}>
              {sharingLocation ? '…' : t('dashboard.shareLocation')}
            </button>
          )}
          <span className={`rd-ws-pill ${connected ? 'connected' : ''}`}>
            <span className="rd-ws-dot" />
            {connected ? t('status.connected') : 'Offline'}
          </span>
        </div>
      </div>
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
              {routeData.dropoffCoords && (
                <>
                  <button type="button" className="rd-btn" onClick={openInGoogleMaps}>{t('dashboard.openInGoogleMaps')}</button>
                  <button type="button" className="rd-btn" onClick={openInWaze}>{t('dashboard.openInWaze')}</button>
                </>
              )}
            </div>
          </div>
        );
      })()}
      <div className="dashboard-page__grid">
        <aside className="dashboard-page__sidebar rd-panel">
          <div className="rd-panel-header">
            <h2>{ordersTitle}</h2>
            {canCreateOrder && (
              <button type="button" className="rd-btn rd-btn-primary" onClick={() => setShowForm(!showForm)}>
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
              </div>
              <label>{t('dashboard.pickupAt')}</label>
              <input type="datetime-local" className="rd-input" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} required />
              <label>{tripTypeForm === 'ROUNDTRIP' ? t('dashboard.firstLocation') : t('dashboard.pickupAddress')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" className="rd-input" style={{ flex: '1 1 200px' }} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder={t('dashboard.addressPlaceholder')} required />
                <button type="button" className="rd-btn" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => m === 'pickup' ? null : 'pickup')}>
                  {pickMode === 'pickup' ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                </button>
                <button type="button" className="rd-btn" disabled={!!reverseGeocodeLoading} onClick={() => handleUseMyLocation('pickup')}>
                  {t('dashboard.useMyLocation')}
                </button>
              </div>
              <div className="dashboard-form-row dashboard-form-row--two">
                <div>
                  <label>{t('dashboard.placeType')} (pickup)</label>
                  <select className="rd-input" value={pickupType} onChange={(e) => setPickupType(e.target.value)}>
                    {PLACE_TYPES.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{t('dashboard.placeType')} (dropoff)</label>
                  <select className="rd-input" value={dropoffType} onChange={(e) => setDropoffType(e.target.value)}>
                    {PLACE_TYPES.map((opt) => (
                      <option key={opt.value || 'none'} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {tripTypeForm === 'ROUNDTRIP' && (
                <>
                  <label>{t('dashboard.secondLocation')}</label>
                  <input type="text" className="rd-input" value={middleAddress} onChange={(e) => setMiddleAddress(e.target.value)} placeholder={t('dashboard.secondLocation')} required={tripTypeForm === 'ROUNDTRIP'} />
                </>
              )}
              <label>{tripTypeForm === 'ROUNDTRIP' ? t('dashboard.finalLocation') : t('dashboard.dropoffAddress')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" className="rd-input" style={{ flex: '1 1 200px' }} value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} placeholder={t('dashboard.addressPlaceholder')} required />
                <button type="button" className="rd-btn" disabled={!!reverseGeocodeLoading} onClick={() => setPickMode((m) => m === 'dropoff' ? null : 'dropoff')}>
                  {pickMode === 'dropoff' ? t('dashboard.cancelPick') : t('dashboard.pickOnMap')}
                </button>
                <button type="button" className="rd-btn" disabled={!!reverseGeocodeLoading} onClick={() => handleUseMyLocation('dropoff')}>
                  {t('dashboard.useMyLocation')}
                </button>
              </div>
              {reverseGeocodeLoading && <p className="rd-text-muted">{t('dashboard.detectingAddress')}</p>}
              {pickMode && <p className="rd-text-muted">{pickMode === 'pickup' ? t('dashboard.clickMapPickup') : t('dashboard.clickMapDropoff')}</p>}
              {submitError && <p className="rd-text-critical">{submitError}</p>}
              <button type="submit" className="rd-btn rd-btn-primary">{t('dashboard.createOrder')}</button>
            </form>
                </>
              )}
              {!showForm && canCreateOrder && (
                <button type="button" className="dashboard-order-form-toggle dashboard-order-form-toggle--closed" onClick={() => setShowForm(true)} aria-expanded="false">
                  <span>{t('dashboard.newOrderForm')}</span>
                  <span className="dashboard-order-form-chevron" aria-hidden>▼</span>
                </button>
              )}
            </div>
          )}
          <div className="dashboard-order-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className={`rd-btn ${orderTab === 'active' ? 'rd-btn-primary' : ''}`} onClick={() => setOrderTab('active')}>
              {t('dashboard.tabActive')}
            </button>
            <button type="button" className={`rd-btn ${orderTab === 'completed' ? 'rd-btn-primary' : ''}`} onClick={() => setOrderTab('completed')}>
              {isDriver ? t('dashboard.tabMyCompleted') : t('dashboard.tabCompleted')}
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
            <button type="button" className="rd-btn rd-btn-secondary" onClick={() => { if (orderTab === 'completed') { setCompletedLoading(true); const to = new Date(); const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); api.get<Order[]>(`/orders?from=${from.toISOString()}&to=${to.toISOString()}`).then((data) => { const list = Array.isArray(data) ? data : []; setCompletedOrders(isDriver ? list.filter((o) => o.driverId === user?.id) : list); }).catch(() => setCompletedOrders([])).finally(() => setCompletedLoading(false)); } else loadOrders(); }} disabled={loading || (orderTab === 'completed' && completedLoading)}>
              {t('common.refresh')}
            </button>
          </div>
          {(loading || (orderTab === 'completed' && completedLoading)) ? (
            <p className="rd-text-muted">{t('common.loading')}</p>
          ) : filteredOrders.length === 0 ? (
            <>
              <p className="rd-text-muted">{orderTab === 'completed' ? t('dashboard.noCompletedOrders') : emptyMessage}</p>
              {isDriver && orderTab === 'active' && filteredOrders.length === 0 && t('dashboard.noMyOrdersHint') && (
                <p className="rd-text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>{t('dashboard.noMyOrdersHint')}</p>
              )}
            </>
          ) : (
            <>
              {!isDriver && <h3 className="rd-section-title">{orderTab === 'active' ? t('dashboard.activeOrders') : t('dashboard.completedOrders')}</h3>}
              <ul className="dashboard-orders-list">
              {filteredOrders.map((o) => (
                <li key={o.id} className="dashboard-order-item">
                  <span className={`rd-badge ${o.status === 'ASSIGNED' ? 'rd-badge-assigned' : o.status === 'IN_PROGRESS' ? 'rd-badge-ok' : o.status === 'SCHEDULED' ? 'rd-badge-pending' : ''}`}>{o.status}</span>
                  <div>{t('dashboard.orderCreated')}: {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</div>
                  {(o.driverId || driverEtas[o.id]) && (
                    <div>{t('dashboard.pickupAt')}: {new Date(o.pickupAt).toLocaleString()}</div>
                  )}
                  {o.status === 'IN_PROGRESS' && o.startedAt && (
                    <div className="dashboard-order-duration">
                      {t('dashboard.duration')}: <strong>{formatDuration(o.startedAt)}</strong>
                    </div>
                  )}
                  <div className="rd-text-muted">
                    {o.tripType === 'ROUNDTRIP' && o.middleAddress
                      ? `${o.pickupAddress} → ${o.middleAddress} → ${o.dropoffAddress}`
                      : `${o.pickupAddress} → ${o.dropoffAddress}`}
                    {o.routeType && (
                      <span className="rd-badge rd-badge-pending" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                        {o.routeType === 'LONG' ? t('dashboard.routeLong') : t('dashboard.routeLocal')}
                      </span>
                    )}
                  </div>
                  {isDriver && o.status === 'ASSIGNED' && !o.arrivedAtPickupAt && (
                    <button type="button" className="rd-btn rd-btn-success" disabled={!!arrivingId} onClick={() => handleArrivedAtPickup(o.id)}>
                      {arrivingId === o.id ? '…' : t('dashboard.arrivedAtPickup')}
                    </button>
                  )}
                  {isDriver && o.status === 'ASSIGNED' && o.arrivedAtPickupAt && !o.leftPickupAt && (() => {
                    const totalMin = getTotalWaitMinutes(o.arrivedAtPickupAt!, null);
                    void now; // tick so timer updates every second
                    const showTimer = totalMin >= 5;
                    return (
                      <div className="dashboard-wait-block">
                        {showTimer && (
                          <p className="rd-text-muted">
                            {t('dashboard.waitingAtPickup')}: <strong>{totalMin} min</strong>
                            {totalMin >= 20 && (
                              <> — {t('dashboard.chargeAfter5')}: <strong>${getWaitChargeDollars(totalMin)}</strong></>
                            )}
                          </p>
                        )}
                        {!showTimer && totalMin > 0 && (
                          <p className="rd-text-muted">{t('dashboard.waitTimerStartsIn', { min: 5 - totalMin })}</p>
                        )}
                      </div>
                    );
                  })()}
                  {isDriver && o.status === 'IN_PROGRESS' && o.leftPickupAt && o.arrivedAtPickupAt && o.waitChargeAtPickupCents != null && o.waitChargeAtPickupCents > 0 && (
                    <p className="rd-text-muted dashboard-wait-note">
                      {t('dashboard.waitedAtPickupNote', {
                        min: getTotalWaitMinutes(o.arrivedAtPickupAt, o.leftPickupAt),
                        amount: (o.waitChargeAtPickupCents / 100).toFixed(0),
                      })}
                    </p>
                  )}
                  {isDriver && o.tripType === 'ROUNDTRIP' && o.status === 'IN_PROGRESS' && o.leftPickupAt && !o.arrivedAtMiddleAt && (
                    <button type="button" className="rd-btn" disabled={!!arrivingId} onClick={() => handleArrivedAtMiddle(o.id)}>
                      {arrivingId === o.id ? '…' : t('dashboard.arrivedAtSecondStop')}
                    </button>
                  )}
                  {isDriver && o.tripType === 'ROUNDTRIP' && o.status === 'IN_PROGRESS' && o.arrivedAtMiddleAt && !o.leftMiddleAt && (() => {
                    const totalMin = getTotalWaitMinutes(o.arrivedAtMiddleAt!, null);
                    void now; // tick
                    const showTimer = totalMin >= 5;
                    return (
                      <div className="dashboard-wait-block">
                        {showTimer && (
                          <p className="rd-text-muted">
                            {t('dashboard.waitingAtSecondStop')}: <strong>{totalMin} min</strong>
                            {totalMin >= 20 && (
                              <> — {t('dashboard.chargeAfter5')}: <strong>${getWaitChargeDollars(totalMin)}</strong></>
                            )}
                          </p>
                        )}
                        <button type="button" className="rd-btn rd-btn-primary" disabled={!!leftMiddleId} onClick={() => handleLeftMiddle(o.id)}>
                          {leftMiddleId === o.id ? '…' : t('dashboard.startToFinal')}
                        </button>
                      </div>
                    );
                  })()}
                  {isDriver && o.tripType === 'ROUNDTRIP' && o.leftMiddleAt && o.arrivedAtMiddleAt && o.waitChargeAtMiddleCents != null && o.waitChargeAtMiddleCents > 0 && (
                    <p className="rd-text-muted dashboard-wait-note">
                      {t('dashboard.waitedAtSecondNote', { amount: (o.waitChargeAtMiddleCents / 100).toFixed(0) })}
                    </p>
                  )}
                  {canAssign && (
                    <div className="dashboard-order-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <button type="button" className="rd-btn" onClick={() => setSelectedOrderId((id) => id === o.id ? null : o.id)}>
                        {t('dashboard.showOnMap')}
                      </button>
                      <button type="button" className="rd-btn" onClick={() => { setSelectedOrderId(o.id); setMapCenterTrigger((n) => n + 1); }}>
                        {t('dashboard.centerOnMap')}
                      </button>
                      <button type="button" className="rd-btn" onClick={() => loadDriverEtasForOrder(o.id)}>
                        {t('dashboard.checkEta')}
                      </button>
                    </div>
                  )}
                  {canAssign && o.status === 'SCHEDULED' && !o.driverId && (
                    <div className="dashboard-order-assign" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                      {(driverEtas[o.id]?.drivers?.length ?? 0) > 0 && (() => {
                        const best = driverEtas[o.id]!.drivers[0];
                        return (
                          <span className="rd-text-muted" style={{ fontSize: '0.8125rem' }}>
                            {t('dashboard.bestDriverSuggestion', { name: best.nickname, min: best.etaMinutesToPickup })}
                          </span>
                        );
                      })()}
                      <select
                        className="rd-input"
                        id={`driver-${o.id}`}
                        onFocus={() => loadDriverEtasForOrder(o.id)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) handleAssign(o.id, v);
                        }}
                      >
                        <option value="">{t('dashboard.assignDriver')}</option>
                        {(driverEtas[o.id]?.drivers ?? drivers).map((d) => {
                          const eta = driverEtas[o.id]?.drivers?.find((x) => x.id === d.id);
                          const label = eta
                            ? `${d.nickname} — ETA ${eta.etaMinutesToPickup} min to pickup, ${eta.etaMinutesTotal} min total`
                            : `${d.nickname}${d.phone ? ` — ${d.phone}` : ''}`;
                          return (
                            <option key={d.id} value={d.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      {assigningId === o.id && <span className="rd-text-muted">…</span>}
                    </div>
                  )}
                  {o.driverId && (() => {
                      if (isDriver && o.driverId === user?.id) {
                        return <div className="rd-text-muted">{t('dashboard.yourAssignment')}</div>;
                      }
                      const driver = drivers.find((d) => d.id === o.driverId);
                      return (
                        <div className="rd-text-muted">
                          {t('dashboard.assigned')}{driver ? `: ${driver.nickname}${driver.phone ? ` (${driver.phone})` : ''}` : ''}
                        </div>
                      );
                    })()}
                  {canChangeStatus && o.status === 'ASSIGNED' && (
                    <button type="button" className="rd-btn" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(o.id, 'IN_PROGRESS')}>
                      {statusUpdatingId === o.id ? '…' : (o.arrivedAtPickupAt ? t('dashboard.startRide') : t('dashboard.accept'))}
                    </button>
                  )}
                  {canChangeStatus && o.status === 'IN_PROGRESS' && (
                    <button type="button" className="rd-btn rd-btn-primary" disabled={!!statusUpdatingId} onClick={() => handleStatusChange(o.id, 'COMPLETED')}>
                      {statusUpdatingId === o.id ? '…' : t('dashboard.complete')}
                    </button>
                  )}
                  {canAssign && (
                    <button type="button" className="rd-btn rd-btn-danger" disabled={!!deletingId} style={{ marginTop: '0.25rem' }} onClick={() => handleDelete(o.id)}>
                      {deletingId === o.id ? '…' : t('dashboard.delete')}
                    </button>
                  )}
                </li>
              ))}
              </ul>
            </>
          )}
        </aside>
        <div className="dashboard-page__map rd-map-container">
          <OrdersMap
            drivers={isDriver ? [] : driversForMap}
            showDriverMarkers={canAssign}
            routeData={routeData}
            currentUserLocation={isDriver ? driverLocation : undefined}
            onMapClick={canCreateOrder && showForm && pickMode ? handleMapClick : undefined}
            pickPoint={canCreateOrder && showForm ? pickPoint : undefined}
            navMode={isDriver && !!routeData && !!driverLocation}
            centerTrigger={mapCenterTrigger}
            reports={reports}
            selectedRouteIndex={selectedRouteIndex}
            onRecenter={() => setMapCenterTrigger((t) => t + 1)}
            recenterLabel={t('dashboard.recenter')}
          />
        </div>
        {!isDriver && (
          <aside className="dashboard-page__sidebar rd-panel">
            <div className="rd-panel-header">
              <h2>{t('dashboard.drivers')}</h2>
            </div>
            <p className="rd-text-muted">{t('dashboard.driversSubtitle')}</p>
            {canAssign && (
              <ul className="dashboard-drivers-list" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                {drivers.length === 0 && <li className="rd-text-muted">{t('dashboard.noDrivers')}</li>}
                {drivers.map((d) => {
                  const hasLocation = d.lat != null && d.lng != null;
                  const busy = orders.some((o) => o.driverId === d.id && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS'));
                  const notAvailable = d.role === 'DRIVER' && d.available === false;
                  const statusKey = notAvailable ? 'unavailable' : (busy ? 'busy' : (hasLocation ? 'locationOn' : 'offline'));
                  const statusClass = notAvailable ? '' : (busy ? 'rd-badge-warning' : (hasLocation ? 'rd-badge-ok' : ''));
                  const cardMod = notAvailable ? 'dashboard-driver-card--offline' : (busy ? 'dashboard-driver-card--warning' : (hasLocation ? 'dashboard-driver-card--ok' : 'dashboard-driver-card--offline'));
                  return (
                    <li key={d.id} className={`dashboard-driver-card ${cardMod}`}>
                      <div className="dashboard-driver-card__avatar" aria-hidden />
                      <div className="dashboard-driver-card__body">
                        <strong>{d.nickname}</strong>
                        {d.phone && <div className="rd-text-muted dashboard-driver-card__phone">{d.phone}</div>}
                        <span className={`rd-badge ${statusClass}`}>{t(`dashboard.${statusKey}`)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="dashboard-alerts-card" style={{ marginTop: '1rem' }}>
              <div className="rd-panel-header" style={{ marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('dashboard.alerts')}</h3>
              </div>
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
                    {!['order.assigned', 'order.created', 'order.rejected', 'order.completed', 'reminder_pickup_soon', 'cost_limit_exceeded'].includes(a.type) && (
                      <span className="rd-text-muted">{a.type}</span>
                    )}
                  </div>
                ))
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
            <label className="dashboard-available-toggle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={user?.available !== false}
                onChange={(e) => {
                  const next = e.target.checked;
                  api.patch('/users/me/available', { available: next })
                    .then(() => setUser(user ? { ...user, available: next } : null))
                    .catch(() => toast.error(t('toast.statusUpdateFailed')));
                }}
              />
              <span>{user?.available !== false ? t('dashboard.available') : t('dashboard.unavailable')}</span>
            </label>
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
      {postTripSummary && (
        <div className="rd-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPostTripSummary(null)}>
          <div className="rd-panel" style={{ maxWidth: 420, width: '90%', margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.75rem' }}>{t('dashboard.tripSummaryTitle')}</h3>
            <p className="rd-text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              {postTripSummary.pickupAddress} → {postTripSummary.dropoffAddress}
            </p>
            <div className="dashboard-stats-card" style={{ marginBottom: '1rem' }}>
              <div className="stat-row"><span>{t('dashboard.distance')}</span><span>{(postTripSummary.distanceKm / 1.60934).toFixed(1)} mi</span></div>
              {postTripSummary.durationMinutes > 0 && (
                <div className="stat-row"><span>{t('dashboard.duration')}</span><span>~{Math.round(postTripSummary.durationMinutes)} min</span></div>
              )}
              <div className="stat-row"><span>{t('dashboard.earnings')}</span><span>${(postTripSummary.earningsCents / 100).toFixed(2)}</span></div>
            </div>
            <button type="button" className="rd-btn rd-btn-primary" onClick={() => setPostTripSummary(null)}>{t('dashboard.done')}</button>
          </div>
        </div>
      )}
      {showReportModal && (
        <div className="rd-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowReportModal(false)}>
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
