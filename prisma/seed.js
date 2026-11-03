const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const plain = 'Password123!';
  const hash = await bcrypt.hash(plain, 10);

  // Admin user
  await prisma.user.upsert({
    where: { email: 'admin@bilo.com' },
    update: {},
    create: {
      email: 'admin@bilo.com',
      password: hash,
      role: 'ADMIN',
      name: 'Administrador',
    },
  });

  // Preventista 1
  await prisma.user.upsert({
    where: { email: 'preventa1@bilo.com' },
    update: {},
    create: {
      email: 'preventa1@bilo.com',
      password: hash,
      role: 'PREVENTA',
      name: 'Preventista 1',
    },
  });

  // Preventista 2
  await prisma.user.upsert({
    where: { email: 'preventa2@bilo.com' },
    update: {},
    create: {
      email: 'preventa2@bilo.com',
      password: hash,
      role: 'PREVENTA',
      name: 'Preventista 2',
    },
  });

  console.log('✅ Seed de usuarios completado – password:', plain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
