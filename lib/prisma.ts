import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  // Optional: log queries for debugging
  // log: ['query', 'info', 'warn', 'error'],
});

export { prisma };