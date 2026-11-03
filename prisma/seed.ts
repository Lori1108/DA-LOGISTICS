import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Password plain text (for dev only)
  const plain = 'Password123!';
  const hash = await bcrypt.hash(plain, 10);

  // Admin (existing role "ventas" or "admin" – adjust to your schema)
  await prisma.user.upsert({
    where: { email: 'admin@bilo.com' },
    update: {},
    create: {
      email: 'admin@bilo.com',
      password: hash,
      role: 'ADMIN', // matches Role enum
      name: 'Administrador',
    },
  });

  // Preventa users
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

  console.log('✅ Seed completed – users created with password:', plain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
