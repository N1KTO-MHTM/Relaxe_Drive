const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

/**
 * Seed creates only the ADMIN user. Everyone else must register (as driver)
 * via the app and be approved by admin. No Disp1/Driver1 — registration required for all except admin.
 */
async function main() {
  const adminNick = process.env.ADMIN_NICKNAME || 'Admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Luka1Soso';

  const adminHash = await bcrypt.hash(adminPassword, 10);

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

  console.log('Admin login: nickname =', adminNick, '| password =', adminPassword);
  console.log('All other users must register via the app and be approved by admin.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
