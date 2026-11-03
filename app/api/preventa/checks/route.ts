import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { bodegaId, lat, lng } = await request.json();
  const userIdHeader = request.headers.get('x-user-id');
  const userId = userIdHeader ? Number(userIdHeader) : null;
  if (!userId) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  if (typeof bodegaId !== 'number' || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  try {
    const check = await prisma.visitCheck.upsert({
      where: { userId_bodegaId: { userId, bodegaId } },
      update: { lat, lng, timestamp: new Date() },
      create: { userId, bodegaId, lat, lng },
    });
    return NextResponse.json(check);
  } catch (error) {
    console.error('Check‑in error:', error);
    return NextResponse.json({ error: 'Failed to record check‑in' }, { status: 500 });
  }
}
