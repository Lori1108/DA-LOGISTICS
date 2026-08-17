import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    let store = await prisma.storeData.findUnique({ where: { id: 1 } });
    if (!store) {
      store = await prisma.storeData.create({
        data: {
          id: 1,
          products: [],
          orders: [],
          clients: []
        }
      });
    }
    return NextResponse.json(store);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    
    const updateData = {};
    if (data.products !== undefined) updateData.products = data.products;
    if (data.orders !== undefined) updateData.orders = data.orders;
    if (data.clients !== undefined) updateData.clients = data.clients;

    const store = await prisma.storeData.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        products: data.products || [],
        orders: data.orders || [],
        clients: data.clients || []
      }
    });
    
    return NextResponse.json({ success: true, store });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
