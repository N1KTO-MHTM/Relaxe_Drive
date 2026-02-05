import { Controller, Get, Patch, Param, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { RelaxDriveWsGateway } from '../websocket/websocket.gateway';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private audit: AuditService,
    private ws: RelaxDriveWsGateway,
  ) {}

  @Get('me')
  async me(@Request() req: { user: { id: string } }) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) return null;
    return { id: user.id, nickname: user.nickname, role: user.role, locale: user.locale };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  list() {
    return this.usersService.findAll();
  }

  @Patch('me')
  async updateMe(@Request() req: { user: { id: string } }, @Body() body: { locale?: string }) {
    if (body.locale != null) {
      const user = await this.usersService.updateLocale(req.user.id, body.locale);
      return { id: user.id, nickname: user.nickname, role: user.role, locale: user.locale };
    }
    return this.usersService.findById(req.user.id);
  }

  @Patch('me/location')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  updateMyLocation(@Request() req: { user: { id: string } }, @Body() body: { lat: number; lng: number }) {
    return this.usersService.updateLocation(req.user.id, body.lat, body.lng);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async updateRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.usersService.updateRole(id, body.role as 'ADMIN' | 'DISPATCHER' | 'DRIVER');
    await this.audit.log(req.user.id, 'user.role_change', 'user', { targetUserId: id, newRole: body.role });
    this.ws.emitUserUpdated(id);
    return updated;
  }

  @Patch(':id/password')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async setPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.usersService.setPassword(id, body.password);
    await this.audit.log(req.user.id, 'user.password_reset', 'user', { targetUserId: id });
    return updated;
  }

  @Patch(':id/block')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async setBlocked(
    @Param('id') id: string,
    @Body() body: { blocked: boolean },
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.usersService.setBlocked(id, body.blocked);
    await this.audit.log(req.user.id, 'user.block', 'user', { targetUserId: id, blocked: body.blocked });
    return updated;
  }

  @Patch(':id/ban')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async setBan(
    @Param('id') id: string,
    @Body() body: { until?: string; reason?: string },
    @Request() req: { user: { id: string } },
  ) {
    const until = body.until ? new Date(body.until) : null;
    const updated = await this.usersService.setBan(id, until, body.reason ?? null);
    await this.audit.log(req.user.id, 'user.ban', 'user', {
      targetUserId: id,
      bannedUntil: body.until ?? null,
      reason: body.reason ?? null,
    });
    return updated;
  }

  @Patch(':id/unban')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async unban(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    const updated = await this.usersService.setBan(id, null, null);
    await this.audit.log(req.user.id, 'user.unban', 'user', { targetUserId: id });
    return updated;
  }

  @Get('sessions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  async getSessions() {
    try {
      return await this.usersService.getActiveSessions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sessions unavailable';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
