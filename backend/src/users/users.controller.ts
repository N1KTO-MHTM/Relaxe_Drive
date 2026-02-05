import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private audit: AuditService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  list() {
    return this.usersService.findAll();
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

  @Get('sessions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  getSessions() {
    return this.usersService.getActiveSessions();
  }
}
