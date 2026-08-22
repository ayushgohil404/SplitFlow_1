import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('sf-token')?.value;
    if (!token) {
      return NextResponse.json({ user: null });
    }

    const secret = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET || 'splitflow-super-secret-key-change-in-production'
    );

    const { payload } = await jwtVerify(token, secret);
    return NextResponse.json({ 
      user: { 
        id: payload.sub, 
        email: payload.email as string, 
        name: payload.name as string 
      } 
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
