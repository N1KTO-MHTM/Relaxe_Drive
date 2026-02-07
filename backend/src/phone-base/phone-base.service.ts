import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PhoneBaseService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.phoneBase.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async create(data: { originalPhone: string; targetPhone: string; description?: string }) {
        return this.prisma.phoneBase.create({
            data: {
                originalPhone: data.originalPhone,
                targetPhone: data.targetPhone,
                description: data.description,
            },
        });
    }

    async update(id: string, data: { originalPhone?: string; targetPhone?: string; description?: string }) {
        return this.prisma.phoneBase.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.phoneBase.delete({
            where: { id },
        });
    }

    async findTargetPhone(originalPhone: string): Promise<string | null> {
        const mapping = await this.prisma.phoneBase.findUnique({
            where: { originalPhone },
        });
        return mapping ? mapping.targetPhone : null;
    }
}
