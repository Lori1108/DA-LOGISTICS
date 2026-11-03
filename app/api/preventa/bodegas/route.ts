import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sector = searchParams.get('sector');
  const where = sector ? { sector } : {};
  try {
    const bodegas = await prisma.bodega.findMany({ where });
    return NextResponse.json(bodegas);
  } catch (error) {
    console.error('Error fetching bodegas:', error);
    return NextResponse.json({ error: 'Failed to fetch bodegas' }, { status: 500 });
  }
}
