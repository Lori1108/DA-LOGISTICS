import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const userIdHeader = request.headers.get('x-user-id');
  const userId = userIdHeader ? Number(userIdHeader) : null;
  if (!userId) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const today = new Date();
  const start = new Date(today.setHours(0, 0, 0, 0));
  const end = new Date(today.setHours(23, 59, 59, 999));

  try {
    const assignments = await prisma.routeAssignment.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        bodega: {
          include: {
            visitChecks: {
              where: { userId },
              take: 1,
            },
          },
        },
      },
    });

    const result = assignments.map(a => ({
      bodega: a.bodega,
      status: a.bodega.visitChecks.length ? 'OFRECIDO' : 'PENDIENTE',
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching today assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch today assignments' }, { status: 500 });
  }
}
