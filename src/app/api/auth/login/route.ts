import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { SessionSecretError, TENANT_SESSION_MAX_AGE_SECONDS, signSession } from '@/lib/session';
import { authenticateTenantUser, containsNulCharacter } from '@/lib/tenant-login';
import { setTenantSessionCookies } from '@/lib/tenant-session-cookies';

const loginSchema = z.object({
  // Same email rule as /api/tenants/setup, so every account that can sign up can sign in.
  email: z.string().email(),
  password: z.string().min(1).max(128).refine((value) => !containsNulCharacter(value)),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: '請輸入有效的 Email 與密碼' }, { status: 400 });
    }

    const result = await authenticateTenantUser(db, parsed.data.email, parsed.data.password);
    if (!result.ok) {
      if (result.reason === 'password_not_set') {
        return NextResponse.json(
          { error: '這個帳號仍是舊版的預設密碼，基於安全已停止登入，請聯絡店主處理。' },
          { status: 403 }
        );
      }
      if (result.reason === 'role_not_allowed') {
        return NextResponse.json(
          { error: '目前只開放「老闆」角色登入，店長與收銀員帳號的權限分級完成後才會開放。' },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Email 或密碼錯誤' }, { status: 401 });
    }

    const sessionToken = await signSession(
      { kind: 'tenant', tenantId: result.tenantId, userId: result.userId },
      TENANT_SESSION_MAX_AGE_SECONDS
    );
    const response = NextResponse.json({ tenantId: result.tenantId, redirect: '/pos' });
    setTenantSessionCookies(response, {
      sessionToken,
      tenantId: result.tenantId,
      tenantName: result.tenantName,
    });
    return response;
  } catch (error) {
    if (error instanceof SessionSecretError) {
      return NextResponse.json({ error: '伺服器設定未完成，暫時無法登入' }, { status: 503 });
    }
    console.error('Tenant login error:', error);
    return NextResponse.json({ error: '登入失敗，請稍後再試' }, { status: 500 });
  }
}
