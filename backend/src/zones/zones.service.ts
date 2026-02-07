import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZonesService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Always run seed to ensure zones are updated with latest coordinates
        await this.seedZones();
    }

    async findAll() {
        const zones = await this.prisma.zone.findMany();
        return zones.map(z => ({
            ...z,
            points: JSON.parse(z.points as string),
        }));
    }

    private async seedZones() {
        const zones = [
            {
                name: 'Monsey',
                description: 'Monsey community area',
                color: '#3b82f6',
                points: [
                    { lat: 41.135, lng: -74.095 },
                    { lat: 41.145, lng: -74.070 },
                    { lat: 41.130, lng: -74.045 },
                    { lat: 41.095, lng: -74.055 },
                    { lat: 41.090, lng: -74.100 },
                    { lat: 41.115, lng: -74.120 },
                ],
            },
            {
                name: 'Spring Valley',
                description: 'Spring Valley village area',
                color: '#10b981',
                points: [
                    { lat: 41.130, lng: -74.060 },
                    { lat: 41.135, lng: -74.030 },
                    { lat: 41.115, lng: -74.015 },
                    { lat: 41.095, lng: -74.025 },
                    { lat: 41.100, lng: -74.055 },
                ],
            },
            {
                name: 'Rockland County',
                description: 'Rockland County service area',
                color: '#f59e0b',
                points: [
                    { lat: 41.004, lng: -74.078 },
                    { lat: 41.004, lng: -73.945 },
                    { lat: 41.025, lng: -73.882 },
                    { lat: 41.095, lng: -73.862 },
                    { lat: 41.168, lng: -73.888 },
                    { lat: 41.268, lng: -73.912 },
                    { lat: 41.272, lng: -74.042 },
                    { lat: 41.248, lng: -74.118 },
                    { lat: 41.118, lng: -74.152 },
                ],
            },
            {
                name: 'New City',
                description: 'New City area',
                color: '#8b5cf6',
                points: [
                    { lat: 41.170, lng: -74.020 },
                    { lat: 41.165, lng: -73.980 },
                    { lat: 41.135, lng: -73.975 },
                    { lat: 41.135, lng: -74.015 },
                ],
            }
        ];

        for (const z of zones) {
            await this.prisma.zone.upsert({
                where: { name: z.name },
                update: {
                    description: z.description,
                    color: z.color,
                    points: JSON.stringify(z.points),
                },
                create: {
                    name: z.name,
                    description: z.description,
                    color: z.color,
                    points: JSON.stringify(z.points),
                },
            });
        }
        console.log('Seeded zones');
    }
}
