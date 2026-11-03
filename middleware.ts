import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const role = request.cookies.get('bilo_auth')?.value;
  const userId = request.cookies.get('bilo_user')?.value;

  const url = request.nextUrl.clone();

  // Protect all /api/preventa routes
  if (url.pathname.startsWith('/api/preventa')) {
    if (!role || !userId) {
      return NextResponse.json({ success: false, message: 'No autenticado' }, { status: 401 });
    }
    if (role === 'ADMIN') return NextResponse.next();
    if (role === 'PREVENTA') {
      request.headers.set('x-user-id', userId);
      request.headers.set('x-user-role', role);
      return NextResponse.next();
    }
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.next();
}
