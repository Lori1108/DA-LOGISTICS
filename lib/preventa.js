// =============================================================================
// MÓDULO PREVENTA - utilidades de servidor (base de datos, sesiones, usuarios)
// - Lee la lista de clientes/bodegas desde StoreData y permite actualizar el
//   teléfono de un cliente reflejándolo en todo el sistema (StoreData.clients
//   y StoreData.orders).
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
  `CREATE TABLE IF NOT EXISTS "preventa_plantilla" (
     "id" SERIAL NOT NULL,
     "nombre" TEXT NOT NULL,
     "bodega_ids" JSONB NOT NULL DEFAULT '[]',
     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "preventa_plantilla_pkey" PRIMARY KEY ("id"))`,
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
// Bodegas = clientes guardados en StoreData
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

// -----------------------------------------------------------------------------
// Actualizar el teléfono de un cliente en StoreData (clientes + pedidos)
// para que se actualice en todo el sistema (POS, Clientes, Pedidos, Entregas y Preventa)
// -----------------------------------------------------------------------------
export async function actualizarTelefonoCliente(bodegaId, nuevoTelefono) {
  const idStr = String(bodegaId || '').trim();
  const telLimpio = String(nuevoTelefono || '').trim().slice(0, 40);
  if (!idStr) throw new Error('ID de cliente inválido');

  const store = await prisma.storeData.findUnique({ where: { id: 1 } });
  if (!store || !Array.isArray(store.clients)) {
    throw new Error('No se encontró el catálogo de clientes');
  }

  const clients = [...store.clients];
  const idx = clients.findIndex((c) => c && String(c.id) === idStr);
  if (idx === -1) {
    throw new Error('Cliente no encontrado');
  }

  const clienteActual = { ...clients[idx] };
  const nombreCliente = (clienteActual.nombre || '').trim().toLowerCase();
  clienteActual.telefono = telLimpio || '-';
  clients[idx] = clienteActual;

  // También sincronizar el teléfono en los pedidos de ese cliente en StoreData.orders
  let orders = Array.isArray(store.orders) ? [...store.orders] : store.orders;
  let ordersChanged = false;
  if (Array.isArray(orders) && nombreCliente) {
    orders = orders.map((o) => {
      if (o && (o.cliente || '').trim().toLowerCase() === nombreCliente) {
        ordersChanged = true;
        return { ...o, telefono: telLimpio || '-' };
      }
      return o;
    });
  }

  const updateData = { clients };
  if (ordersChanged) updateData.orders = orders;

  await prisma.storeData.update({
    where: { id: 1 },
    data: updateData,
  });

  return { id: idStr, telefono: telLimpio };
}
