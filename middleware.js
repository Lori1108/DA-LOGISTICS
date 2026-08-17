import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/:path*'],
};

export function middleware(req) {
  const basicAuth = req.headers.get('authorization');

  // BILO:lorena123 en base64 es QklMTzpsb3JlbmExMjM=
  if (basicAuth && basicAuth.includes('QklMTzpsb3JlbmExMjM=')) {
    return NextResponse.next();
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
