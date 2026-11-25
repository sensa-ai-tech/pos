'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Only same-origin paths are accepted as the post-login destination, checked after URL normalization. */
function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/pos';
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname === '/login') return '/pos';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/pos';
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      let message: string | undefined;
      try {
        message = (JSON.parse(text) as { error?: string }).error;
      } catch {
        // non-JSON error page
      }
      if (!res.ok) {
        setError(message || `登入失敗（${res.status}）`);
        setSubmitting(false);
        return;
      }
      // Full navigation so server components read the new session cookie.
      window.location.href = nextPath;
    } catch {
      setError('連線失敗，請確認網路後再試');
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-semibold">登入店舖</h2>
          {error && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">密碼</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !email || !password}>
            {submitting ? '登入中...' : '登入'}
          </Button>
          <p className="text-center text-sm text-neutral-500">
            還沒有店舖？{' '}
            <Link href="/onboarding" className="font-medium text-neutral-900 underline">
              建立新的 POS
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">OneKey POS</h1>
          <p className="mt-2 text-neutral-500">用建立店舖時的 Email 與密碼登入</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
