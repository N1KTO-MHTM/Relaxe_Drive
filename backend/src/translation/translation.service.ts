import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';
import { withRetry } from '../common/http-resilience';
import { CircuitBreaker } from '../common/http-resilience';

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY;

/** Pipeline: voice→text→text→(opt) text→voice. Auto language detection. All texts saved & logged. */
@Injectable()
export class TranslationService {
  private readonly circuit = new CircuitBreaker(5, 60_000);

  constructor(
    private prisma: PrismaService,
    private costTracker: CostTrackerService,
  ) {}

  async translate(
    sourceText: string,
    sourceLang: string,
    targetLang: string,
    userId?: string,
  ): Promise<{ sourceText: string; targetText: string; sourceLang: string; targetLang: string }> {
    let targetText = sourceText;
    if (sourceLang !== targetLang && sourceText.trim()) {
      this.costTracker.increment('translation');
      try {
        const translated = await this.circuit.run(() =>
          withRetry(() => this.callLibreTranslate(sourceText, sourceLang, targetLang), { retries: 3, backoffMs: 500 }),
        );
        if (translated) targetText = translated;
      } catch (e) {
        console.warn('[TranslationService] LibreTranslate failed:', e);
      }
    }
    await this.prisma.translationRecord.create({
      data: { sourceLang, targetLang, sourceText, targetText, userId },
    });
    return { sourceText, targetText, sourceLang, targetLang };
  }

  private async callLibreTranslate(q: string, source: string, target: string): Promise<string | null> {
    const body: Record<string, string> = {
      q,
      source: source === 'auto' ? 'auto' : source,
      target,
    };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;
    const res = await fetch(`${LIBRETRANSLATE_URL.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[TranslationService] LibreTranslate error:', res.status, err);
      throw new Error(`LibreTranslate ${res.status}: ${err}`);
    }
    const data = (await res.json()) as { translatedText?: string };
    return data.translatedText ?? null;
  }
}
