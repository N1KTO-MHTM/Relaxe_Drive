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
                name: 'New City',
                description: 'New City area',
                color: '#8b5cf6',
                points: [
                    { lat: 41.170, lng: -74.020 },
                    { lat: 41.165, lng: -73.980 },
                    { lat: 41.135, lng: -73.975 },
                    { lat: 41.135, lng: -74.015 },
                ],
            },
            {
                name: 'New Square',
                description: 'New Square area',
                color: '#ec4899',
                points: [
                    { lat: 41.140, lng: -74.045 },
                    { lat: 41.145, lng: -74.035 },
                    { lat: 41.135, lng: -74.025 },
                    { lat: 41.130, lng: -74.038 },
                ],
            },
            {
                name: 'Nanuet',
                description: 'Nanuet area',
                color: '#f97316',
                points: [
                    { lat: 41.110, lng: -74.020 },
                    { lat: 41.115, lng: -73.990 },
                    { lat: 41.085, lng: -73.995 },
                    { lat: 41.080, lng: -74.015 },
                ],
            },
            {
                name: 'Suffern',
                description: 'Suffern village area',
                color: '#ef4444',
                points: [
                    { lat: 41.125, lng: -74.160 },
                    { lat: 41.130, lng: -74.140 },
                    { lat: 41.110, lng: -74.130 },
                    { lat: 41.105, lng: -74.155 },
                ],
            },
            {
                name: 'Montebello',
                description: 'Montebello area',
                color: '#22c55e',
                points: [
                    { lat: 41.145, lng: -74.135 },
                    { lat: 41.148, lng: -74.100 },
                    { lat: 41.120, lng: -74.095 },
                    { lat: 41.115, lng: -74.125 },
                ],
            },
            {
                name: 'Nyack',
                description: 'Nyack area',
                color: '#06b6d4',
                points: [
                    { lat: 41.105, lng: -73.935 },
                    { lat: 41.105, lng: -73.910 },
                    { lat: 41.080, lng: -73.910 },
                    { lat: 41.080, lng: -73.935 },
                ],
            },
            {
                name: 'Pearl River',
                description: 'Pearl River area',
                color: '#64748b',
                points: [
                    { lat: 41.065, lng: -74.025 },
                    { lat: 41.065, lng: -73.990 },
                    { lat: 41.045, lng: -73.990 },
                    { lat: 41.045, lng: -74.025 },
                ],
            },
            {
                name: 'Airmont',
                description: 'Airmont area',
                color: '#a855f7',
                points: [
                    { lat: 41.115, lng: -74.100 },
                    { lat: 41.118, lng: -74.075 },
                    { lat: 41.095, lng: -74.075 },
                    { lat: 41.090, lng: -74.100 },
                ],
            },
            {
                name: 'Haverstraw',
                description: 'Haverstraw area',
                color: '#0ea5e9',
                points: [
                    { lat: 41.210, lng: -73.980 },
                    { lat: 41.215, lng: -73.950 },
                    { lat: 41.185, lng: -73.945 },
                    { lat: 41.180, lng: -73.970 },
                ],
            },
            {
                name: 'Stony Point',
                description: 'Stony Point area',
                color: '#d946ef',
                points: [
                    { lat: 41.250, lng: -74.020 },
                    { lat: 41.255, lng: -73.980 },
                    { lat: 41.220, lng: -73.985 },
                    { lat: 41.225, lng: -74.015 },
                ],
            },
            {
                name: 'Pomona',
                description: 'Pomona area',
                color: '#14b8a6',
                points: [
                    { lat: 41.200, lng: -74.070 },
                    { lat: 41.205, lng: -74.030 },
                    { lat: 41.175, lng: -74.035 },
                    { lat: 41.170, lng: -74.065 },
                ],
            },
            {
                name: 'Orangeburg',
                description: 'Orangeburg area',
                color: '#fbbf24',
                points: [
                    { lat: 41.055, lng: -73.960 },
                    { lat: 41.055, lng: -73.930 },
                    { lat: 41.035, lng: -73.935 },
                    { lat: 41.035, lng: -73.960 },
                ],
            },
            {
                name: 'Sloatsburg',
                description: 'Sloatsburg area',
                color: '#f43f5e',
                points: [
                    { lat: 41.170, lng: -74.210 },
                    { lat: 41.175, lng: -74.180 },
                    { lat: 41.145, lng: -74.175 },
                    { lat: 41.140, lng: -74.200 },
                ],
            },
            {
                name: 'West Nyack',
                description: 'West Nyack area',
                color: '#10b981',
                points: [
                    { lat: 41.115, lng: -73.970 },
                    { lat: 41.115, lng: -73.945 },
                    { lat: 41.085, lng: -73.945 },
                    { lat: 41.085, lng: -73.970 },
                ],
            },
            {
                name: 'Piermont',
                description: 'Piermont village area',
                color: '#f43f5e',
                points: [
                    { lat: 41.050, lng: -73.925 },
                    { lat: 41.050, lng: -73.905 },
                    { lat: 41.030, lng: -73.905 },
                    { lat: 41.030, lng: -73.925 },
                ],
            },
            {
                name: 'Blauvelt',
                description: 'Blauvelt area',
                color: '#8b5cf6',
                points: [
                    { lat: 41.075, lng: -73.965 },
                    { lat: 41.075, lng: -73.935 },
                    { lat: 41.055, lng: -73.935 },
                    { lat: 41.055, lng: -73.965 },
                ],
            },
            {
                name: 'Thiells',
                description: 'Thiells area',
                color: '#f59e0b',
                points: [
                    { lat: 41.220, lng: -74.015 },
                    { lat: 41.220, lng: -73.990 },
                    { lat: 41.195, lng: -73.990 },
                    { lat: 41.195, lng: -74.015 },
                ],
            },
            {
                name: 'Congers',
                description: 'Congers area',
                color: '#3b82f6',
                points: [
                    { lat: 41.170, lng: -73.955 },
                    { lat: 41.170, lng: -73.925 },
                    { lat: 41.140, lng: -73.925 },
                    { lat: 41.140, lng: -73.955 },
                ],
            },
            {
                name: 'Tappan',
                description: 'Tappan area',
                color: '#ec4899',
                points: [
                    { lat: 41.040, lng: -73.960 },
                    { lat: 41.040, lng: -73.935 },
                    { lat: 41.020, lng: -73.935 },
                    { lat: 41.020, lng: -73.960 },
                ],
            },
            {
                name: 'Valley Cottage',
                description: 'Valley Cottage area',
                color: '#10b981',
                points: [
                    { lat: 41.140, lng: -73.955 },
                    { lat: 41.140, lng: -73.925 },
                    { lat: 41.115, lng: -73.925 },
                    { lat: 41.115, lng: -73.955 },
                ],
            },
            {
                name: 'West Haverstraw',
                description: 'West Haverstraw area',
                color: '#f97316',
                points: [
                    { lat: 41.215, lng: -73.995 },
                    { lat: 41.215, lng: -73.975 },
                    { lat: 41.195, lng: -73.975 },
                    { lat: 41.195, lng: -73.995 },
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
            }
        ];

        for (const z of zones) {
            const existing = await (this.prisma.zone as any).findFirst({
                where: { name: z.name },
            });

            if (existing) {
                await (this.prisma.zone as any).update({
                    where: { id: existing.id },
                    data: {
                        description: z.description,
                        color: z.color,
                        points: JSON.stringify(z.points),
                    },
                });
            } else {
                await (this.prisma.zone as any).create({
                    data: {
                        name: z.name,
                        description: z.description,
                        color: z.color,
                        points: JSON.stringify(z.points),
                    },
                });
            }
        }
        console.log('Seeded zones');
    }
}
