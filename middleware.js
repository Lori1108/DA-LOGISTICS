import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/', '/pos.html', '/entregas.html', '/api/data'],
};

export function middleware(request) {
  const url = request.nextUrl;
  const authToken = request.cookies.get('bilo_auth')?.value;
  
  // Soporte para cookie antigua y nueva
  const isAdmin = authToken === 'admin' || authToken === 'authenticated';
  const isWorker = authToken === 'worker';

  if (isAdmin || isWorker) {
    // Si ya está autenticado y entra a la página principal (login)
    if (url.pathname === '/') {
      url.pathname = isAdmin ? '/pos.html' : '/entregas.html';
      return NextResponse.redirect(url);
    }
    
    // Proteger las rutas según el rol
    if (isWorker && url.pathname === '/pos.html') {
      url.pathname = '/entregas.html';
      return NextResponse.redirect(url);
    }
    
    if (isAdmin && url.pathname === '/entregas.html') {
      url.pathname = '/pos.html';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // Si no está autenticado y NO está en la página principal, enviarlo al login
  if (url.pathname !== '/') {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}
