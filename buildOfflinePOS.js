const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_Eql0nJ6UheRP@ep-billowing-wave-ax6pxi1w.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function buildOfflinePOS() {
    try {
        console.log("Fetching data from DB...");
        const store = await prisma.storeData.findUnique({ where: { id: 1 } });
        
        const products = store ? store.products : [];
        const clients = store ? store.clients : [];
        
        console.log("Reading template...");
        let html = fs.readFileSync('public/offline-template.html', 'utf-8');
        
        console.log("Injecting data...");
        html = html.replace('__CLIENTS_DATA__', JSON.stringify(clients));
        html = html.replace('__PRODUCTS_DATA__', JSON.stringify(products));
        
        const outputPath = 'POS_Offline.html';
        fs.writeFileSync(outputPath, html);
        console.log("Successfully generated offline POS at: " + outputPath);
    } catch (e) {
        console.error("Error building offline POS:", e);
    } finally {
        await prisma.$disconnect();
    }
}

buildOfflinePOS();
