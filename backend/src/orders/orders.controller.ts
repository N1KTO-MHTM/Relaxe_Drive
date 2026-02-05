import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuditService } from '../audit/audit.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';
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
  ) {}

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string) {
    if (from && to) {
      return this.ordersService.findByDateRange(new Date(from), new Date(to));
    }
    return this.ordersService.findActiveAndScheduled();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async create(
    @Request() req: { user: { id: string } },
    @Body() body: { pickupAt: string; pickupAddress: string; dropoffAddress: string; passengerId?: string; bufferMinutes?: number },
  ) {
    const created = await this.ordersService.create({
      pickupAt: new Date(body.pickupAt),
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      passengerId: body.passengerId,
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
    return updated;
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER', 'DRIVER')
  async updateStatus(
    @Param('id') orderId: string,
    @Body() body: { status: 'IN_PROGRESS' | 'COMPLETED' },
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.ordersService.updateStatus(orderId, body.status);
    await this.audit.log(req.user.id, 'order.status_change', 'order', { orderId, status: body.status });
    const list = await this.ordersService.findActiveAndScheduled();
    this.ws.broadcastOrders(list);
    return updated;
  }
}
