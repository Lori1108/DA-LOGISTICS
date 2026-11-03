import { NextResponse } from 'next/server';
import { PrismaClient, RouteStatus } from '@prisma/client';
import haversine from 'haversine-distance';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const userId = Number(request.headers.get('x-user-id'));
  // Find today's open route
  const today = new Date();
  const start = new Date(today.setHours(0, 0, 0, 0));
  const end = new Date(today.setHours(23, 59, 59, 999));

  const route = await prisma.route.findFirst({
    where: { userId, status: RouteStatus.OPEN, date: { gte: start, lte: end } },
    include: { items: true, visitChecks: { orderBy: { timestamp: 'asc' } } },
  });

  if (!route) {
    return NextResponse.json({ success: false, message: 'No open route found' }, { status: 404 });
  }

  const visits = route.visitChecks.filter(v => v.status === 'OFFERED');

  // total time
  const totalTimeMs = visits.length
    ? visits[visits.length - 1].timestamp.getTime() - visits[0].timestamp.getTime()
    : 0;

  // total distance (meters)
  let totalDist = 0;
  for (let i = 1; i < visits.length; i++) {
    const prev = { latitude: visits[i - 1].latitude, longitude: visits[i - 1].longitude };
    const cur = { latitude: visits[i].latitude, longitude: visits[i].longitude };
    totalDist += haversine(prev, cur);
  }

  const summary = {
    totalVisits: visits.length,
    pendingVisits: route.items.length - visits.length,
    totalTimeSec: Math.round(totalTimeMs / 1000),
    totalDistanceM: Math.round(totalDist),
    firstVisit: visits[0]?.timestamp ?? null,
    lastVisit: visits[visits.length - 1]?.timestamp ?? null,
  };

  await prisma.route.update({
    where: { id: route.id },
    data: { status: RouteStatus.CLOSED, closedAt: new Date(), summaryJson: summary },
  });

  return NextResponse.json({ success: true, summary });
}
