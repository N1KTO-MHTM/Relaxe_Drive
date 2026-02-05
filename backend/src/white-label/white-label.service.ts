import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Logos, colors, domains, languages per tenant. */
@Injectable()
export class WhiteLabelService {
  constructor(private prisma: PrismaService) {}

  async getConfig(tenantId: string) {
    return this.prisma.whiteLabelConfig.findUnique({ where: { tenantId } });
  }
}
