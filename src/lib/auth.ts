import { cookies } from 'next/headers';

export async function getAuthFromCookies() {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get('tenant_id')?.value || null;
  const userId = cookieStore.get('user_id')?.value || null;
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
