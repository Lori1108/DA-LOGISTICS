// =============================================================================
// API PREVENTA
//   GET  /api/preventa?fecha=YYYY-MM-DD[&vendedor=preventa1]
//   POST /api/preventa  { action, vendedorId, ... }
//
// Flujo de trabajo:
//   - El usuario BILO (Administrador) crea, arma y asigna la ruta de cada preventista.
//     También monitorea el mapa en vivo y el recorrido de cada uno.
//   - El usuario PREVENTA (preventa1 / preventa2) inicia sesión desde su celular,
//     ve la ruta asignada por BILO, su punto azul en el mapa, marca visitas
//     (Ofrecido / Visitado) y se va registrando su recorrido GPS en tiempo real.
// =============================================================================
import { NextResponse } from 'next/server';
import {
  prisma,
  ensureTables,
  leerSesion,
  VENDEDORES,
  hoyLima,
  getBodegas,
} from '../../../lib/preventa';

export const dynamic = 'force-dynamic';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function err(status, message) {
  return NextResponse.json({ error: message }, { status });
}

function coord(v, max) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
}

function idsValidos(lista, bodegasPorId) {
  if (!Array.isArray(lista)) return [];
  const unicos = [...new Set(lista.map((x) => String(x)))];
  return unicos.filter((id) => bodegasPorId.has(id)).slice(0, 500);
}

// -----------------------------------------------------------------------------
// GET: jornada de un vendedor en una fecha
// -----------------------------------------------------------------------------
export async function GET(request) {
  try {
    const ses = await leerSesion(request);
    if (!ses) return err(401, 'NO_SESION');
    await ensureTables();

    const url = new URL(request.url);
    const hoy = hoyLima();
    let fecha = url.searchParams.get('fecha') || hoy;
    if (!FECHA_RE.test(fecha)) fecha = hoy;

    const esAdmin = ses.role === 'admin';

    // El preventista siempre ve lo suyo. El admin puede elegir vendedor.
    let vendedorId = ses.vendedorId;
    if (esAdmin) {
      const pedido = url.searchParams.get('vendedor');
      vendedorId = VENDEDORES[pedido] ? pedido : Object.keys(VENDEDORES)[0];
    }

    const [bodegas, ruta, ocupadasRaw, checks, gps, jornada] = await Promise.all([
      getBodegas(),
      prisma.$queryRaw`
        SELECT bodega_id AS "bodegaId", orden FROM preventa_ruta
        WHERE vendedor_id = ${vendedorId} AND fecha = ${fecha}
        ORDER BY orden, id`,
      prisma.$queryRaw`
        SELECT bodega_id AS "bodegaId", vendedor_id AS "vendedorId" FROM preventa_ruta
        WHERE fecha = ${fecha}`,
      prisma.$queryRaw`
        SELECT bodega_id AS "bodegaId", lat, lng, exactitud, created_at AS "createdAt"
        FROM preventa_check
        WHERE vendedor_id = ${vendedorId} AND fecha = ${fecha}
        ORDER BY created_at`,
      prisma.$queryRaw`
        SELECT lat, lng, created_at AS "createdAt" FROM preventa_gps
        WHERE vendedor_id = ${vendedorId} AND fecha = ${fecha}
        ORDER BY created_at`,
      prisma.$queryRaw`
        SELECT cerrada_at AS "cerradaAt" FROM preventa_jornada
        WHERE vendedor_id = ${vendedorId} AND fecha = ${fecha}`,
    ]);

    const cerradaAt = jornada[0]?.cerradaAt || null;
    const esHoy = fecha === hoy;

    // Mapa de asignaciones de todas las bodegas en esa fecha
    // { bodegaId: 'preventa1' | 'preventa2' }
    const asignaciones = {};
    for (const row of ocupadasRaw) {
      asignaciones[row.bodegaId] = row.vendedorId;
    }

    // Lista de IDs ocupados por OTRO vendedor
    const ocupadasPorOtro = ocupadasRaw
      .filter((r) => r.vendedorId !== vendedorId)
      .map((r) => r.bodegaId);

    return NextResponse.json({
      me: { role: ses.role, vendedorId: ses.vendedorId, nombre: ses.nombre },
      vendedor: { id: vendedorId, nombre: VENDEDORES[vendedorId].nombre },
      vendedores: Object.values(VENDEDORES).map((v) => ({ id: v.id, nombre: v.nombre })),
      fecha,
      hoy,
      cerradaAt,
      esAdmin,
      puedeEditarRuta: (esAdmin || ses.role === 'preventa') && esHoy && !cerradaAt,
      puedeMarcar: esHoy && !cerradaAt,
      bodegas,
      ruta,
      ocupadas: ocupadasPorOtro,
      asignaciones: esAdmin ? asignaciones : undefined,
      checks,
      gps,
    });
  } catch (e) {
    console.error('GET /api/preventa', e);
    return err(500, 'Error interno: ' + e.message);
  }
}

