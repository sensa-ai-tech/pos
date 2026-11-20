import { cookies } from 'next/headers';
import { TENANT_SESSION_COOKIE, verifySession } from '@/lib/session';

export async function getAuthFromCookies() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(TENANT_SESSION_COOKIE)?.value, 'tenant');
  const tenantId = session?.tenantId ?? null;
  const userId = session?.userId ?? null;
  let tenantName: string | null = null;
  const rawName = cookieStore.get('tenant_name')?.value;
  if (rawName) {
    tenantName = rawName;
    try {
      while (tenantName !== decodeURIComponent(tenantName)) {
        tenantName = decodeURIComponent(tenantName);
      }
    } catch {
      // already decoded
    }
  }

  return { tenantId, userId, tenantName };
}

export async function isAuthenticated() {
  const { tenantId, userId } = await getAuthFromCookies();
  return !!(tenantId && userId);
}
