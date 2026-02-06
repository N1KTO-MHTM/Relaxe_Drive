import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';
import { AlertsService } from '../alerts/alerts.service';
import { GeoService } from '../geo/geo.service';
import { UsersService } from '../users/users.service';
import { PassengersService } from '../passengers/passengers.service';
import { PlanningService } from '../planning/planning.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private audit: AuditService,
    private ws: RelaxDriveWsGateway,
    private alerts: AlertsService,
    private geo: GeoService,
    private usersService: UsersService,
    private passengersService: PassengersService,
    private planningService: PlanningService,
  ) {}

  @Get()
  list(
    @Request() req: { user: { id: string; role: string } },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const driverOnly = req.user?.role === 'DRIVER' ? req.user.id : undefined;
    if (from && to) {
      return this.ordersService.findByDateRange(new Date(from), new Date(to), driverOnly);
    }
    return this.ordersService.findActiveAndScheduled(driverOnly);
  }

  @Get(':id/driver-etas')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async getDriverEtas(@Param('id') orderId: string) {
    const order = await this.ordersService.findById(orderId);
    if (!order) return { drivers: [], pickupCoords: null, dropoffCoords: null };
    const [pickupCoords, dropoffCoords] = await Promise.all([
      this.geo.geocode(order.pickupAddress),
      this.geo.geocode(order.dropoffAddress),
    ]);
    const drivers = await this.usersService.findAll();
    let driverList = drivers.filter((u) => u.role === 'DRIVER' && u.available !== false && u.lat != null && u.lng != null && Number.isFinite(u.lat) && Number.isFinite(u.lng));
    if (order.preferredCarType && order.preferredCarType.trim()) {
      const preferred = order.preferredCarType.trim().toUpperCase();
      driverList = driverList.filter((d) => (d as { carType?: string | null }).carType === preferred);
    }
    const results: Array<{
      id: string;
      nickname: string;
      phone?: string | null;
      lat: number;
      lng: number;
      etaMinutesToPickup: number;
      etaMinutesPickupToDropoff: number;
      etaMinutesTotal: number;
    }> = [];
    if (!pickupCoords || !dropoffCoords) {
      return { drivers: results, pickupCoords, dropoffCoords };
    }
    for (const d of driverList) {
      const toPickup = await this.geo.getEta({ lat: d.lat!, lng: d.lng! }, pickupCoords);
      const pickupToDrop = await this.geo.getEta(pickupCoords, dropoffCoords);
      results.push({
        id: d.id,
        nickname: d.nickname,
        phone: d.phone,
        lat: d.lat!,
        lng: d.lng!,
        etaMinutesToPickup: Math.round(toPickup.minutes * 10) / 10,
        etaMinutesPickupToDropoff: Math.round(pickupToDrop.minutes * 10) / 10,
        etaMinutesTotal: Math.round((toPickup.minutes + pickupToDrop.minutes) * 10) / 10,
      });
    }
    results.sort((a, b) => a.etaMinutesToPickup - b.etaMinutesToPickup);
    return { drivers: results, pickupCoords, dropoffCoords };
  }

  @Get(':id/route')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER', 'DRIVER')
  async getOrderRoute(
    @Param('id') orderId: string,
    @Query('fromLat') fromLat?: string,
    @Query('fromLng') fromLng?: string,
    @Query('alternatives') alternatives?: string,
    @Request() req?: { user: { id: string; role: string } },
  ) {
    const order = await this.ordersService.findById(orderId);
    if (!order) return { pickupCoords: null, dropoffCoords: null, polyline: '', durationMinutes: 0, distanceKm: 0 };
    if (req?.user?.role === 'DRIVER' && order.driverId !== req.user.id) {
      throw new ForbiddenException('You can only view the route for orders assigned to you');
    }
    const pickupCoords = await this.geo.geocode(order.pickupAddress);
    const dropoffCoords = await this.geo.geocode(order.dropoffAddress);
    if (!pickupCoords || !dropoffCoords) {
      return { pickupCoords: pickupCoords ?? null, dropoffCoords: dropoffCoords ?? null, polyline: '', durationMinutes: 0, distanceKm: 0 };
    }
    const waypointsRaw = (order as unknown as { waypoints?: { address: string }[] }).waypoints;
    const stopAddresses = Array.isArray(waypointsRaw) ? waypointsRaw.map((w) => w?.address).filter(Boolean) as string[] : [];
    let pickupToDropoff: { polyline: string; durationMinutes: number; distanceKm: number; steps?: Array<{ type: number; instruction: string; distanceM: number; durationS: number }> };
    if (stopAddresses.length > 0) {
      const stopCoords: Array<{ lat: number; lng: number }> = [];
      for (const addr of stopAddresses) {
        const c = await this.geo.geocode(addr);
        if (c) stopCoords.push(c);
      }
      const allPoints = [pickupCoords, ...stopCoords, dropoffCoords];
      pickupToDropoff = await this.geo.getRouteMulti(allPoints);
    } else {
      pickupToDropoff = await this.geo.getRoute(pickupCoords, dropoffCoords);
    }
    const wantAlternatives = (alternatives === 'true' || alternatives === '1') && stopAddresses.length === 0;
    const altRoutes = wantAlternatives ? await this.geo.getRouteAlternatives(pickupCoords, dropoffCoords, 3) : null;
    const out: {
      pickupCoords: typeof pickupCoords;
      dropoffCoords: typeof dropoffCoords;
      polyline: string;
      durationMinutes: number;
      distanceKm: number;
      steps?: Array<{ type: number; instruction: string; distanceM: number; durationS: number }>;
      driverToPickupPolyline?: string;
      driverToPickupMinutes?: number;
      driverToPickupSteps?: Array<{ type: number; instruction: string; distanceM: number; durationS: number }>;
      alternativeRoutes?: Array<{ polyline: string; durationMinutes: number; distanceKm: number }>;
    } = {
      pickupCoords,
      dropoffCoords,
      polyline: pickupToDropoff.polyline,
      durationMinutes: pickupToDropoff.durationMinutes,
      distanceKm: pickupToDropoff.distanceKm,
      steps: pickupToDropoff.steps,
    };
    if (altRoutes && altRoutes.length > 1) {
      out.alternativeRoutes = altRoutes.slice(0, 4).map((r) => ({ polyline: r.polyline, durationMinutes: r.durationMinutes, distanceKm: r.distanceKm }));
    }
    const fromLatN = fromLat != null && fromLat !== '' ? parseFloat(fromLat) : NaN;
    const fromLngN = fromLng != null && fromLng !== '' ? parseFloat(fromLng) : NaN;
    if (Number.isFinite(fromLatN) && Number.isFinite(fromLngN) && pickupCoords) {
      const driverToPickup = await this.geo.getRoute({ lat: fromLatN, lng: fromLngN }, pickupCoords);
      out.driverToPickupPolyline = driverToPickup.polyline;
      out.driverToPickupMinutes = driverToPickup.durationMinutes;
      out.driverToPickupSteps = driverToPickup.steps;
    }
    return out;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async create(
    @Request() req: { user: { id: string } },
    @Body() body: {
      pickupAt?: string;
      pickupAddress: string;
      dropoffAddress: string;
      tripType?: 'ONE_WAY' | 'ROUNDTRIP';
      routeType?: 'LOCAL' | 'LONG';
      middleAddress?: string;
      waypoints?: { address: string }[];
      pickupType?: string;
      dropoffType?: string;
      passengerId?: string;
      phone?: string;
      passengerName?: string;
      bufferMinutes?: number;
      preferredCarType?: string | null;
    },
  ) {
    let passengerId = body.passengerId;
    if (body.phone?.trim() || body.pickupAddress?.trim()) {
      const passenger = await this.passengersService.findOrCreateByPhoneOrAddress({
        phone: body.phone?.trim(),
        name: body.passengerName?.trim(),
        pickupAddr: body.pickupAddress?.trim(),
        dropoffAddr: body.dropoffAddress?.trim(),
        pickupType: body.pickupType,
        dropoffType: body.dropoffType,
      });
      if (passenger) passengerId = passenger.id;
    }
    const pickupAtDate = (() => {
      if (!body.pickupAt) return new Date();
      const d = new Date(body.pickupAt);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    })();
    const created = await this.ordersService.create({
      pickupAt: pickupAtDate,
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      tripType: body.tripType ?? 'ONE_WAY',
      routeType: body.routeType ?? null,
      middleAddress: body.tripType === 'ROUNDTRIP' ? (body.middleAddress ?? null) : null,
      waypoints: body.waypoints?.length ? body.waypoints : null,
      pickupType: body.pickupType ?? null,
      dropoffType: body.dropoffType ?? null,
      passengerId: passengerId ?? undefined,
      preferredCarType: body.preferredCarType ?? null,
      bufferMinutes: body.bufferMinutes,
      createdById: req.user.id,
    });
    await this.audit.log(req.user.id, 'order.create', 'order', {
      orderId: created.id,
      pickupAt: body.pickupAt ?? created.pickupAt?.toISOString(),
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
    });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.alerts.emitAlert('order.created', { orderId: created.id, pickupAddress: created.pickupAddress, pickupAt: created.pickupAt?.toISOString() });
    this.planningService.recalculateAndEmit().catch(() => {});
    return created;
  }

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async assign(
    @Param('id') orderId: string,
    @Body() body: { driverId: string },
    @Request() req: { user: { id: string } },
  ) {
    let updated = await this.ordersService.assignDriver(orderId, body.driverId);
    const driver = await this.usersService.findById(body.driverId);
    const driverLat = driver?.lat ?? null;
    const driverLng = driver?.lng ?? null;
    if (updated.pickupAddress && driverLat != null && driverLng != null && Number.isFinite(driverLat) && Number.isFinite(driverLng)) {
      try {
        const pickupCoords = await this.geo.geocode(updated.pickupAddress);
        if (pickupCoords) {
          const route = await this.geo.getRoute({ lat: driverLat, lng: driverLng }, pickupCoords);
          const etaMinutes = Math.max(0, Math.round(route.durationMinutes ?? 0));
          const driverArriveAt = new Date(Date.now() + etaMinutes * 60 * 1000);
          updated = await this.ordersService.updatePickupAt(orderId, driverArriveAt);
        }
      } catch {
        // keep pickupAt as-is if ETA fails
      }
    }
    await this.audit.log(req.user.id, 'order.assign', 'order', { orderId, driverId: body.driverId });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.alerts.emitAlert('order.assigned', { orderId, driverId: body.driverId, pickupAddress: updated.pickupAddress ?? undefined });
    this.planningService.recalculateAndEmit().catch(() => {});
    return updated;
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async reject(
    @Param('id') orderId: string,
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.ordersService.driverReject(orderId, req.user.id);
    await this.audit.log(req.user.id, 'order.driver_reject', 'order', { orderId });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.alerts.emitAlert('order.rejected', { orderId, driverId: req.user.id, pickupAddress: updated.pickupAddress ?? undefined });
    this.planningService.recalculateAndEmit().catch(() => {});
    return updated;
  }

  @Patch(':id/arrived-at-pickup')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async arrivedAtPickup(@Param('id') orderId: string, @Request() req: { user: { id: string } }) {
    const updated = await this.ordersService.setArrivedAtPickup(orderId, req.user.id);
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    return updated;
  }

  @Patch(':id/arrived-at-middle')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async arrivedAtMiddle(@Param('id') orderId: string, @Request() req: { user: { id: string } }) {
    const updated = await this.ordersService.setArrivedAtMiddle(orderId, req.user.id);
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    return updated;
  }

  @Patch(':id/left-middle')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async leftMiddle(@Param('id') orderId: string, @Request() req: { user: { id: string } }) {
    const updated = await this.ordersService.setLeftMiddle(orderId, req.user.id);
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    return updated;
  }

  @Patch(':id/stop-underway')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  async stopUnderway(
    @Param('id') orderId: string,
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.ordersService.stopUnderway(orderId, req.user.id);
    await this.audit.log(req.user.id, 'order.stop_underway', 'order', { orderId });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.alerts.emitAlert('order.stopped_underway', { orderId, driverId: req.user.id, pickupAddress: updated.pickupAddress ?? undefined });
    this.planningService.recalculateAndEmit().catch(() => {});
    return updated;
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER', 'DRIVER')
  async updateStatus(
    @Param('id') orderId: string,
    @Body() body: { status: 'IN_PROGRESS' | 'COMPLETED'; distanceKm?: number; earningsCents?: number },
    @Request() req: { user: { id: string; role: string } },
  ) {
    const result = await this.ordersService.updateStatus(
      orderId,
      body.status,
      req.user.role === 'DRIVER' ? req.user.id : undefined,
      { distanceKm: body.distanceKm, earningsCents: body.earningsCents },
    );
    await this.audit.log(req.user.id, 'order.status_change', 'order', { orderId, status: body.status });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    if (body.status === 'COMPLETED') {
      this.alerts.emitAlert('order.completed', { orderId });
    }
    return result;
  }

  @Patch(':id/manual')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async setManual(
    @Param('id') orderId: string,
    @Body() body: { manualAssignment: boolean },
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.ordersService.setManualAssignment(orderId, !!body.manualAssignment);
    await this.audit.log(req.user.id, 'order.manual_flag', 'order', { orderId, manualAssignment: !!body.manualAssignment });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.planningService.recalculateAndEmit().catch(() => {});
    return updated;
  }

  @Patch(':id/delay')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async delay(
    @Param('id') orderId: string,
    @Body() body: { delayMinutes: number },
    @Request() req: { user: { id: string } },
  ) {
    const delayMinutes = Math.max(0, Math.min(120, Number(body.delayMinutes) || 0));
    const updated = await this.ordersService.delayOrder(orderId, delayMinutes);
    await this.audit.log(req.user.id, 'order.delay', 'order', { orderId, delayMinutes });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.planningService.recalculateAndEmit().catch(() => {});
    return updated;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async deleteOrder(@Param('id') orderId: string, @Request() req: { user: { id: string } }) {
    await this.ordersService.delete(orderId);
    await this.audit.log(req.user.id, 'order.delete', 'order', { orderId });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.planningService.recalculateAndEmit().catch(() => {});
    return { deleted: true };
  }
}
