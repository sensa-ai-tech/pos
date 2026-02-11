/**
 * Client-side tenant utilities
 * Extracts tenant_id and tenant_name from document.cookie
 */

function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  return document.cookie.split(';').reduce((acc, c) => {
    const [key, ...rest] = c.trim().split('=');
    acc[key] = rest.join('=');
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Get the current tenant ID from cookies.
 * @param defaultValue - fallback when cookie is missing (default: '')
 */
export function getClientTenantId(defaultValue: string = ''): string {
  const cookies = parseCookies();
  return cookies['tenant_id'] || defaultValue;
}

/**
 * Get the current tenant name from cookies, fully decoded.
 * Handles single or double URI-encoded values.
 */
export function getClientTenantName(): string {
  const cookies = parseCookies();
  if (!cookies['tenant_name']) return '';
  let decoded = cookies['tenant_name'];
  try {
    while (decoded !== decodeURIComponent(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // already fully decoded or invalid encoding
  }
  return decoded;
}
