import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    let role = null;

    if (username === 'BILO' && password === 'lorena123') {
      role = 'admin';
    } else if (username === 'trabajo' && password === 'entrega123') {
      role = 'worker';
    }

    if (role) {
      const response = NextResponse.json({ success: true, role });
      
      // Establecer la cookie de sesión (expira en 30 días)
      response.cookies.set('bilo_auth', role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 días
        path: '/',
      });
      
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
