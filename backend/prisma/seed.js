const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const nickname = process.env.ADMIN_NICKNAME || 'Admin';
  const password = process.env.ADMIN_PASSWORD || 'Luka1Soso';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { nickname },
    update: { passwordHash, role: 'ADMIN' },
    create: {
      nickname,
      email: null,
      passwordHash,
      role: 'ADMIN',
      locale: 'en',
    },
  });

  console.log('Admin user ready: nickname =', nickname);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