// -----------------------------------------------------------------------------
// POST: acciones sobre la jornada de hoy
// -----------------------------------------------------------------------------
export async function POST(request) {
  try {
    const ses = await leerSesion(request);
    if (!ses) return err(401, 'NO_SESION');
    if (ses.role !== 'preventa' && ses.role !== 'admin') {
      return err(403, 'Sin permiso');
    }
    await ensureTables();

    const body = await request.json().catch(() => ({}));
    const esAdmin = ses.role === 'admin';

    // Si es admin: opera sobre el vendedor indicado en el body (o preventa1 por defecto)
    // Si es preventista: opera SIEMPRE sobre su propia cuenta
    let v;
    if (esAdmin) {
      const pedido = body.vendedorId;
      v = VENDEDORES[pedido] ? pedido : Object.keys(VENDEDORES)[0];
    } else {
      v = ses.vendedorId;
    }

    const fecha = hoyLima();

    const cerrada = await prisma.$queryRaw`
      SELECT 1 FROM preventa_jornada WHERE vendedor_id = ${v} AND fecha = ${fecha}`;
    if (cerrada.length && body.action !== 'reabrir') {
      if (body.action === 'gps') return NextResponse.json({ ok: true, ignorado: true });
      return err(409, 'La jornada de hoy ya está cerrada');
    }

    switch (body.action) {
      // ---- Agregar bodegas a la ruta (masivo o individual) ----
      case 'agregar': {
        const bodegas = await getBodegas();
        const porId = new Map(bodegas.map((b) => [b.id, b]));
        const ids = idsValidos(body.bodegaIds, porId);
        if (!ids.length) return err(400, 'No hay bodegas válidas para agregar');
        const max = await prisma.$queryRaw`
          SELECT COALESCE(MAX(orden), 0)::int AS m FROM preventa_ruta
          WHERE vendedor_id = ${v} AND fecha = ${fecha}`;
        const base = max[0].m;

        let agregadas = 0;
        if (esAdmin && body.reasignar) {
          // Si es admin y pide reasignar, mueve la bodega a este vendedor
          agregadas = await prisma.$executeRaw`
            INSERT INTO preventa_ruta (vendedor_id, fecha, bodega_id, orden, created_at)
            SELECT ${v}, ${fecha}, t.id, ${base}::int + t.n::int, (now() AT TIME ZONE 'UTC')
            FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, n)
            ON CONFLICT (fecha, bodega_id) DO UPDATE SET vendedor_id = EXCLUDED.vendedor_id, orden = EXCLUDED.orden`;
        } else {
          // Inserción sin sobreescribir si ya está asignada hoy a otro
          agregadas = await prisma.$executeRaw`
            INSERT INTO preventa_ruta (vendedor_id, fecha, bodega_id, orden, created_at)
            SELECT ${v}, ${fecha}, t.id, ${base}::int + t.n::int, (now() AT TIME ZONE 'UTC')
            FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, n)
            ON CONFLICT (fecha, bodega_id) DO NOTHING`;
        }

        return NextResponse.json({ ok: true, agregadas, omitidas: ids.length - agregadas });
      }

      // ---- Quitar bodegas de la ruta (las ya visitadas no se quitan) ----
      case 'quitar': {
        const ids = Array.isArray(body.bodegaIds) ? body.bodegaIds.map(String).slice(0, 500) : [];
        if (!ids.length) return err(400, 'No hay bodegas para quitar');
        const quitadas = await prisma.$executeRaw`
          DELETE FROM preventa_ruta
          WHERE vendedor_id = ${v} AND fecha = ${fecha}
            AND bodega_id = ANY(${ids}::text[])
            AND bodega_id NOT IN (
              SELECT bodega_id FROM preventa_check WHERE vendedor_id = ${v} AND fecha = ${fecha})`;
        return NextResponse.json({ ok: true, quitadas });
      }

      // ---- Marcar como Ofrecido / Visitado ----
      case 'check': {
        const id = String(body.bodegaId || '');
        const lat = coord(body.lat, 90);
        const lng = coord(body.lng, 180);
        const exactitud = coord(body.exactitud, 100000);
        const enRuta = await prisma.$queryRaw`
          SELECT 1 FROM preventa_ruta
          WHERE vendedor_id = ${v} AND fecha = ${fecha} AND bodega_id = ${id}`;
        if (!enRuta.length) return err(403, 'Esa bodega no está en la ruta de hoy');
        await prisma.$executeRaw`
          INSERT INTO preventa_check (vendedor_id, fecha, bodega_id, lat, lng, exactitud, created_at)
          VALUES (${v}, ${fecha}, ${id}, ${lat}, ${lng}, ${exactitud}, (now() AT TIME ZONE 'UTC'))
          ON CONFLICT (fecha, bodega_id) DO NOTHING`;
        return NextResponse.json({ ok: true });
      }

      // ---- Deshacer un check ----
      case 'desmarcar': {
        const id = String(body.bodegaId || '');
        await prisma.$executeRaw`
          DELETE FROM preventa_check
          WHERE vendedor_id = ${v} AND fecha = ${fecha} AND bodega_id = ${id}`;
        return NextResponse.json({ ok: true });
      }

      // ---- Punto GPS del vendedor en ruta (máx. 1 cada 15 s) ----
      case 'gps': {
        if (esAdmin) return NextResponse.json({ ok: true, ignorado: true });
        const lat = coord(body.lat, 90);
        const lng = coord(body.lng, 180);
        if (lat === null || lng === null) return err(400, 'Coordenadas inválidas');
        await prisma.$executeRaw`
          INSERT INTO preventa_gps (vendedor_id, fecha, lat, lng, created_at)
          SELECT ${v}, ${fecha}, ${lat}, ${lng}, (now() AT TIME ZONE 'UTC')
          WHERE NOT EXISTS (
            SELECT 1 FROM preventa_gps
            WHERE vendedor_id = ${v} AND fecha = ${fecha}
              AND created_at > (now() AT TIME ZONE 'UTC') - interval '15 seconds')`;
        return NextResponse.json({ ok: true });
      }

      // ---- Cerrar la jornada de hoy ----
      case 'cerrar': {
        await prisma.$executeRaw`
          INSERT INTO preventa_jornada (vendedor_id, fecha, cerrada_at)
          VALUES (${v}, ${fecha}, (now() AT TIME ZONE 'UTC'))
          ON CONFLICT (vendedor_id, fecha) DO NOTHING`;
        return NextResponse.json({ ok: true });
      }

      // ---- Reabrir la jornada (solo admin) ----
      case 'reabrir': {
        if (!esAdmin) return err(403, 'Solo el administrador puede reabrir la jornada');
        await prisma.$executeRaw`
          DELETE FROM preventa_jornada WHERE vendedor_id = ${v} AND fecha = ${fecha}`;
        return NextResponse.json({ ok: true });
      }

      default:
        return err(400, 'Acción no válida');
    }
  } catch (e) {
    console.error('POST /api/preventa', e);
    return err(500, 'Error interno: ' + e.message);
  }
}
