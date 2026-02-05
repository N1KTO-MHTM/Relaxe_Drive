import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PassengersService } from './passengers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('passengers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class PassengersController {
  constructor(private passengersService: PassengersService) {}

  @Get()
  async list(@Request() req: { user?: { role: string } }) {
    const rows = await this.passengersService.findAll();
    const isAdmin = req.user?.role === 'ADMIN';
    return rows.map((p) => ({
      id: p.id,
      phone: isAdmin ? p.phone : undefined,
      name: p.name,
      pickupAddr: p.pickupAddr,
      dropoffAddr: p.dropoffAddr,
      pickupType: p.pickupType,
      dropoffType: p.dropoffType,
      userId: p.userId ?? undefined,
      createdAt: p.createdAt,
    }));
  }

  @Post()
  async create(
    @Body()
    body: {
      phone: string;
      name?: string;
      pickupAddr?: string;
      dropoffAddr?: string;
      pickupType?: string;
      dropoffType?: string;
    },
  ) {
    return this.passengersService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      phone?: string;
      name?: string;
      pickupAddr?: string;
      dropoffAddr?: string;
      pickupType?: string;
      dropoffType?: string;
    },
  ) {
    return this.passengersService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.passengersService.delete(id);
    return { deleted: true };
  }
}
