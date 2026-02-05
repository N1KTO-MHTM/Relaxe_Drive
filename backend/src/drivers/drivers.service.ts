import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Driver status and tech metrics (hidden from UI — used only for AI logic). */
@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async getDriverStatuses() {
    // In production: read from Redis (live positions) + DB (user/driver link)
    return [];
  }
}
