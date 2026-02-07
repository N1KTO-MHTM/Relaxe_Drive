import { Module } from '@nestjs/common';
import { PhoneBaseService } from './phone-base.service';
import { PhoneBaseController } from './phone-base.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [PhoneBaseController],
    providers: [PhoneBaseService, PrismaService],
    exports: [PhoneBaseService],
})
export class PhoneBaseModule { }
