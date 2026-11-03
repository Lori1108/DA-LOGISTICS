import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { bodegaIds, date } = await request.json();
  const userIdHeader = request.headers.get('x-user-id');
  const userId = userIdHeader ? Number(userIdHeader) : null;
  if (!userId) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  if (!Array.isArray(bodegaIds) || !date) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const targetDate = new Date(date);
  try {
    const assignments = await Promise.all(
      bodegaIds.map(async (bodegaId: number) => {
        return prisma.routeAssignment.upsert({
          where: {
            userId_bodegaId_date: {
              userId,
              bodegaId,
              date: targetDate,
            },
          },
          update: {},
          create: {
            userId,
            bodegaId,
            date: targetDate,
          },
        });
      })
    );
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Assign error:', error);
    return NextResponse.json({ error: 'Failed to assign bodegas' }, { status: 500 });
  }
}
