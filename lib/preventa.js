// =============================================================================
// MÓDULO PREVENTA - utilidades de servidor (base de datos, sesiones, usuarios)
// - NO modifica la tabla StoreData (productos/pedidos/clientes). Solo la LEE
//   para obtener la lista de bodegas (clientes).
// - Las tablas preventa_* se crean solas la primera vez (CREATE TABLE IF NOT EXISTS),
//   sin usar "prisma db push" ni migraciones.
// =============================================================================
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Misma base de datos que usa /api/data
const DB_URL =
  'postgresql://neondb_owner:npg_Eql0nJ6UheRP@ep-billowing-wave-ax6pxi1w.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const prisma =
  globalThis.__biloPreventaPrisma ||
  new PrismaClient({ datasources: { db: { url: DB_URL } } });
globalThis.__biloPreventaPrisma = prisma;

// -----------------------------------------------------------------------------
// Cuentas de preventa. Para cambiar una contraseña o agregar un vendedor,
// edita esta lista (el id debe ser único y sin espacios).
// -----------------------------------------------------------------------------
export const VENDEDORES = {
  preventa1: { id: 'preventa1', nombre: 'Preventista 1', password: 'preventa1234' },
  preventa2: { id: 'preventa2', nombre: 'Preventista 2', password: 'preventa5678' },
};

export const ADMIN_ID = 'ADMIN';

// -----------------------------------------------------------------------------
// Creación automática de tablas (idempotente)
// -----------------------------------------------------------------------------
const DDL = [
  `CREATE TABLE IF NOT EXISTS "preventa_sesion" (
     "token" TEXT NOT NULL,
     "vendedor_id" TEXT NOT NULL,
     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "preventa_sesion_pkey" PRIMARY KEY ("token"))`,
  `CREATE TABLE IF NOT EXISTS "preventa_ruta" (
     "id" SERIAL NOT NULL,
     "vendedor_id" TEXT NOT NULL,
     "fecha" TEXT NOT NULL,
     "bodega_id" TEXT NOT NULL,
     "orden" INTEGER NOT NULL DEFAULT 0,
     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "preventa_ruta_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "preventa_ruta_fecha_bodega_id_key" ON "preventa_ruta"("fecha", "bodega_id")`,
  `CREATE INDEX IF NOT EXISTS "preventa_ruta_vendedor_id_fecha_idx" ON "preventa_ruta"("vendedor_id", "fecha")`,
  `CREATE TABLE IF NOT EXISTS "preventa_check" (
     "id" SERIAL NOT NULL,
     "vendedor_id" TEXT NOT NULL,
     "fecha" TEXT NOT NULL,
     "bodega_id" TEXT NOT NULL,
     "lat" DOUBLE PRECISION,
     "lng" DOUBLE PRECISION,
     "exactitud" DOUBLE PRECISION,
     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "preventa_check_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "preventa_check_fecha_bodega_id_key" ON "preventa_check"("fecha", "bodega_id")`,
  `CREATE INDEX IF NOT EXISTS "preventa_check_vendedor_id_fecha_idx" ON "preventa_check"("vendedor_id", "fecha")`,
  `CREATE TABLE IF NOT EXISTS "preventa_gps" (
     "id" SERIAL NOT NULL,
     "vendedor_id" TEXT NOT NULL,
     "fecha" TEXT NOT NULL,
     "lat" DOUBLE PRECISION NOT NULL,
     "lng" DOUBLE PRECISION NOT NULL,
     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "preventa_gps_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "preventa_gps_vendedor_id_fecha_idx" ON "preventa_gps"("vendedor_id", "fecha")`,
  `CREATE TABLE IF NOT EXISTS "preventa_jornada" (
     "vendedor_id" TEXT NOT NULL,
     "fecha" TEXT NOT NULL,
     "cerrada_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "preventa_jornada_pkey" PRIMARY KEY ("vendedor_id", "fecha"))`,
];

let tablasListas = null;
export function ensureTables() {
  if (!tablasListas) {
    tablasListas = (async () => {
      for (const sql of DDL) await prisma.$executeRawUnsafe(sql);
    })().catch((e) => {
      tablasListas = null; // reintentar en la próxima petición
      throw e;
    });
  }
  return tablasListas;
}

// -----------------------------------------------------------------------------
// Fecha de hoy en Perú (YYYY-MM-DD)
// -----------------------------------------------------------------------------
export function hoyLima() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// -----------------------------------------------------------------------------
// Sesiones (token aleatorio guardado en la base, cookie "bilo_pv")
// -----------------------------------------------------------------------------
export const COOKIE_SESION = 'bilo_pv';

export async function crearSesion(vendedorId) {
  await ensureTables();
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.$executeRaw`
    INSERT INTO preventa_sesion (token, vendedor_id, created_at)
    VALUES (${token}, ${vendedorId}, (now() AT TIME ZONE 'UTC'))`;
  return token;
}

export async function borrarSesion(token) {
  if (!token) return;
  await ensureTables();
  await prisma.$executeRaw`DELETE FROM preventa_sesion WHERE token = ${token}`;
}

/** Devuelve { role: 'preventa'|'admin', vendedorId, nombre } o null */
export async function leerSesion(request) {
  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await ensureTables();
  const rows = await prisma.$queryRaw`
    SELECT vendedor_id FROM preventa_sesion
    WHERE token = ${token}
      AND created_at > (now() AT TIME ZONE 'UTC') - interval '30 days'`;
  if (!rows.length) return null;
  const id = rows[0].vendedor_id;
  if (id === ADMIN_ID) return { role: 'admin', vendedorId: null, nombre: 'Administrador' };
  const v = VENDEDORES[id];
  if (!v) return null;
  return { role: 'preventa', vendedorId: v.id, nombre: v.nombre };
}

// -----------------------------------------------------------------------------
// Bodegas = clientes guardados en StoreData (solo lectura)
// -----------------------------------------------------------------------------
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export async function getBodegas() {
  const store = await prisma.storeData.findUnique({
    where: { id: 1 },
    select: { clients: true },
  });
  const clientes = Array.isArray(store?.clients) ? store.clients : [];
  return clientes
    .filter((c) => c && c.id && c.id !== 'c1') // c1 = "Cliente General"
    .map((c) => {
      const lat = num(c.lat);
      const lng = num(c.lng);
      const conUbicacion = lat !== null && lng !== null && !(lat === 0 && lng === 0);
      return {
        id: String(c.id),
        nombre: c.nombre || 'Sin nombre',
        zona: (c.zona || 'SIN ZONA').toString().trim().toUpperCase(),
        direccion: c.address || '',
        telefono: c.telefono && c.telefono !== '-' ? c.telefono : '',
        lat: conUbicacion ? lat : null,
        lng: conUbicacion ? lng : null,
      };
    });
}
