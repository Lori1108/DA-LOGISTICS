import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/', '/pos.html', '/api/data'],
};

export function middleware(request) {
  const url = request.nextUrl;
  const authToken = request.cookies.get('bilo_auth')?.value;
  
  if (authToken === 'authenticated') {
    // Si ya está autenticado y entra a la página principal (login), enviarlo al POS
    if (url.pathname === '/') {
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
