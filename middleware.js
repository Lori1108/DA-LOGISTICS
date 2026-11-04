import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/', '/pos.html', '/entregas.html', '/preventa.html', '/api/data', '/api/preventa'],
};

export function middleware(request) {
  const url = request.nextUrl;
  const authToken = request.cookies.get('bilo_auth')?.value;
  
  // Soporte para cookie antigua y nueva
  const isAdmin = authToken === 'admin' || authToken === 'authenticated';
  const isWorker = authToken === 'worker';
  const isPreventa = authToken === 'preventa';

  if (isAdmin || isWorker || isPreventa) {
    // Si ya está autenticado y entra a la página principal (login)
    if (url.pathname === '/') {
      url.pathname = isAdmin ? '/pos.html' : isWorker ? '/entregas.html' : '/preventa.html';
      return NextResponse.redirect(url);
    }
    
    // Proteger las rutas según el rol
    if (isWorker && (url.pathname === '/pos.html' || url.pathname === '/preventa.html')) {
      url.pathname = '/entregas.html';
      return NextResponse.redirect(url);
    }
    if (isWorker && url.pathname === '/api/preventa') {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }
    
    if (isAdmin && url.pathname === '/entregas.html') {
      url.pathname = '/pos.html';
      return NextResponse.redirect(url);
    }

    // Preventa: solo su panel y su API (nada del POS ni de entregas)
    if (isPreventa) {
      if (url.pathname === '/api/data') {
        return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
      }
      if (url.pathname === '/pos.html' || url.pathname === '/entregas.html') {
        url.pathname = '/preventa.html';
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  }

  // API de preventa sin sesión: responder 401 (la API además valida la sesión real)
  if (url.pathname === '/api/preventa') {
    return NextResponse.json({ error: 'NO_SESION' }, { status: 401 });
  }

  // Si no está autenticado y NO está en la página principal, enviarlo al login
  if (url.pathname !== '/') {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}
