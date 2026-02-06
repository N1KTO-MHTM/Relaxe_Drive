import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PassengersService {
  constructor(private prisma: PrismaService) {}

  /** List only clients (passengers not linked to a driver account). Drivers who registered with phone have userId set and are excluded. */
  async findAll() {
    return this.prisma.passenger.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    phone: string;
    name?: string;
    pickupAddr?: string;
    dropoffAddr?: string;
    pickupType?: string;
    dropoffType?: string;
  }) {
    return this.prisma.passenger.create({
      data: {
        phone: data.phone,
        name: data.name ?? null,
        pickupAddr: data.pickupAddr ?? null,
        dropoffAddr: data.dropoffAddr ?? null,
        pickupType: data.pickupType ?? null,
        dropoffType: data.dropoffType ?? null,
      },
    });
  }

  async update(
    id: string,
    data: {
      phone?: string;
      name?: string;
      pickupAddr?: string;
      dropoffAddr?: string;
      pickupType?: string;
      dropoffType?: string;
    },
  ) {
    return this.prisma.passenger.update({
      where: { id },
      data: {
        ...(data.phone != null && { phone: data.phone.trim() }),
        ...(data.name != null && { name: data.name || null }),
        ...(data.pickupAddr != null && { pickupAddr: data.pickupAddr || null }),
        ...(data.dropoffAddr != null && { dropoffAddr: data.dropoffAddr || null }),
        ...(data.pickupType != null && { pickupType: data.pickupType || null }),
        ...(data.dropoffType != null && { dropoffType: data.dropoffType || null }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.passenger.delete({ where: { id } });
  }

  /** Link a driver (user) to a passenger record by phone: find or create passenger, set userId. If phone is already linked to a driver, do not add/overwrite. */
  async linkDriverToPassenger(phone: string, userId: string) {
    const normalized = phone.trim();
    if (!normalized) return null;
    const p = await this.prisma.passenger.findFirst({ where: { phone: normalized } });
    if (p) {
      if (p.userId) return p; // phone already registered as driver, don't add again
      return this.prisma.passenger.update({
        where: { id: p.id },
        data: { userId },
        select: { id: true, phone: true, userId: true },
      });
    }
    return this.prisma.passenger.create({
      data: { phone: normalized, userId },
      select: { id: true, phone: true, userId: true },
    });
  }

  /** Returns true if a passenger with this phone and pickup address already exists. */
  async existsByPhoneAndPickupAddr(phone: string, pickupAddr: string): Promise<boolean> {
    const p = phone.trim();
    const a = pickupAddr?.trim();
    if (!p || !a) return false;
    const found = await this.prisma.passenger.findFirst({
      where: { phone: p, pickupAddr: a },
    });
    return !!found;
  }

  /** Find by phone or create. If exists, update with provided fields (no duplicate phone/address). */
  async findOrCreateByPhone(
    phone: string,
    data?: {
      name?: string;
      pickupAddr?: string;
      dropoffAddr?: string;
      pickupType?: string;
      dropoffType?: string;
    },
  ) {
    const normalized = phone.trim();
    if (!normalized) return null;
    let p = await this.prisma.passenger.findFirst({ where: { phone: normalized } });
    if (p) {
      if (data && (data.name != null || data.pickupAddr != null || data.dropoffAddr != null || data.pickupType != null || data.dropoffType != null)) {
        p = await this.prisma.passenger.update({
          where: { id: p.id },
          data: {
            ...(data.name != null && { name: data.name || null }),
            ...(data.pickupAddr != null && { pickupAddr: data.pickupAddr || null }),
            ...(data.dropoffAddr != null && { dropoffAddr: data.dropoffAddr || null }),
            ...(data.pickupType != null && { pickupType: data.pickupType || null }),
            ...(data.dropoffType != null && { dropoffType: data.dropoffType || null }),
          },
        });
      }
      return p;
    }
    return this.prisma.passenger.create({
      data: {
        phone: normalized,
        name: data?.name ?? null,
        pickupAddr: data?.pickupAddr ?? null,
        dropoffAddr: data?.dropoffAddr ?? null,
        pickupType: data?.pickupType ?? null,
        dropoffType: data?.dropoffType ?? null,
      },
    });
  }
}
