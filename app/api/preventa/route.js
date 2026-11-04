// =============================================================================
// API PREVENTA
//   GET  /api/preventa?fecha=YYYY-MM-DD[&vendedor=preventa1]
//   POST /api/preventa  { action, vendedorId, ... }
//
// Reglas de negocio y autorización:
//   - SOLO el Administrador (BILO) puede crear y modificar las rutas del día,
//     y gestionar las Rutas Guardadas / Plantillas (ej. "Lunes", "Martes").
//   - Cada Preventista (preventa1 / preventa2) SOLO visualiza los clientes
//     asignados a su propia ruta (con nombre, teléfono, zona y ubicación),
//     marca sus visitas (Ofrecido / Visitado), transmite su recorrido GPS,
//     y puede agregar/actualizar el número de teléfono de sus clientes
//     (actualizándose en todo el sistema: POS, Clientes, Pedidos, Entregas y Preventa).
// =============================================================================
import { NextResponse } from 'next/server';
import {
  prisma,
  ensureTables,
  leerSesion,
  VENDEDORES,
  hoyLima,
  getBodegas,
  actualizarTelefonoCliente,
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
// GET: jornada de un vendedor en una fecha (+ rutas guardadas para el admin)
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

    // El preventista siempre ve únicamente lo suyo. El admin elige vendedor.
    let vendedorId = ses.vendedorId;
    if (esAdmin) {
      const pedido = url.searchParams.get('vendedor');
      vendedorId = VENDEDORES[pedido] ? pedido : Object.keys(VENDEDORES)[0];
    }

    const [todasBodegas, ruta, ocupadasRaw, checks, gps, jornada, plantillasRaw] = await Promise.all([
      getBodegas(),
      prisma.$queryRaw`
        SELECT bodega_id AS "bodegaId", orden FROM preventa_ruta
        WHERE vendedor_id = ${vendedorId} AND fecha = ${fecha}
        ORDER BY orden, id`,
      esAdmin
        ? prisma.$queryRaw`
            SELECT bodega_id AS "bodegaId", vendedor_id AS "vendedorId" FROM preventa_ruta
            WHERE fecha = ${fecha}`
        : Promise.resolve([]),
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
      esAdmin
        ? prisma.$queryRaw`
            SELECT id, nombre, bodega_ids AS "bodegaIds", updated_at AS "updatedAt"
            FROM preventa_plantilla
            ORDER BY id ASC`
        : Promise.resolve([]),
    ]);

    const cerradaAt = jornada[0]?.cerradaAt || null;
    const esHoy = fecha === hoy;

    // Si es preventista, solo recibe los clientes asignados a su ruta
    const idsEnMiRuta = new Set(ruta.map((r) => r.bodegaId));
    const bodegas = esAdmin
      ? todasBodegas
      : todasBodegas.filter((b) => idsEnMiRuta.has(b.id));

    // Mapa de asignaciones para el admin
    const asignaciones = {};
    for (const row of ocupadasRaw) {
      asignaciones[row.bodegaId] = row.vendedorId;
    }

    const ocupadasPorOtro = esAdmin
      ? ocupadasRaw.filter((r) => r.vendedorId !== vendedorId).map((r) => r.bodegaId)
      : [];

    // Normalizar plantillas (rutas guardadas)
    const idsExistentes = new Set(todasBodegas.map((b) => b.id));
    const plantillas = esAdmin
      ? plantillasRaw.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          bodegaIds: Array.isArray(p.bodegaIds)
            ? p.bodegaIds.map(String).filter((id) => idsExistentes.has(id))
            : [],
          updatedAt: p.updatedAt,
        }))
      : [];

    return NextResponse.json({
      me: { role: ses.role, vendedorId: ses.vendedorId, nombre: ses.nombre },
      vendedor: { id: vendedorId, nombre: VENDEDORES[vendedorId].nombre },
      vendedores: esAdmin
        ? Object.values(VENDEDORES).map((v) => ({ id: v.id, nombre: v.nombre }))
        : [],
      fecha,
      hoy,
      cerradaAt,
      esAdmin,
      // SOLO el administrador puede crear o modificar la ruta
      puedeEditarRuta: esAdmin && esHoy && !cerradaAt,
      puedeMarcar: esHoy && !cerradaAt,
      bodegas,
      ruta,
      ocupadas: ocupadasPorOtro,
      asignaciones: esAdmin ? asignaciones : undefined,
      plantillas: esAdmin ? plantillas : undefined,
      checks,
      gps,
    });
  } catch (e) {
    console.error('GET /api/preventa', e);
    return err(500, 'Error interno: ' + e.message);
  }
}

