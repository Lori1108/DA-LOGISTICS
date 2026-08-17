import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/', '/pos.html', '/api/data'],
};

export function middleware(request) {
  const basicAuth = request.headers.get('authorization');

  if (basicAuth === 'Basic QklMTzpsb3JlbmExMjM=') {
    return NextResponse.next();
  }

  return new NextResponse('Auth required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}
