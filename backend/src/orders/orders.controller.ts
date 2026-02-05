import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';
import { AlertsService } from '../alerts/alerts.service';
import { GeoService } from '../geo/geo.service';
import { UsersService } from '../users/users.service';
import { PassengersService } from '../passengers/passengers.service';
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
    const driverList = drivers.filter((u) => u.role === 'DRIVER' && u.available !== false && u.lat != null && u.lng != null && Number.isFinite(u.lat) && Number.isFinite(u.lng));
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
  ) {
    const order = await this.ordersService.findById(orderId);
    if (!order) return { pickupCoords: null, dropoffCoords: null, polyline: '', durationMinutes: 0, distanceKm: 0 };
    const [pickupCoords, dropoffCoords] = await Promise.all([
      this.geo.geocode(order.pickupAddress),
      this.geo.geocode(order.dropoffAddress),
    ]);
    if (!pickupCoords || !dropoffCoords) {
      return { pickupCoords, dropoffCoords, polyline: '', durationMinutes: 0, distanceKm: 0 };
    }
    const wantAlternatives = alternatives === 'true' || alternatives === '1';
    const [pickupToDropoff, altRoutes] = wantAlternatives
      ? await Promise.all([
          this.geo.getRoute(pickupCoords, dropoffCoords),
          this.geo.getRouteAlternatives(pickupCoords, dropoffCoords, 3),
        ])
      : [await this.geo.getRoute(pickupCoords, dropoffCoords), null];
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
      out.alternativeRoutes = altRoutes.map((r) => ({ polyline: r.polyline, durationMinutes: r.durationMinutes, distanceKm: r.distanceKm }));
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
      pickupAt: string;
      pickupAddress: string;
      dropoffAddress: string;
      tripType?: 'ONE_WAY' | 'ROUNDTRIP';
      middleAddress?: string;
      pickupType?: string;
      dropoffType?: string;
      passengerId?: string;
      phone?: string;
      passengerName?: string;
      bufferMinutes?: number;
    },
  ) {
    let passengerId = body.passengerId;
    if (body.phone?.trim()) {
      const passenger = await this.passengersService.findOrCreateByPhone(body.phone.trim(), {
        name: body.passengerName?.trim(),
        pickupAddr: body.pickupAddress?.trim() || undefined,
        dropoffAddr: body.dropoffAddress?.trim() || undefined,
        pickupType: body.pickupType || undefined,
        dropoffType: body.dropoffType || undefined,
      });
      if (passenger) passengerId = passenger.id;
    }
    const created = await this.ordersService.create({
      pickupAt: new Date(body.pickupAt),
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      tripType: body.tripType ?? 'ONE_WAY',
      middleAddress: body.tripType === 'ROUNDTRIP' ? (body.middleAddress ?? null) : null,
      pickupType: body.pickupType ?? null,
      dropoffType: body.dropoffType ?? null,
      passengerId: passengerId ?? undefined,
      bufferMinutes: body.bufferMinutes,
      createdById: req.user.id,
    });
    await this.audit.log(req.user.id, 'order.create', 'order', {
      orderId: created.id,
      pickupAt: body.pickupAt,
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
    });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.alerts.emitAlert('order.created', { orderId: created.id, pickupAddress: created.pickupAddress, pickupAt: created.pickupAt?.toISOString() });
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
    const updated = await this.ordersService.assignDriver(orderId, body.driverId);
    await this.audit.log(req.user.id, 'order.assign', 'order', { orderId, driverId: body.driverId });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    this.alerts.emitAlert('order.assigned', { orderId, driverId: body.driverId, pickupAddress: updated.pickupAddress ?? undefined });
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

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER', 'DRIVER')
  async updateStatus(
    @Param('id') orderId: string,
    @Body() body: { status: 'IN_PROGRESS' | 'COMPLETED' },
    @Request() req: { user: { id: string; role: string } },
  ) {
    const result = await this.ordersService.updateStatus(orderId, body.status, req.user.role === 'DRIVER' ? req.user.id : undefined);
    await this.audit.log(req.user.id, 'order.status_change', 'order', { orderId, status: body.status });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    if (body.status === 'COMPLETED') {
      this.alerts.emitAlert('order.completed', { orderId });
    }
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async deleteOrder(@Param('id') orderId: string, @Request() req: { user: { id: string } }) {
    await this.ordersService.delete(orderId);
    await this.audit.log(req.user.id, 'order.delete', 'order', { orderId });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    return { deleted: true };
  }
}