// -----------------------------------------------------------------------------
// POST: acciones sobre la jornada, teléfono de clientes y rutas guardadas
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

    // ---- Actualizar teléfono de un cliente (permitido a Preventista en su ruta y a Admin) ----
    if (body.action === 'telefono') {
      const id = String(body.bodegaId || '').trim();
      if (!id) return err(400, 'Falta el cliente');
      if (!esAdmin) {
        const asignada = await prisma.$queryRaw`
          SELECT 1 FROM preventa_ruta WHERE vendedor_id = ${v} AND bodega_id = ${id} LIMIT 1`;
        if (!asignada.length) {
          return err(403, 'Solo puedes actualizar el teléfono de clientes asignados a tu ruta');
        }
      }
      const resTel = await actualizarTelefonoCliente(id, body.telefono);
      return NextResponse.json({ ok: true, ...resTel });
    }

    // ---- Gestión de Rutas Guardadas / Plantillas (SOLO ADMINISTRADOR) ----
    if (body.action === 'crear_plantilla') {
      if (!esAdmin) return err(403, 'Solo el administrador puede guardar rutas');
      const nombre = String(body.nombre || '').trim().slice(0, 80);
      if (!nombre) return err(400, 'Escribe un nombre para la ruta (ej. Lunes)');
      const bodegas = await getBodegas();
      const porId = new Map(bodegas.map((b) => [b.id, b]));
      const ids = idsValidos(body.bodegaIds || [], porId);
      const jsonIds = JSON.stringify(ids);
      const rows = await prisma.$queryRaw`
        INSERT INTO preventa_plantilla (nombre, bodega_ids, updated_at)
        VALUES (${nombre}, ${jsonIds}::jsonb, (now() AT TIME ZONE 'UTC'))
        RETURNING id, nombre, bodega_ids AS "bodegaIds"`;
      return NextResponse.json({ ok: true, plantilla: rows[0] });
    }

    if (body.action === 'editar_plantilla') {
      if (!esAdmin) return err(403, 'Solo el administrador puede editar rutas guardadas');
      const pid = parseInt(body.plantillaId, 10);
      if (!Number.isFinite(pid)) return err(400, 'Ruta guardada inválida');
      const rows = await prisma.$queryRaw`
        SELECT id, nombre, bodega_ids AS "bodegaIds" FROM preventa_plantilla WHERE id = ${pid}`;
      if (!rows.length) return err(404, 'Ruta guardada no encontrada');

      const bodegas = await getBodegas();
      const porId = new Map(bodegas.map((b) => [b.id, b]));
      const actuales = Array.isArray(rows[0].bodegaIds)
        ? rows[0].bodegaIds.map(String).filter((id) => porId.has(id))
        : [];
      const entrantes = idsValidos(body.bodegaIds || [], porId);

      let nuevaLista = actuales;
      if (body.modo === 'agregar') {
        const set = new Set(actuales);
        for (const id of entrantes) {
          if (!set.has(id)) {
            set.add(id);
            nuevaLista.push(id);
          }
        }
      } else if (body.modo === 'quitar') {
        const quitarSet = new Set(
          Array.isArray(body.bodegaIds) ? body.bodegaIds.map(String) : []
        );
        nuevaLista = actuales.filter((id) => !quitarSet.has(id));
      } else if (body.modo === 'set') {
        nuevaLista = entrantes;
      }

      const nuevoNombre = body.nombre
        ? String(body.nombre).trim().slice(0, 80)
        : rows[0].nombre;
      const jsonIds = JSON.stringify(nuevaLista);

      await prisma.$executeRaw`
        UPDATE preventa_plantilla
        SET nombre = ${nuevoNombre}, bodega_ids = ${jsonIds}::jsonb, updated_at = (now() AT TIME ZONE 'UTC')
        WHERE id = ${pid}`;

      return NextResponse.json({
        ok: true,
        plantilla: { id: pid, nombre: nuevoNombre, bodegaIds: nuevaLista },
      });
    }

    if (body.action === 'eliminar_plantilla') {
      if (!esAdmin) return err(403, 'Solo el administrador puede eliminar rutas guardadas');
      const pid = parseInt(body.plantillaId, 10);
      if (!Number.isFinite(pid)) return err(400, 'Ruta guardada inválida');
      await prisma.$executeRaw`DELETE FROM preventa_plantilla WHERE id = ${pid}`;
      return NextResponse.json({ ok: true });
    }

    // ---- Acciones sobre la ruta activa de HOY ----
    const cerrada = await prisma.$queryRaw`
      SELECT 1 FROM preventa_jornada WHERE vendedor_id = ${v} AND fecha = ${fecha}`;
    if (cerrada.length && body.action !== 'reabrir') {
      if (body.action === 'gps') return NextResponse.json({ ok: true, ignorado: true });
      return err(409, 'La jornada de hoy ya está cerrada');
    }

    switch (body.action) {
      // ---- Asignar una Ruta Guardada (ej. "Lunes") a un preventista hoy (SOLO ADMIN) ----
      case 'aplicar_plantilla': {
        if (!esAdmin) return err(403, 'Solo el administrador puede asignar rutas');
        const pid = parseInt(body.plantillaId, 10);
        if (!Number.isFinite(pid)) return err(400, 'Ruta guardada inválida');
        const rows = await prisma.$queryRaw`
          SELECT id, nombre, bodega_ids AS "bodegaIds" FROM preventa_plantilla WHERE id = ${pid}`;
        if (!rows.length) return err(404, 'Ruta guardada no encontrada');

        const bodegas = await getBodegas();
        const porId = new Map(bodegas.map((b) => [b.id, b]));
        const ids = idsValidos(rows[0].bodegaIds || [], porId);
        if (!ids.length) return err(400, `La ruta "${rows[0].nombre}" aún no tiene clientes guardados`);

        // Si reemplazar !== false, limpiamos los clientes aún no visitados hoy de este preventista
        // para que su ruta del día quede exactamente como la ruta guardada
        if (body.reemplazar !== false) {
          await prisma.$executeRaw`
            DELETE FROM preventa_ruta
            WHERE vendedor_id = ${v} AND fecha = ${fecha}
              AND bodega_id NOT IN (
                SELECT bodega_id FROM preventa_check WHERE vendedor_id = ${v} AND fecha = ${fecha})`;
        }

        const max = await prisma.$queryRaw`
          SELECT COALESCE(MAX(orden), 0)::int AS m FROM preventa_ruta
          WHERE vendedor_id = ${v} AND fecha = ${fecha}`;
        const base = max[0].m;

        let agregadas = 0;
        if (body.reasignar) {
          agregadas = await prisma.$executeRaw`
            INSERT INTO preventa_ruta (vendedor_id, fecha, bodega_id, orden, created_at)
            SELECT ${v}, ${fecha}, t.id, ${base}::int + t.n::int, (now() AT TIME ZONE 'UTC')
            FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, n)
            ON CONFLICT (fecha, bodega_id) DO UPDATE SET vendedor_id = EXCLUDED.vendedor_id, orden = EXCLUDED.orden`;
        } else {
          agregadas = await prisma.$executeRaw`
            INSERT INTO preventa_ruta (vendedor_id, fecha, bodega_id, orden, created_at)
            SELECT ${v}, ${fecha}, t.id, ${base}::int + t.n::int, (now() AT TIME ZONE 'UTC')
            FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, n)
            ON CONFLICT (fecha, bodega_id) DO NOTHING`;
        }

        const totalRuta = await prisma.$queryRaw`
          SELECT COUNT(*)::int AS c FROM preventa_ruta WHERE vendedor_id = ${v} AND fecha = ${fecha}`;

        return NextResponse.json({
          ok: true,
          nombre: rows[0].nombre,
          agregadas,
          totalEnRuta: Number(totalRuta[0]?.c ?? agregadas),
          omitidas: ids.length - agregadas,
        });
      }

      // ---- Agregar bodegas a la ruta (SOLO ADMINISTRADOR) ----
      case 'agregar': {
        if (!esAdmin) {
          return err(403, 'Solo el administrador puede modificar la ruta');
        }
        const bodegas = await getBodegas();
        const porId = new Map(bodegas.map((b) => [b.id, b]));
        const ids = idsValidos(body.bodegaIds, porId);
        if (!ids.length) return err(400, 'No hay bodegas válidas para agregar');
        const max = await prisma.$queryRaw`
          SELECT COALESCE(MAX(orden), 0)::int AS m FROM preventa_ruta
          WHERE vendedor_id = ${v} AND fecha = ${fecha}`;
        const base = max[0].m;

        let agregadas = 0;
        if (body.reasignar) {
          agregadas = await prisma.$executeRaw`
            INSERT INTO preventa_ruta (vendedor_id, fecha, bodega_id, orden, created_at)
            SELECT ${v}, ${fecha}, t.id, ${base}::int + t.n::int, (now() AT TIME ZONE 'UTC')
            FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, n)
            ON CONFLICT (fecha, bodega_id) DO UPDATE SET vendedor_id = EXCLUDED.vendedor_id, orden = EXCLUDED.orden`;
        } else {
          agregadas = await prisma.$executeRaw`
            INSERT INTO preventa_ruta (vendedor_id, fecha, bodega_id, orden, created_at)
            SELECT ${v}, ${fecha}, t.id, ${base}::int + t.n::int, (now() AT TIME ZONE 'UTC')
            FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, n)
            ON CONFLICT (fecha, bodega_id) DO NOTHING`;
        }

        return NextResponse.json({ ok: true, agregadas, omitidas: ids.length - agregadas });
      }

      // ---- Quitar bodegas de la ruta (SOLO ADMINISTRADOR) ----
      case 'quitar': {
        if (!esAdmin) {
          return err(403, 'Solo el administrador puede modificar la ruta');
        }
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
