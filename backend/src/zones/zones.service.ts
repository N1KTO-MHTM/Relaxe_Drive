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
        // Clear all zones first to ensure we don't have duplicates or old data with different names
        await (this.prisma.zone as any).deleteMany({});

        const zones = [
            // --- ROCKLAND COUNTY: RAMAPO ---
            {
                name: 'Monsey (10952)',
                description: 'Monsey',
                color: '#2dd4bf', // Teal
                points: [
                    { lat: 41.130, lng: -74.080 },
                    { lat: 41.130, lng: -74.050 },
                    { lat: 41.100, lng: -74.050 },
                    { lat: 41.100, lng: -74.080 },
                ],
            },
            {
                name: 'Spring Valley (10977)',
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
                name: 'Suffern (10901)',
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
                name: 'Montebello (10974)',
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
                name: 'Airmont (10901)',
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
                name: 'Sloatsburg (10974)',
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
                name: 'Hillburn (10931)',
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
                name: 'New Square (10977)',
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
                name: 'Wesley Hills (10901)',
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
                name: 'Viola (10952)',
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
                name: 'Chestnut Ridge (10977)',
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
                name: 'New Hempstead (10977)',
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
                name: 'Pomona (10970)',
                description: 'Pomona',
                color: '#2dd4bf',
                points: [
                    { lat: 41.200, lng: -74.080 },
                    { lat: 41.200, lng: -74.030 },
                    { lat: 41.160, lng: -74.030 },
                    { lat: 41.160, lng: -74.080 },
                ],
            },

            // --- ROCKLAND COUNTY: ORANGETOWN ---
            {
                name: 'Nyack (10960)',
                description: 'Nyack',
                color: '#3b82f6', // Blue
                points: [
                    { lat: 41.100, lng: -73.930 },
                    { lat: 41.100, lng: -73.910 },
                    { lat: 41.090, lng: -73.910 },
                    { lat: 41.090, lng: -73.930 },
                ],
            },
            {
                name: 'Pearl River (10965)',
                description: 'Pearl River',
                color: '#3b82f6',
                points: [
                    { lat: 41.070, lng: -74.020 },
                    { lat: 41.070, lng: -73.990 },
                    { lat: 41.040, lng: -73.990 },
                    { lat: 41.040, lng: -74.020 },
                ],
            },
            {
                name: 'Blauvelt (10913)',
                description: 'Blauvelt',
                color: '#3b82f6',
                points: [
                    { lat: 41.080, lng: -73.980 },
                    { lat: 41.080, lng: -73.950 },
                    { lat: 41.060, lng: -73.950 },
                    { lat: 41.060, lng: -73.980 },
                ],
            },
            {
                name: 'Orangeburg (10962)',
                description: 'Orangeburg',
                color: '#3b82f6',
                points: [
                    { lat: 41.060, lng: -73.990 },
                    { lat: 41.060, lng: -73.950 },
                    { lat: 41.030, lng: -73.950 },
                    { lat: 41.030, lng: -73.990 },
                ],
            },
            {
                name: 'Tappan (10983)',
                description: 'Tappan',
                color: '#3b82f6',
                points: [
                    { lat: 41.030, lng: -73.970 },
                    { lat: 41.030, lng: -73.930 },
                    { lat: 41.010, lng: -73.930 },
                    { lat: 41.010, lng: -73.970 },
                ],
            },
            {
                name: 'Sparkill (10976)',
                description: 'Sparkill',
                color: '#3b82f6',
                points: [
                    { lat: 41.040, lng: -73.930 },
                    { lat: 41.040, lng: -73.910 },
                    { lat: 41.030, lng: -73.910 },
                    { lat: 41.030, lng: -73.930 },
                ],
            },
            {
                name: 'Palisades (10964)',
                description: 'Palisades',
                color: '#3b82f6',
                points: [
                    { lat: 41.030, lng: -73.930 },
                    { lat: 41.030, lng: -73.900 },
                    { lat: 41.000, lng: -73.900 },
                    { lat: 41.000, lng: -73.930 },
                ],
            },
            {
                name: 'Upper Nyack (10960)',
                description: 'Upper Nyack',
                color: '#3b82f6',
                points: [
                    { lat: 41.120, lng: -73.930 },
                    { lat: 41.120, lng: -73.910 },
                    { lat: 41.100, lng: -73.910 },
                    { lat: 41.100, lng: -73.930 },
                ],
            },

            // --- ROCKLAND COUNTY: CLARKSTOWN ---
            {
                name: 'New City (10956)',
                description: 'New City',
                color: '#a855f7', // Purple
                points: [
                    { lat: 41.170, lng: -74.000 },
                    { lat: 41.170, lng: -73.970 },
                    { lat: 41.130, lng: -73.970 },
                    { lat: 41.130, lng: -74.000 },
                ],
            },
            {
                name: 'Nanuet (10954)',
                description: 'Nanuet',
                color: '#a855f7',
                points: [
                    { lat: 41.110, lng: -74.020 },
                    { lat: 41.110, lng: -73.990 },
                    { lat: 41.080, lng: -73.990 },
                    { lat: 41.080, lng: -74.020 },
                ],
            },
            {
                name: 'West Nyack (10994)',
                description: 'West Nyack',
                color: '#a855f7',
                points: [
                    { lat: 41.110, lng: -73.980 },
                    { lat: 41.110, lng: -73.940 },
                    { lat: 41.090, lng: -73.940 },
                    { lat: 41.090, lng: -73.980 },
                ],
            },
            {
                name: 'Valley Cottage (10989)',
                description: 'Valley Cottage',
                color: '#a855f7',
                points: [
                    { lat: 41.140, lng: -73.960 },
                    { lat: 41.140, lng: -73.930 },
                    { lat: 41.110, lng: -73.930 },
                    { lat: 41.110, lng: -73.960 },
                ],
            },
            {
                name: 'Congers (10920)',
                description: 'Congers',
                color: '#a855f7',
                points: [
                    { lat: 41.160, lng: -73.960 },
                    { lat: 41.160, lng: -73.930 },
                    { lat: 41.140, lng: -73.930 },
                    { lat: 41.140, lng: -73.960 },
                ],
            },
            {
                name: 'Bardonia (10954)',
                description: 'Bardonia',
                color: '#a855f7',
                points: [
                    { lat: 41.130, lng: -73.990 },
                    { lat: 41.130, lng: -73.970 },
                    { lat: 41.110, lng: -73.970 },
                    { lat: 41.110, lng: -73.990 },
                ],
            },

            // --- ROCKLAND COUNTY: HAVERSTRAW ---
            {
                name: 'Haverstraw (10927)',
                description: 'Haverstraw',
                color: '#22c55e', // Green
                points: [
                    { lat: 41.200, lng: -73.980 },
                    { lat: 41.200, lng: -73.950 },
                    { lat: 41.180, lng: -73.950 },
                    { lat: 41.180, lng: -73.980 },
                ],
            },
            {
                name: 'W. Haverstraw (10993)',
                description: 'West Haverstraw',
                color: '#22c55e',
                points: [
                    { lat: 41.220, lng: -73.990 },
                    { lat: 41.220, lng: -73.970 },
                    { lat: 41.200, lng: -73.970 },
                    { lat: 41.200, lng: -73.990 },
                ],
            },
            {
                name: 'Garnerville (10923)',
                description: 'Garnerville',
                color: '#22c55e',
                points: [
                    { lat: 41.210, lng: -73.990 },
                    { lat: 41.210, lng: -73.970 },
                    { lat: 41.190, lng: -73.970 },
                    { lat: 41.190, lng: -73.990 },
                ],
            },
            {
                name: 'Thiells (10984)',
                description: 'Thiells',
                color: '#22c55e',
                points: [
                    { lat: 41.220, lng: -74.010 },
                    { lat: 41.220, lng: -73.980 },
                    { lat: 41.190, lng: -73.980 },
                    { lat: 41.190, lng: -74.010 },
                ],
            },

            // --- ROCKLAND COUNTY: STONY POINT ---
            {
                name: 'Stony Point (10980)',
                description: 'Stony Point',
                color: '#f59e0b', // Amber
                points: [
                    { lat: 41.260, lng: -74.010 },
                    { lat: 41.260, lng: -73.970 },
                    { lat: 41.220, lng: -73.970 },
                    { lat: 41.220, lng: -74.010 },
                ],
            },
            {
                name: 'Tomkins Cove (10986)',
                description: 'Tomkins Cove',
                color: '#f59e0b',
                points: [
                    { lat: 41.290, lng: -74.010 },
                    { lat: 41.290, lng: -73.970 },
                    { lat: 41.260, lng: -73.970 },
                    { lat: 41.260, lng: -74.010 },
                ],
            },

            // --- ORANGE COUNTY ---
            {
                name: 'Mountain Lodge (10950)',
                description: 'Mountain Lodge Park',
                color: '#6b7280', // Gray
                points: [
                    { lat: 41.400, lng: -74.150 },
                    { lat: 41.400, lng: -74.110 },
                    { lat: 41.370, lng: -74.110 },
                    { lat: 41.370, lng: -74.150 },
                ],
            },
            {
                name: 'S. Bloom Grove (10950)',
                description: 'South Blooming Grove',
                color: '#6b7280',
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
