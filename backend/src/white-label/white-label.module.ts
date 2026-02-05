import { Module } from '@nestjs/common';
import { WhiteLabelService } from './white-label.service';

@Module({
  providers: [WhiteLabelService],
  exports: [WhiteLabelService],
})
export class WhiteLabelModule {}
