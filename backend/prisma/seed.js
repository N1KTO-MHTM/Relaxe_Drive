const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = process.env.SEED_PASSWORD || 'Luka1Soso';
  const adminNick = process.env.ADMIN_NICKNAME || 'Admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Luka1Soso';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const dispHash = await bcrypt.hash(defaultPassword, 10);

  const admin = await prisma.user.upsert({
    where: { nickname: adminNick },
    update: { passwordHash: adminHash, role: 'ADMIN' },
    create: {
      nickname: adminNick,
      email: null,
      passwordHash: adminHash,
      role: 'ADMIN',
      locale: 'en',
    },
  });

  const disp = await prisma.user.upsert({
    where: { nickname: 'Disp1' },
    update: { passwordHash: dispHash, role: 'DISPATCHER' },
    create: {
      nickname: 'Disp1',
      email: null,
      passwordHash: dispHash,
      role: 'DISPATCHER',
      locale: 'en',
    },
  });

  const driver = await prisma.user.upsert({
    where: { nickname: 'Driver1' },
    update: { passwordHash: dispHash, role: 'DRIVER' },
    create: {
      nickname: 'Driver1',
      email: null,
      passwordHash: dispHash,
      role: 'DRIVER',
      locale: 'en',
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const existing = await prisma.order.count();
  if (existing === 0) {
    await prisma.order.create({
      data: {
        status: 'SCHEDULED',
        pickupAt: tomorrow,
        pickupAddress: 'ул. Тестовая 1',
        dropoffAddress: 'ул. Тестовая 2',
        createdById: admin.id,
        bufferMinutes: 15,
      },
    });
    console.log('Test order created (SCHEDULED).');
  }

  console.log('Login: nickname =', adminNick, '| password =', adminPassword);
  console.log('Disp1 / Driver1 password:', defaultPassword);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
