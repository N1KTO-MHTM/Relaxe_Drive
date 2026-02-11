import { BadGatewayException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CostTrackerService } from '../cost-tracker/cost-tracker.service';
import { withRetry } from '../common/http-resilience';
import { CircuitBreaker } from '../common/http-resilience';

const GOOGLE_TRANSLATE_API_KEY = (process.env.GOOGLE_TRANSLATE_API_KEY ?? '').trim();
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY;

/** Translation: free via LibreTranslate; optional GOOGLE_TRANSLATE_API_KEY for better quality (paid). */
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
      let out: { translatedText: string; detectedLanguage?: { language: string; confidence?: number } } | null = null;
      if (GOOGLE_TRANSLATE_API_KEY) {
        try {
          out = await this.circuit.run(() =>
            this.callGoogleTranslate(trimmed, sourceLang, targetLang),
          );
        } catch (e) {
          console.warn('[TranslationService] Google Translate failed, using LibreTranslate:', e);
        }
      }
      if (!out?.translatedText) {
        try {
          out = await this.circuit.run(() =>
            withRetry(() => this.callLibreTranslate(trimmed, sourceLang, targetLang), { retries: 3, backoffMs: 500 }),
          );
        } catch (e) {
          console.warn('[TranslationService] LibreTranslate failed:', e);
          const msg = e instanceof Error ? e.message : 'Translation service unavailable';
          throw new BadGatewayException(msg);
        }
      }
      if (out?.translatedText) {
        targetText = out.translatedText;
        if (out.detectedLanguage?.language) {
          detectedLanguage = {
            code: out.detectedLanguage.language,
            confidence: out.detectedLanguage.confidence,
          };
        }
      } else {
        throw new BadGatewayException('Translation service returned no text');
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

  private async callGoogleTranslate(
    q: string,
    source: string,
    target: string,
  ): Promise<{ translatedText: string; detectedLanguage?: { language: string; confidence?: number } } | null> {
    const params = new URLSearchParams({ key: GOOGLE_TRANSLATE_API_KEY, q, target });
    if (source !== 'auto') params.set('source', source);
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
      { method: 'POST' },
    );
    const raw = await res.text();
    if (!res.ok) {
      let errMsg = raw;
      try {
        const err = JSON.parse(raw) as { error?: { message?: string } };
        if (err?.error?.message) errMsg = err.error.message;
      } catch {
        // use raw
      }
      throw new Error(errMsg || `Google Translate ${res.status}`);
    }
    let data: { data?: { translations?: { translatedText?: string; detectedSourceLanguage?: string }[] } };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('Invalid Google Translate response');
    }
    const translations = data?.data?.translations;
    const first = Array.isArray(translations) ? translations[0] : undefined;
    const translatedText = first && typeof first.translatedText === 'string' ? first.translatedText : null;
    if (!translatedText || !translatedText.trim()) return null;
    const detected = first?.detectedSourceLanguage;
    return {
      translatedText: translatedText.trim(),
      detectedLanguage:
        typeof detected === 'string' && detected
          ? { language: detected, confidence: 1 }
          : undefined,
    };
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
