import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TranslationService } from './translation.service';

@Controller('translation')
@UseGuards(JwtAuthGuard)
export class TranslationController {
  constructor(private readonly translation: TranslationService) {}

  @Post('translate')
  async translate(
    @Request() req: { user: { id: string } },
    @Body() body: { sourceText: string; sourceLang: string; targetLang: string },
  ) {
    const sourceText = typeof body.sourceText === 'string' ? body.sourceText : '';
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang : 'auto';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang : 'en';
    return this.translation.translate(sourceText, sourceLang, targetLang, req.user?.id);
  }

  @Get('history')
  async history(
    @Request() req: { user: { id: string } },
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10) || 50));
    return this.translation.getHistory(req.user?.id ?? '', limit);
  }
}
