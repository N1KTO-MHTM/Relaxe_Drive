/**
 * Delete ALL users except ADMIN and remove their data; then clear ALL audit logs.
 * Run from backend folder: node prisma/delete-all-non-admin-users.js
 * Requires DATABASE_URL.
 *
 * Steps:
 * 1. orders createdBy -> reassign to admin; orders driverId -> null
 * 2. Passenger/TranslationRecord userId -> null; delete DriverReport, DriverTripSummary, DriverStats
 * 3. Delete all non-admin users (sessions removed by cascade)
 * 4. Delete ALL audit log entries (clear logs everywhere)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('No ADMIN user found. Create an admin first (e.g. run seed).');
    process.exit(1);
  }

  const nonAdmins = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    select: { id: true, nickname: true, role: true },
  });

  const ids = nonAdmins.length > 0 ? nonAdmins.map((u) => u.id) : [];

  if (nonAdmins.length > 0) {
    console.log('Non-admin users to delete:', nonAdmins.map((u) => `${u.nickname} (${u.role})`).join(', '));

    // Reassign orders created by these users to admin
    const ordersReassigned = await prisma.order.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: admin.id },
    });
    if (ordersReassigned.count > 0) console.log('Orders reassigned to admin:', ordersReassigned.count);

    // Unassign them as drivers
    await prisma.order.updateMany({
      where: { driverId: { in: ids } },
      data: { driverId: null },
    });

    await prisma.passenger.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.translationRecord.updateMany({
      where: { userId: { in: ids } },
      data: { userId: null },
    });
    await prisma.driverReport.deleteMany({
      where: { userId: { in: ids } },
    });
    await prisma.driverTripSummary.deleteMany({
      where: { driverId: { in: ids } },
    });
    await prisma.driverStats.deleteMany({
      where: { driverId: { in: ids } },
    });

    const deleted = await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    console.log('Deleted users:', deleted.count);
  } else {
    console.log('No non-admin users.');
  }

  // Clear ALL audit logs everywhere
  const allAuditDeleted = await prisma.auditLog.deleteMany({});
  console.log('Audit logs cleared (total deleted):', allAuditDeleted.count);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
