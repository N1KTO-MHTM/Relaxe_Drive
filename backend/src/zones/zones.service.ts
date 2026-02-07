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
            // --- ROCKLAND COUNTY ---
            {
                name: 'Monsey',
                description: 'Monsey',
                color: '#2dd4bf',
                points: [
                    { lat: 41.130, lng: -74.080 },
                    { lat: 41.130, lng: -74.050 },
                    { lat: 41.100, lng: -74.050 },
                    { lat: 41.100, lng: -74.080 },
                ],
            },
            {
                name: 'Spring Valley',
                description: 'Spring Valley',
                color: '#2dd4bf',
                points: [
                    { lat: 41.130, lng: -74.050 },
                    { lat: 41.130, lng: -74.020 },
                    { lat: 41.100, lng: -74.020 },
                    { lat: 41.100, lng: -74.050 },
                ],
            },
            {
                name: 'Nanuet',
                description: 'Nanuet',
                color: '#2dd4bf',
                points: [
                    { lat: 41.110, lng: -74.020 },
                    { lat: 41.110, lng: -73.990 },
                    { lat: 41.080, lng: -73.990 },
                    { lat: 41.080, lng: -74.020 },
                ],
            },
            {
                name: 'New City',
                description: 'New City',
                color: '#2dd4bf',
                points: [
                    { lat: 41.170, lng: -74.000 },
                    { lat: 41.170, lng: -73.970 },
                    { lat: 41.130, lng: -73.970 },
                    { lat: 41.130, lng: -74.000 },
                ],
            },
            {
                name: 'New Square',
                description: 'New Square',
                color: '#2dd4bf',
                points: [
                    { lat: 41.145, lng: -74.035 },
                    { lat: 41.145, lng: -74.015 },
                    { lat: 41.130, lng: -74.015 },
                    { lat: 41.130, lng: -74.035 },
                ],
            },
            {
                name: 'Suffern',
                description: 'Suffern',
                color: '#2dd4bf',
                points: [
                    { lat: 41.120, lng: -74.160 },
                    { lat: 41.120, lng: -74.140 },
                    { lat: 41.100, lng: -74.140 },
                    { lat: 41.100, lng: -74.160 },
                ],
            },
            {
                name: 'Hillburn',
                description: 'Hillburn',
                color: '#2dd4bf',
                points: [
                    { lat: 41.130, lng: -74.180 },
                    { lat: 41.130, lng: -74.160 },
                    { lat: 41.110, lng: -74.160 },
                    { lat: 41.110, lng: -74.180 },
                ],
            },
            {
                name: 'Sloatsburg',
                description: 'Sloatsburg',
                color: '#2dd4bf',
                points: [
                    { lat: 41.160, lng: -74.200 },
                    { lat: 41.160, lng: -74.180 },
                    { lat: 41.140, lng: -74.180 },
                    { lat: 41.140, lng: -74.200 },
                ],
            },
            {
                name: 'Montebello',
                description: 'Montebello',
                color: '#2dd4bf',
                points: [
                    { lat: 41.140, lng: -74.140 },
                    { lat: 41.140, lng: -74.100 },
                    { lat: 41.110, lng: -74.100 },
                    { lat: 41.110, lng: -74.140 },
                ],
            },
            {
                name: 'Wesley Hills',
                description: 'Wesley Hills',
                color: '#2dd4bf',
                points: [
                    { lat: 41.160, lng: -74.100 },
                    { lat: 41.160, lng: -74.060 },
                    { lat: 41.140, lng: -74.060 },
                    { lat: 41.140, lng: -74.100 },
                ],
            },
            {
                name: 'Viola',
                description: 'Viola',
                color: '#2dd4bf',
                points: [
                    { lat: 41.140, lng: -74.100 },
                    { lat: 41.140, lng: -74.080 },
                    { lat: 41.130, lng: -74.080 },
                    { lat: 41.130, lng: -74.100 },
                ],
            },
            {
                name: 'Airmont',
                description: 'Airmont',
                color: '#2dd4bf',
                points: [
                    { lat: 41.110, lng: -74.110 },
                    { lat: 41.110, lng: -74.080 },
                    { lat: 41.090, lng: -74.080 },
                    { lat: 41.090, lng: -74.110 },
                ],
            },
            {
                name: 'Chestnut Ridge',
                description: 'Chestnut Ridge',
                color: '#2dd4bf',
                points: [
                    { lat: 41.090, lng: -74.060 },
                    { lat: 41.090, lng: -74.030 },
                    { lat: 41.060, lng: -74.030 },
                    { lat: 41.060, lng: -74.060 },
                ],
            },
            {
                name: 'Pearl River',
                description: 'Pearl River',
                color: '#2dd4bf',
                points: [
                    { lat: 41.070, lng: -74.020 },
                    { lat: 41.070, lng: -73.990 },
                    { lat: 41.040, lng: -73.990 },
                    { lat: 41.040, lng: -74.020 },
                ],
            },
            {
                name: 'Orangeburg',
                description: 'Orangeburg',
                color: '#2dd4bf',
                points: [
                    { lat: 41.060, lng: -73.990 },
                    { lat: 41.060, lng: -73.950 },
                    { lat: 41.030, lng: -73.950 },
                    { lat: 41.030, lng: -73.990 },
                ],
            },
            {
                name: 'Tappan',
                description: 'Tappan',
                color: '#2dd4bf',
                points: [
                    { lat: 41.030, lng: -73.970 },
                    { lat: 41.030, lng: -73.930 },
                    { lat: 41.010, lng: -73.930 },
                    { lat: 41.010, lng: -73.970 },
                ],
            },
            {
                name: 'Blauvelt',
                description: 'Blauvelt',
                color: '#2dd4bf',
                points: [
                    { lat: 41.080, lng: -73.980 },
                    { lat: 41.080, lng: -73.950 },
                    { lat: 41.060, lng: -73.950 },
                    { lat: 41.060, lng: -73.980 },
                ],
            },
            {
                name: 'Palisades',
                description: 'Palisades',
                color: '#2dd4bf',
                points: [
                    { lat: 41.030, lng: -73.930 },
                    { lat: 41.030, lng: -73.900 },
                    { lat: 41.000, lng: -73.900 },
                    { lat: 41.000, lng: -73.930 },
                ],
            },
            {
                name: 'Sparkill',
                description: 'Sparkill',
                color: '#2dd4bf',
                points: [
                    { lat: 41.040, lng: -73.930 },
                    { lat: 41.040, lng: -73.910 },
                    { lat: 41.030, lng: -73.910 },
                    { lat: 41.030, lng: -73.930 },
                ],
            },
            {
                name: 'Piermont',
                description: 'Piermont',
                color: '#2dd4bf',
                points: [
                    { lat: 41.050, lng: -73.920 },
                    { lat: 41.050, lng: -73.900 },
                    { lat: 41.030, lng: -73.900 },
                    { lat: 41.030, lng: -73.920 },
                ],
            },
            {
                name: 'Grand View',
                description: 'Grand View-on-Hudson',
                color: '#2dd4bf',
                points: [
                    { lat: 41.070, lng: -73.920 },
                    { lat: 41.070, lng: -73.910 },
                    { lat: 41.050, lng: -73.910 },
                    { lat: 41.050, lng: -73.920 },
                ],
            },
            {
                name: 'South Nyack',
                description: 'South Nyack',
                color: '#2dd4bf',
                points: [
                    { lat: 41.090, lng: -73.930 },
                    { lat: 41.090, lng: -73.910 },
                    { lat: 41.070, lng: -73.910 },
                    { lat: 41.070, lng: -73.930 },
                ],
            },
            {
                name: 'Nyack',
                description: 'Nyack',
                color: '#2dd4bf',
                points: [
                    { lat: 41.100, lng: -73.930 },
                    { lat: 41.100, lng: -73.910 },
                    { lat: 41.090, lng: -73.910 },
                    { lat: 41.090, lng: -73.930 },
                ],
            },
            {
                name: 'Upper Nyack',
                description: 'Upper Nyack',
                color: '#2dd4bf',
                points: [
                    { lat: 41.120, lng: -73.930 },
                    { lat: 41.120, lng: -73.910 },
                    { lat: 41.100, lng: -73.910 },
                    { lat: 41.100, lng: -73.930 },
                ],
            },
            {
                name: 'West Nyack',
                description: 'West Nyack',
                color: '#2dd4bf',
                points: [
                    { lat: 41.110, lng: -73.980 },
                    { lat: 41.110, lng: -73.940 },
                    { lat: 41.090, lng: -73.940 },
                    { lat: 41.090, lng: -73.980 },
                ],
            },
            {
                name: 'Valley Cottage',
                description: 'Valley Cottage',
                color: '#2dd4bf',
                points: [
                    { lat: 41.140, lng: -73.960 },
                    { lat: 41.140, lng: -73.930 },
                    { lat: 41.110, lng: -73.930 },
                    { lat: 41.110, lng: -73.960 },
                ],
            },
            {
                name: 'Congers',
                description: 'Congers',
                color: '#2dd4bf',
                points: [
                    { lat: 41.160, lng: -73.960 },
                    { lat: 41.160, lng: -73.930 },
                    { lat: 41.140, lng: -73.930 },
                    { lat: 41.140, lng: -73.960 },
                ],
            },
            {
                name: 'Bardonia',
                description: 'Bardonia',
                color: '#2dd4bf',
                points: [
                    { lat: 41.130, lng: -73.990 },
                    { lat: 41.130, lng: -73.970 },
                    { lat: 41.110, lng: -73.970 },
                    { lat: 41.110, lng: -73.990 },
                ],
            },
            {
                name: 'New Hempstead',
                description: 'New Hempstead',
                color: '#2dd4bf',
                points: [
                    { lat: 41.160, lng: -74.050 },
                    { lat: 41.160, lng: -74.020 },
                    { lat: 41.130, lng: -74.020 },
                    { lat: 41.130, lng: -74.050 },
                ],
            },
            {
                name: 'Pomona',
                description: 'Pomona',
                color: '#2dd4bf',
                points: [
                    { lat: 41.200, lng: -74.080 },
                    { lat: 41.200, lng: -74.030 },
                    { lat: 41.160, lng: -74.030 },
                    { lat: 41.160, lng: -74.080 },
                ],
            },
            {
                name: 'Mount Ivy',
                description: 'Mount Ivy',
                color: '#2dd4bf',
                points: [
                    { lat: 41.190, lng: -74.030 },
                    { lat: 41.190, lng: -74.000 },
                    { lat: 41.170, lng: -74.000 },
                    { lat: 41.170, lng: -74.030 },
                ],
            },
            {
                name: 'Thiells',
                description: 'Thiells',
                color: '#2dd4bf',
                points: [
                    { lat: 41.220, lng: -74.010 },
                    { lat: 41.220, lng: -73.980 },
                    { lat: 41.190, lng: -73.980 },
                    { lat: 41.190, lng: -74.010 },
                ],
            },
            {
                name: 'Haverstraw',
                description: 'Haverstraw',
                color: '#2dd4bf',
                points: [
                    { lat: 41.200, lng: -73.980 },
                    { lat: 41.200, lng: -73.950 },
                    { lat: 41.180, lng: -73.950 },
                    { lat: 41.180, lng: -73.980 },
                ],
            },
            {
                name: 'W. Haverstraw',
                description: 'West Haverstraw',
                color: '#2dd4bf',
                points: [
                    { lat: 41.220, lng: -73.990 },
                    { lat: 41.220, lng: -73.970 },
                    { lat: 41.200, lng: -73.970 },
                    { lat: 41.200, lng: -73.990 },
                ],
            },
            {
                name: 'Stony Point',
                description: 'Stony Point',
                color: '#2dd4bf',
                points: [
                    { lat: 41.260, lng: -74.010 },
                    { lat: 41.260, lng: -73.970 },
                    { lat: 41.220, lng: -73.970 },
                    { lat: 41.220, lng: -74.010 },
                ],
            },
            {
                name: 'Tomkins Cove',
                description: 'Tomkins Cove',
                color: '#2dd4bf',
                points: [
                    { lat: 41.290, lng: -74.010 },
                    { lat: 41.290, lng: -73.970 },
                    { lat: 41.260, lng: -73.970 },
                    { lat: 41.260, lng: -74.010 },
                ],
            },

            // --- ORANGE COUNTY ---
            {
                name: 'Mountain Lodge',
                description: 'Mountain Lodge Park',
                color: '#2dd4bf',
                points: [
                    { lat: 41.400, lng: -74.150 },
                    { lat: 41.400, lng: -74.110 },
                    { lat: 41.370, lng: -74.110 },
                    { lat: 41.370, lng: -74.150 },
                ],
            },
            {
                name: 'S. Bloom Grove',
                description: 'South Blooming Grove',
                color: '#2dd4bf',
                points: [
                    { lat: 41.390, lng: -74.190 },
                    { lat: 41.390, lng: -74.150 },
                    { lat: 41.360, lng: -74.150 },
                    { lat: 41.360, lng: -74.190 },
                ],
            },
            {
                name: 'Kiryas Joel',
                description: 'Kiryas Joel',
                color: '#2dd4bf',
                points: [
                    { lat: 41.360, lng: -74.180 },
                    { lat: 41.360, lng: -74.140 },
                    { lat: 41.330, lng: -74.140 },
                    { lat: 41.330, lng: -74.180 },
                ],
            },
            {
                name: 'Monroe',
                description: 'Monroe',
                color: '#2dd4bf',
                points: [
                    { lat: 41.350, lng: -74.210 },
                    { lat: 41.350, lng: -74.180 },
                    { lat: 41.310, lng: -74.180 },
                    { lat: 41.310, lng: -74.210 },
                ],
            },
            {
                name: 'Harriman',
                description: 'Harriman',
                color: '#2dd4bf',
                points: [
                    { lat: 41.310, lng: -74.160 },
                    { lat: 41.310, lng: -74.130 },
                    { lat: 41.290, lng: -74.130 },
                    { lat: 41.290, lng: -74.160 },
                ],
            },
            {
                name: 'Highland Mills',
                description: 'Highland Mills',
                color: '#2dd4bf',
                points: [
                    { lat: 41.370, lng: -74.140 },
                    { lat: 41.370, lng: -74.100 },
                    { lat: 41.330, lng: -74.100 },
                    { lat: 41.330, lng: -74.140 },
                ],
            },
        ];

        for (const z of zones) {
            const matches = await (this.prisma.zone as any).findMany({
                where: { name: z.name },
                orderBy: { createdAt: 'asc' },
            });

            if (matches.length > 0) {
                // Keep the first one, delete others
                const [keep, ...others] = matches;
                for (const dupe of others) {
                    await (this.prisma.zone as any).delete({ where: { id: dupe.id } });
                }

                await (this.prisma.zone as any).update({
                    where: { id: keep.id },
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
