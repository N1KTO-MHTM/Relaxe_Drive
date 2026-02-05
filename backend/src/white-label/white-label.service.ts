import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Logos, colors, domains, languages per tenant. */
@Injectable()
export class WhiteLabelService {
  constructor(private prisma: PrismaService) {}

  async getConfig(tenantId: string) {
    return this.prisma.whiteLabelConfig.findUnique({ where: { tenantId } });
  }

  async upsertConfig(
    tenantId: string,
    data: { logoUrl?: string | null; primaryColor?: string | null; domain?: string | null; locales?: string },
  ) {
    return this.prisma.whiteLabelConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        domain: data.domain ?? null,
        locales: data.locales ?? 'en,ru,ka',
      },
      update: {
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.domain !== undefined && { domain: data.domain }),
        ...(data.locales !== undefined && { locales: data.locales }),
      },
    });
  }
}
