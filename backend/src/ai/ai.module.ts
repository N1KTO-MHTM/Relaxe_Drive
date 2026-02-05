import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [GeoModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
