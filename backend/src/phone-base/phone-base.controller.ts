import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PhoneBaseService } from './phone-base.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('phone-base')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class PhoneBaseController {
    constructor(private readonly phoneBaseService: PhoneBaseService) { }

    @Get()
    findAll() {
        return this.phoneBaseService.findAll();
    }

    @Post()
    create(@Body() body: { originalPhone: string; targetPhone: string; description?: string }) {
        return this.phoneBaseService.create(body);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() body: { originalPhone?: string; targetPhone?: string; description?: string },
    ) {
        return this.phoneBaseService.update(id, body);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.phoneBaseService.delete(id);
    }
}
