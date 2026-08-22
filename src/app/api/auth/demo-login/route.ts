import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SignJWT } from 'jose';

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: { email, name: name || email.split('@')[0] },
      });
    }
    
    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'splitflow-super-secret-key-change-in-production'
    );
    
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(secret);
    
    const response = NextResponse.json({ 
      user: { id: user.id, email: user.email, name: user.name } 
    });
    response.cookies.set('sf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}