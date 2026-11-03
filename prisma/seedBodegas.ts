import { prisma } from './prisma';

async function main() {
  const bodegas = [
    { nombre: 'Bodega 1', sector: 'Bellavista', lat: -17.789, lng: -63.180 },
    { nombre: 'Bodega 2', sector: 'Bellavista', lat: -17.791, lng: -63.182 },
    { nombre: 'Bodega 3', sector: 'Bajo Biavo', lat: -17.795, lng: -63.185 },
    { nombre: 'Bodega 4', sector: 'Bajo Biavo', lat: -17.797, lng: -63.188 },
    { nombre: 'Bodega 5', sector: 'Centro', lat: -17.800, lng: -63.190 },
  ];

  for (const b of bodegas) {
    await prisma.bodega.upsert({
      where: { nombre: b.nombre },
      update: {},
      create: b,
    });
  }
  console.log('Bodegas seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
