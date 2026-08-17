import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

export function middleware(req) {
  try {
    const basicAuth = req.headers.get('authorization');

    if (basicAuth && basicAuth.includes('QklMTzpsb3JlbmExMjM=')) {
      return NextResponse.next();
    }

    return new NextResponse('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  } catch (error) {
    // Si algo falla, devolvemos un 401 genérico para no crashear
    return new NextResponse('Auth Error', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }
}
