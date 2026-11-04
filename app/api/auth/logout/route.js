import { NextResponse } from 'next/server';
import { borrarSesion, COOKIE_SESION } from '../../../../lib/preventa';

export async function POST(request) {
  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (token) {
    try {
      await borrarSesion(token);
    } catch (e) {
      console.error('No se pudo borrar la sesión de preventa', e);
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete('bilo_auth');
  response.cookies.delete(COOKIE_SESION);
  return response;
}
