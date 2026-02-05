import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { WhiteLabelService } from './white-label.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

interface WhiteLabelDto {
  logoUrl?: string | null;
  primaryColor?: string | null;
  domain?: string | null;
  locales?: string;
}

@Controller('white-label')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WhiteLabelController {
  constructor(private whiteLabel: WhiteLabelService) {}

  @Get()
  getConfig(@Req() req: { user?: { tenantId?: string | null } }) {
    const tenantId = req.user?.tenantId ?? 'default';
    return this.whiteLabel.getConfig(tenantId);
  }

  @Put()
  putConfig(
    @Req() req: { user?: { tenantId?: string | null } },
    @Body() body: WhiteLabelDto,
  ) {
    const tenantId = req.user?.tenantId ?? 'default';
    return this.whiteLabel.upsertConfig(tenantId, {
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      domain: body.domain,
      locales: body.locales,
    });
  }
}
