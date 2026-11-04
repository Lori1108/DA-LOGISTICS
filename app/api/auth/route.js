import { NextResponse } from 'next/server';
import { VENDEDORES, ADMIN_ID, crearSesion, COOKIE_SESION } from '../../../lib/preventa';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 30, // 30 días
  path: '/',
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    let role = null;
    let sesionId = null; // id para la sesión de preventa (admin o preventista)

    if (username === 'BILO' && password === 'lorena123') {
      role = 'admin';
      sesionId = ADMIN_ID;
    } else if (username === 'trabajo' && password === 'entrega123') {
      role = 'worker';
    } else {
      // Cuentas de preventa (Preventista 1 y Preventista 2) -> lib/preventa.js
      const usuario = String(username || '').trim().toLowerCase();
      const v = VENDEDORES[usuario];
      if (v && v.password === password) {
        role = 'preventa';
        sesionId = v.id;
      }
    }

    if (role) {
      const response = NextResponse.json({ success: true, role });

      // Establecer la cookie de sesión (expira en 30 días)
      response.cookies.set('bilo_auth', role, COOKIE_OPTS);

      // Sesión segura del módulo preventa (identifica a CADA vendedor)
      if (sesionId) {
        try {
          const token = await crearSesion(sesionId);
          response.cookies.set(COOKIE_SESION, token, COOKIE_OPTS);
        } catch (e) {
          console.error('No se pudo crear la sesión de preventa', e);
          // El admin entra igual al POS; el preventista necesita la sesión sí o sí
          if (role === 'preventa') {
            return NextResponse.json(
              { success: false, message: 'No se pudo iniciar sesión, intenta de nuevo' },
              { status: 500 }
            );
          }
        }
      }

      return response;
    } else {
      return NextResponse.json(
        { success: false, message: 'Credenciales incorrectas' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Error procesando la solicitud' },
      { status: 500 }
    );
  }
}
