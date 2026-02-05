import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  list() {
    return this.ordersService.findActiveAndScheduled();
  }

  @Post()
  create(@Body() body: { pickupAt: string; pickupAddress: string; dropoffAddress: string; passengerId?: string; createdById: string; bufferMinutes?: number }) {
    return this.ordersService.create({
      ...body,
      pickupAt: new Date(body.pickupAt),
      createdById: body.createdById,
    });
  }
}
