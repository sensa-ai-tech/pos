import { cookies } from 'next/headers';

export function getAuthFromCookies() {
  const cookieStore = cookies();
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

export function isAuthenticated() {
  const { tenantId, userId } = getAuthFromCookies();
  return !!(tenantId && userId);
}
