import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AddressesService } from './addresses.service';

interface RequestWithUser {
    user: { userId: string };
}

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
    constructor(private addressesService: AddressesService) { }

    @Get()
    async findAll(@Request() req: RequestWithUser) {
        return this.addressesService.findAll(req.user.userId);
    }

    @Post()
    async create(
        @Request() req: RequestWithUser,
        @Body() body: { phone?: string; address: string; category?: string; type?: string },
    ) {
        return this.addressesService.create(req.user.userId, body);
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Request() req: RequestWithUser,
        @Body() body: { phone?: string; address?: string; category?: string; type?: string },
    ) {
        return this.addressesService.update(id, req.user.userId, body);
    }

    @Delete(':id')
    async delete(@Param('id') id: string, @Request() req: RequestWithUser) {
        return this.addressesService.delete(id, req.user.userId);
    }
}
