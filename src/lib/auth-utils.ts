import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      return {
        id: (session.user as any).id,
        email: session.user.email!,
        name: session.user.name || undefined,
      };
    }

    // Fallback: check demo session cookie
    const cookieStore = await cookies();
    const sfToken = cookieStore.get('sf-token')?.value;
    if (sfToken) {
      const secret = new TextEncoder().encode(
        process.env.NEXTAUTH_SECRET || 'splitflow-super-secret-key-change-in-production'
      );
      const { payload } = await jwtVerify(sfToken, secret);
      return {
        id: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string) || undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
