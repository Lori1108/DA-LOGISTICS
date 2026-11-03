// Register a new user
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Expected JSON body: { email, password, name, role? }
 * role is optional; defaults to 'VENTAS'
 */
export async function POST(request) {
  try {
    const { email, password, name, role } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, message: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'El usuario ya existe' },
        { status: 409 }
      );
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: role || 'VENTAS', // default role
      },
    });

    // Optionally set auth cookie (similar to login) – can be omitted if you want login after registration
    const response = NextResponse.json({ success: true, userId: newUser.id });
    // response.cookies.set('bilo_auth', newUser.role, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'lax',
    //   maxAge: 60 * 60 * 24 * 30,
    //   path: '/',
    // });
    return response;
  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json({ success: false, message: 'Error interno' }, { status: 500 });
  }
}
