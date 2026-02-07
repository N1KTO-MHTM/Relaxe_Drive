import { PhoneBaseService } from '../phone-base/phone-base.service';

@Injectable()
export class PassengersService {
  constructor(
    private prisma: PrismaService,
    private phoneBase: PhoneBaseService,
  ) { }

  /** Resolve phone number if it maps to another target. */
  private async resolvePhone(phone: string): Promise<string> {
    const target = await this.phoneBase.findTargetPhone(phone);
    return target || phone;
  }

  /** List only clients (passengers not linked to a driver account). Drivers who registered with phone have userId set and are excluded. */
  async findAll() {
    return this.prisma.passenger.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Create a passenger. If one with the same phone and pickup address already exists, return that instead (no duplicate). */
  async create(data: {
    phone: string;
    name?: string;
    pickupAddr?: string;
    dropoffAddr?: string;
    pickupType?: string;
    dropoffType?: string;
  }) {
    const rawPhone = data.phone?.trim();
    const phone = rawPhone ? await this.resolvePhone(rawPhone) : rawPhone;
    const pickupAddr = data.pickupAddr?.trim();

    if (phone && pickupAddr) {
      const existing = await this.prisma.passenger.findFirst({
        where: { phone, pickupAddr },
      });
      if (existing) return existing;
    }
    return this.prisma.passenger.create({
      data: {
        phone: phone || '',
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
    const phone = data.phone?.trim() ? await this.resolvePhone(data.phone.trim()) : undefined;
    return this.prisma.passenger.update({
      where: { id },
      data: {
        ...(phone != null && { phone }),
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
    const raw = phone.trim();
    if (!raw) return null;
    const normalized = await this.resolvePhone(raw);

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
    const raw = phone.trim();
    const p = raw ? await this.resolvePhone(raw) : raw;
    const a = pickupAddr?.trim();
    if (!p || !a) return false;
    const found = await this.prisma.passenger.findFirst({
      where: { phone: p, pickupAddr: a },
    });
    return !!found;
  }

  /** Find by pickup address only (no duplicate by address). Returns first passenger with this pickupAddr. */
  async findByPickupAddr(pickupAddr: string) {
    const a = pickupAddr?.trim();
    if (!a) return null;
    return this.prisma.passenger.findFirst({
      where: { pickupAddr: a },
    });
  }

  /** Find by phone or by pickup address; if neither exists, create. Avoids duplicate clients by phone or address. */
  async findOrCreateByPhoneOrAddress(
    data: {
      phone?: string;
      name?: string;
      pickupAddr?: string;
      dropoffAddr?: string;
      pickupType?: string;
      dropoffType?: string;
    },
  ) {
    const rawPhone = data.phone?.trim();
    const phone = rawPhone ? await this.resolvePhone(rawPhone) : rawPhone;
    const pickupAddr = data.pickupAddr?.trim();

    if (phone) {
      const byPhone = await this.prisma.passenger.findFirst({ where: { phone } });
      if (byPhone) {
        const updateData: { name?: string; pickupAddr?: string; dropoffAddr?: string; pickupType?: string; dropoffType?: string } = {};
        if (data.name != null) updateData.name = data.name || undefined;
        if (data.pickupAddr != null) updateData.pickupAddr = data.pickupAddr || undefined;
        if (data.dropoffAddr != null) updateData.dropoffAddr = data.dropoffAddr || undefined;
        if (data.pickupType != null) updateData.pickupType = data.pickupType || undefined;
        if (data.dropoffType != null) updateData.dropoffType = data.dropoffType || undefined;
        if (Object.keys(updateData).length > 0) {
          return this.prisma.passenger.update({ where: { id: byPhone.id }, data: updateData });
        }
        return byPhone;
      }
    }
    if (pickupAddr) {
      const byAddr = await this.prisma.passenger.findFirst({ where: { pickupAddr } });
      if (byAddr) {
        const updateData: { phone?: string; name?: string; dropoffAddr?: string; pickupType?: string; dropoffType?: string } = {};
        if (phone != null) updateData.phone = phone || byAddr.phone;
        if (data.name != null) updateData.name = data.name || undefined;
        if (data.dropoffAddr != null) updateData.dropoffAddr = data.dropoffAddr || undefined;
        if (data.pickupType != null) updateData.pickupType = data.pickupType || undefined;
        if (data.dropoffType != null) updateData.dropoffType = data.dropoffType || undefined;
        if (Object.keys(updateData).length > 0) {
          return this.prisma.passenger.update({ where: { id: byAddr.id }, data: updateData });
        }
        return byAddr;
      }
    }
    if (!phone && !pickupAddr) return null;
    return this.prisma.passenger.create({
      data: {
        phone: phone ?? '',
        name: data.name ?? null,
        pickupAddr: pickupAddr ?? null,
        dropoffAddr: data.dropoffAddr ?? null,
        pickupType: data.pickupType ?? null,
        dropoffType: data.dropoffType ?? null,
      },
    });
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
    const raw = phone.trim();
    if (!raw) return null;
    const normalized = await this.resolvePhone(raw);

    let p = await this.prisma.passenger.findFirst({ where: { phone: normalized } });
    if (p) {
      if (data && (data.name != null || data.pickupAddr != null || data.dropoffAddr != null || data.pickupType != null || data.dropoffType != null)) {
        p = await this.prisma.passenger.update({
          where: { id: p.id },
          data: {
            ...(data.name != null && { name: data.name || undefined }),
            ...(data.pickupAddr != null && { pickupAddr: data.pickupAddr || undefined }),
            ...(data.dropoffAddr != null && { dropoffAddr: data.dropoffAddr || undefined }),
            ...(data.pickupType != null && { pickupType: data.pickupType || undefined }),
            ...(data.dropoffType != null && { dropoffType: data.dropoffType || undefined }),
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
  async saveAddressHistory(passengerId: string, address: string, type: string) {
    const normalized = address.trim();
    if (!normalized) return;

    const existing = await this.prisma.savedAddress.findFirst({
      where: { passengerId, address: normalized },
    });

    if (existing) {
      await this.prisma.savedAddress.update({
        where: { id: existing.id },
        data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
      });
    } else {
      await this.prisma.savedAddress.create({
        data: {
          passengerId,
          address: normalized,
          type,
          useCount: 1,
        },
      });
    }
  }

  async getHistory(passengerId: string) {
    return this.prisma.savedAddress.findMany({
      where: { passengerId },
      orderBy: { useCount: 'desc' },
      take: 10,
    });
  }
}
