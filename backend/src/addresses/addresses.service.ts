import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
    constructor(private prisma: PrismaService) { }

    async findAll(userId: string) {
        // Find passenger by userId
        const passenger = await this.prisma.passenger.findUnique({
            where: { userId },
        });

        if (!passenger) {
            return [];
        }

        return this.prisma.savedAddress.findMany({
            where: { passengerId: passenger.id },
            orderBy: [
                { useCount: 'desc' },
                { lastUsedAt: 'desc' },
            ],
        });
    }

    async create(userId: string, data: { phone?: string; address: string; category?: string; type?: string }) {
        // Find or create passenger
        let passenger = await this.prisma.passenger.findUnique({
            where: { userId },
        });

        if (!passenger) {
            passenger = await this.prisma.passenger.create({
                data: {
                    userId,
                    phone: data.phone || '', // Required field
                },
            });
        }

        // Check for duplicates
        const existing = await this.prisma.savedAddress.findFirst({
            where: {
                passengerId: passenger.id,
                address: data.address,
                type: data.type || 'both',
            },
        });

        if (existing) {
            return existing;
        }

        return (this.prisma.savedAddress as any).create({
            data: {
                passengerId: passenger.id,
                phone: data.phone,
                address: data.address,
                category: data.category || 'other',
                type: data.type || 'both',
            },
        });
    }

    async update(id: string, userId: string, data: { phone?: string; address?: string; category?: string; type?: string }) {
        // Verify ownership
        const address = await this.prisma.savedAddress.findUnique({
            where: { id },
            include: { passenger: true },
        });

        if (!address || address.passenger?.userId !== userId) {
            throw new Error('Address not found or unauthorized');
        }

        return (this.prisma.savedAddress as any).update({
            where: { id },
            data: {
                phone: data.phone !== undefined ? data.phone : undefined,
                address: data.address,
                category: data.category,
                type: data.type,
            },
        });
    }

    async delete(id: string, userId: string) {
        // Verify ownership
        const address = await this.prisma.savedAddress.findUnique({
            where: { id },
            include: { passenger: true },
        });

        if (!address || address.passenger?.userId !== userId) {
            throw new Error('Address not found or unauthorized');
        }

        return this.prisma.savedAddress.delete({
            where: { id },
        });
    }

    async incrementUseCount(id: string) {
        return this.prisma.savedAddress.update({
            where: { id },
            data: {
                useCount: { increment: 1 },
                lastUsedAt: new Date(),
            },
        });
    }
}
