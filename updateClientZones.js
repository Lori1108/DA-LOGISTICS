const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_Eql0nJ6UheRP@ep-billowing-wave-ax6pxi1w.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function main() {
  const wb = xlsx.readFile('CLIENTES ACTUALES.xlsx');
  let clientsWithZones = {};

  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    // Start reading from row 4 (where the headers seem to be, or use header:1 to be safe)
    const rows = xlsx.utils.sheet_to_json(sheet, {header: 1});
    
    // Find the header row by looking for 'Dirección' and 'Nombre de ubicación'
    let headerRowIndex = -1;
    for (let i = 0; i < 10; i++) {
        if (rows[i] && rows[i].includes('Dirección') && rows[i].includes('Nombre de ubicación')) {
            headerRowIndex = i;
            break;
        }
    }

    if (headerRowIndex > -1) {
        const headers = rows[headerRowIndex];
        const dirIndex = headers.indexOf('Dirección');
        const nameIndex = headers.indexOf('Nombre de ubicación');
        
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (row && row[nameIndex]) {
                const clientName = row[nameIndex].toString().trim();
                const zoneName = row[dirIndex] ? row[dirIndex].toString().trim() : 'Sin Zona';
                clientsWithZones[clientName] = zoneName;
            }
        }
    }
  });

  const store = await prisma.storeData.findUnique({ where: { id: 1 } });
  if (store && store.clients) {
    let updatedCount = 0;
    const updatedClients = store.clients.map(c => {
        if (c.nombre && clientsWithZones[c.nombre.trim()]) {
            c.zona = clientsWithZones[c.nombre.trim()];
            updatedCount++;
        } else {
            c.zona = c.zona || 'GENERAL';
        }
        return c;
    });

    await prisma.storeData.update({
        where: { id: 1 },
        data: { clients: updatedClients }
    });

    console.log(`Updated ${updatedCount} clients with zones!`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
