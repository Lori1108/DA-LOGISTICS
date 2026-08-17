import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/:path*'],
};

export function middleware(req) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === 'BILO' && pwd === 'lorena123') {
      return NextResponse.next();
    }
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
