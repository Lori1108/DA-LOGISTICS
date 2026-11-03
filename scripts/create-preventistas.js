const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const prisma = new PrismaClient();
  const password = 'Password123!'; // Puedes cambiarlo después
  const hash = await bcrypt.hash(password, 10);
  const users = [
    { email: 'preventista1@bilo.com', name: 'Preventista 1', role: 'PREVENTA' },
    { email: 'preventista2@bilo.com', name: 'Preventista 2', role: 'PREVENTA' },
  ];
  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      await prisma.user.create({
        data: {
          email: u.email,
          password: hash,
          name: u.name,
          role: u.role,
        },
      });
      console.log(`Created ${u.email} with password ${password}`);
    } else {
      console.log(`${u.email} already exists`);
    }
  }
  await prisma.$disconnect();
})();
