import { Module } from '@nestjs/common';
import { PassengersService } from './passengers.service';
import { PassengersController } from './passengers.controller';

import { PhoneBaseModule } from '../phone-base/phone-base.module';

@Module({
  controllers: [PassengersController],
  providers: [PassengersService],
  exports: [PassengersService],
  imports: [PhoneBaseModule],
})
export class PassengersModule { }
