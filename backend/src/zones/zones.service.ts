import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZonesService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Seed zones if empty
        const count = await this.prisma.zone.count();
        if (count === 0) {
            await this.seedZones();
        }
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
                description: 'Monsey area',
                color: '#3b82f6', // Blue
                points: [
                    { lat: 41.135, lng: -74.090 },
                    { lat: 41.135, lng: -74.050 },
                    { lat: 41.100, lng: -74.050 },
                    { lat: 41.100, lng: -74.090 },
                ],
            },
            {
                name: 'Spring Valley',
                description: 'Spring Valley area',
                color: '#10b981', // Green
                points: [
                    { lat: 41.130, lng: -74.050 },
                    { lat: 41.130, lng: -74.030 },
                    { lat: 41.100, lng: -74.030 },
                    { lat: 41.100, lng: -74.050 },
                ],
            },
            {
                name: 'Rockland County',
                description: 'Rockland County borders',
                color: '#f59e0b', // Amber/Orange
                points: [
                    { lat: 41.200, lng: -74.150 },
                    { lat: 41.200, lng: -73.900 },
                    { lat: 41.000, lng: -73.900 },
                    { lat: 41.000, lng: -74.150 },
                ],
            }
        ];

        for (const z of zones) {
            await this.prisma.zone.create({
                data: {
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
