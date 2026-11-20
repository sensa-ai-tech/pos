/**
 * Signed session cookies (HMAC-SHA256 via Web Crypto).
 *
 * Works in both the Edge runtime (middleware) and Node.js (route handlers).
 * Token format: `<base64url(JSON payload)>.<expiry unix seconds>.<base64url(signature)>`
 * where the signature covers `<payload>.<expiry>`.
 *
 * Tenant and admin sessions use different cookies and the payload carries
 * `kind`, so a token of one kind is never accepted as the other.
 */

export const TENANT_SESSION_COOKIE = 'pos_tenant_session';
export const ADMIN_SESSION_COOKIE = 'pos_admin_session';
/** Non-authoritative copy of the tenant id for client-side display/routing only. Never trusted by the server. */
export const CLIENT_TENANT_ID_COOKIE = 'client_tenant_id';

export const TENANT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export const MIN_SESSION_SECRET_LENGTH = 32;

export type TenantSession = { kind: 'tenant'; tenantId: string; userId: string };
export type AdminSession = { kind: 'admin'; adminId: string };
export type SessionPayload = TenantSession | AdminSession;
export type SessionKind = SessionPayload['kind'];
type SessionOfKind<K extends SessionKind> = Extract<SessionPayload, { kind: K }>;

export class SessionSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionSecretError';
  }
}

/** Returns SESSION_SECRET or throws when it is missing or shorter than 32 characters. */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new SessionSecretError(
      `SESSION_SECRET must be set to at least ${MIN_SESSION_SECRET_LENGTH} characters`
    );
  }
  return secret;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function getSigningKey(secret: string): Promise<CryptoKey> {
  if (cachedKey?.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        textEncoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      ),
    };
  }
  return cachedKey.key;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function signSession(
  payload: SessionPayload,
  maxAgeSeconds: number,
  nowMs: number = Date.now()
): Promise<string> {
  const key = await getSigningKey(getSessionSecret());
  const payloadPart = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const expiry = Math.floor(nowMs / 1000) + maxAgeSeconds;
  const signed = `${payloadPart}.${expiry}`;
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(signed)));
  return `${signed}.${base64UrlEncode(signature)}`;
}

function isSessionOfKind<K extends SessionKind>(value: unknown, kind: K): value is SessionOfKind<K> {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.kind !== kind) return false;
  if (kind === 'tenant') {
    return typeof record.tenantId === 'string' && record.tenantId !== ''
      && typeof record.userId === 'string' && record.userId !== '';
  }
  return typeof record.adminId === 'string' && record.adminId !== '';
}

/**
 * Verifies a token and returns its payload, or null when the token is missing,
 * malformed, tampered with, expired, or of another kind.
 * Throws SessionSecretError when SESSION_SECRET is not configured.
 */
export async function verifySession<K extends SessionKind>(
  token: string | undefined | null,
  kind: K,
  nowMs: number = Date.now()
): Promise<SessionOfKind<K> | null> {
  const key = await getSigningKey(getSessionSecret());
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [payloadPart, expiryPart, signaturePart] = parts;
  if (!/^\d{1,12}$/.test(expiryPart)) return null;

  const signature = base64UrlDecode(signaturePart);
  if (!signature) return null;
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    textEncoder.encode(`${payloadPart}.${expiryPart}`)
  );
  if (!valid) return null;

  if (Number(expiryPart) * 1000 <= nowMs) return null;

  const payloadBytes = base64UrlDecode(payloadPart);
  if (!payloadBytes) return null;
  try {
    const payload: unknown = JSON.parse(textDecoder.decode(payloadBytes));
    return isSessionOfKind(payload, kind) ? payload : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    path: '/',
    maxAge: maxAgeSeconds,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
}
