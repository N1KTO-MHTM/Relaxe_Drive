import { BadGatewayException, Injectable } from '@nestjs/common';
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
  ): Promise<{
    sourceText: string;
    targetText: string;
    sourceLang: string;
    targetLang: string;
    detectedLanguage?: { code: string; confidence?: number };
  }> {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      return { sourceText, targetText: '', sourceLang, targetLang };
    }
    let targetText = trimmed;
    let detectedLanguage: { code: string; confidence?: number } | undefined;
    if (sourceLang !== targetLang) {
      this.costTracker.increment('translation');
      try {
        const out = await this.circuit.run(() =>
          withRetry(() => this.callLibreTranslate(trimmed, sourceLang, targetLang), { retries: 3, backoffMs: 500 }),
        );
        if (out?.translatedText) {
          targetText = out.translatedText;
          if (out.detectedLanguage?.language) {
            detectedLanguage = {
              code: out.detectedLanguage.language,
              confidence: out.detectedLanguage.confidence,
            };
          }
        } else {
          throw new Error('Translation service returned no text');
        }
      } catch (e) {
        console.warn('[TranslationService] LibreTranslate failed:', e);
        const msg = e instanceof Error ? e.message : 'Translation service unavailable';
        throw new BadGatewayException(msg);
      }
    }
    const effectiveSourceLang = detectedLanguage?.code ?? sourceLang;
    await this.prisma.translationRecord.create({
      data: {
        sourceLang: effectiveSourceLang,
        targetLang,
        sourceText: trimmed,
        targetText,
        userId,
      },
    });
    return {
      sourceText: trimmed,
      targetText,
      sourceLang: effectiveSourceLang,
      targetLang,
      detectedLanguage,
    };
  }

  async getHistory(userId: string, limit = 50) {
    return this.prisma.translationRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async callLibreTranslate(
    q: string,
    source: string,
    target: string,
  ): Promise<{ translatedText: string; detectedLanguage?: { language: string; confidence?: number } } | null> {
    const baseUrl = LIBRETRANSLATE_URL.replace(/\/$/, '');
    const body: Record<string, string> = {
      q,
      source: source === 'auto' ? 'auto' : source,
      target,
    };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;
    const res = await fetch(`${baseUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.warn('[TranslationService] LibreTranslate error:', res.status, raw);
      let errMsg = raw;
      try {
        const errJson = JSON.parse(raw) as { error?: string };
        if (errJson?.error) errMsg = errJson.error;
      } catch {
        // use raw
      }
      throw new Error(errMsg || `LibreTranslate ${res.status}`);
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid translation response');
    }
    const translatedText =
      typeof data.translatedText === 'string'
        ? data.translatedText
        : typeof (data as { translation?: string }).translation === 'string'
          ? (data as { translation: string }).translation
          : null;
    if (!translatedText || !translatedText.trim()) return null;
    const detected = data.detectedLanguage as { language?: string; confidence?: number } | undefined;
    return {
      translatedText: translatedText.trim(),
      detectedLanguage:
        detected && typeof detected.language === 'string'
          ? { language: detected.language, confidence: detected.confidence }
          : undefined,
    };
  }
}
