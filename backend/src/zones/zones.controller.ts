import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ZonesService } from './zones.service';

@Controller('zones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER', 'DRIVER')
export class ZonesController {
    constructor(private readonly zonesService: ZonesService) { }

    @Get()
    findAll() {
        return this.zonesService.findAll();
    }
}
