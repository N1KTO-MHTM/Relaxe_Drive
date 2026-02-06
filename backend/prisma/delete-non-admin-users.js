/**
 * Delete only "empty" accounts (pending drivers with no activity) so nicknames can be re-used.
 * Run from backend folder: node prisma/delete-non-admin-users.js
 * Requires DATABASE_URL.
 *
 * "Empty" = DRIVER, approvedAt is null (never approved), and:
 * - no orders where they are driver (driverId)
 * - no orders where they created (createdById)
 *
 * Before deletion: orders created by these users are reassigned to first ADMIN;
 * Order.driverId set to null where needed; AuditLog/Passenger/TranslationRecord userId set to null;
 * DriverReport, DriverTripSummary, DriverStats for these users deleted; then users are deleted.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('No ADMIN user found. Create an admin first.');
    process.exit(1);
  }

  // Pending drivers (not yet approved)
  const pendingDrivers = await prisma.user.findMany({
    where: { role: 'DRIVER', approvedAt: null },
    select: { id: true, nickname: true },
  });

  if (pendingDrivers.length === 0) {
    console.log('No pending drivers. Nothing to delete.');
    return;
  }

  const ids = pendingDrivers.map((u) => u.id);

  // Keep only those who have no orders as driver and no orders as creator ("empty")
  const [asDriver, asCreator] = await Promise.all([
    prisma.order.count({ where: { driverId: { in: ids } } }),
    prisma.order.count({ where: { createdById: { in: ids } } }),
  ]);

  const emptyIds = asDriver === 0 && asCreator === 0
    ? ids
    : (await Promise.all(
        ids.map(async (id) => {
          const [d, c] = await Promise.all([
            prisma.order.count({ where: { driverId: id } }),
            prisma.order.count({ where: { createdById: id } }),
          ]);
          return d === 0 && c === 0 ? id : null;
        }),
      )).filter(Boolean);

  if (emptyIds.length === 0) {
    console.log('No empty accounts (all pending drivers have orders as driver or creator). Nothing to delete.');
    return;
  }

  const toRemove = pendingDrivers.filter((u) => emptyIds.includes(u.id));
  console.log('Empty accounts to remove:', toRemove.map((u) => u.nickname).join(', '));

  // Reassign orders created by these users to admin (in case any slipped through)
  const ordersReassigned = await prisma.order.updateMany({
    where: { createdById: { in: emptyIds } },
    data: { createdById: admin.id },
  });
  if (ordersReassigned.count > 0) console.log('Orders reassigned to admin:', ordersReassigned.count);

  // Unassign them from any orders as driver
  await prisma.order.updateMany({
    where: { driverId: { in: emptyIds } },
    data: { driverId: null },
  });

  // Break links so we can delete users
  await prisma.auditLog.updateMany({
    where: { userId: { in: emptyIds } },
    data: { userId: null },
  });
  await prisma.passenger.updateMany({
    where: { userId: { in: emptyIds } },
    data: { userId: null },
  });
  await prisma.translationRecord.updateMany({
    where: { userId: { in: emptyIds } },
    data: { userId: null },
  });
  await prisma.driverReport.deleteMany({
    where: { userId: { in: emptyIds } },
  });
  await prisma.driverTripSummary.deleteMany({
    where: { driverId: { in: emptyIds } },
  });
  await prisma.driverStats.deleteMany({
    where: { driverId: { in: emptyIds } },
  });
  // Sessions are deleted by cascade when user is deleted

  const deleted = await prisma.user.deleteMany({
    where: { id: { in: emptyIds } },
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
