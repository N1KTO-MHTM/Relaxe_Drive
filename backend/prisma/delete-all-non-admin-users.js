/**
 * Delete ALL users except ADMIN. Use when you want to reset to "only admin";
 * everyone else must register again (as driver) and get approved by admin.
 *
 * Run from backend folder: node prisma/delete-all-non-admin-users.js
 * Requires DATABASE_URL.
 *
 * Steps: orders createdBy -> reassign to first ADMIN; orders driverId -> null;
 * AuditLog/Passenger/TranslationRecord userId -> null; delete DriverReport,
 * DriverTripSummary, DriverStats for those users; then delete users (Session cascade).
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

  if (nonAdmins.length === 0) {
    console.log('No non-admin users. Nothing to delete.');
    return;
  }

  const ids = nonAdmins.map((u) => u.id);
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

  // Break links so we can delete users
  await prisma.auditLog.updateMany({
    where: { userId: { in: ids } },
    data: { userId: null },
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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
