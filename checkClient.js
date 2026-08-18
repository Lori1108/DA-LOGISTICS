const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_Eql0nJ6UheRP@ep-billowing-wave-ax6pxi1w.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require" } } });

async function main() {
    let store = await prisma.storeData.findUnique({ where: { id: 1 } });
    if (!store) return;
    
    let clients = store.clients || [];
    let hermitano = clients.find(c => c.nombre === "HERMITAÑO");
    console.log(hermitano);
    
    await prisma.$disconnect();
}
main();
