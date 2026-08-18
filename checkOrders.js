const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_Eql0nJ6UheRP@ep-billowing-wave-ax6pxi1w.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
    let store = await prisma.storeData.findUnique({ where: { id: 1 } });
    if (!store) return;
    
    let orders = store.orders || [];
    console.log(JSON.stringify(orders.slice(0, 3).map(o => ({
        folio: o.folio,
        cliente: o.cliente,
        deliveryAddress: o.deliveryAddress,
        deliveryLat: o.deliveryLat,
        deliveryLng: o.deliveryLng,
        status: o.deliveryStatus
    })), null, 2));
    
    await prisma.$disconnect();
}
main();
