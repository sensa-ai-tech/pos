'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type Industry = 'restaurant' | 'retail' | 'medical' | 'service';

const industryOptions = [
  { value: 'restaurant' as Industry, icon: '🍽️', label: '餐飲業', desc: '餐廳、咖啡廳、飲料店' },
  { value: 'retail' as Industry, icon: '🛍️', label: '零售業', desc: '服飾、超商、雜貨店' },
  { value: 'medical' as Industry, icon: '🏥', label: '醫療業', desc: '診所、藥局、獸醫' },
  { value: 'service' as Industry, icon: '💇', label: '服務業', desc: '美容美髮、SPA、寵物美容' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [industry, setIndustry] = useState<Industry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!industry) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/tenants/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, industry }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '生成失敗');
      }

      // Wait for animation effect
      await new Promise((r) => setTimeout(r, 1500));

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">OneKey POS</h1>
          <p className="mt-2 text-neutral-500">一鍵生成你的 POS 系統</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full ${
                s <= step ? 'bg-neutral-900' : 'bg-neutral-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-xl font-semibold">基本資料</h2>
              <div>
                <Label htmlFor="name">店舖名稱</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：美味餐廳"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">密碼</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 個字元"
                />
              </div>
              <Button
                className="w-full"
                disabled={!name || !email || password.length < 6}
                onClick={() => setStep(2)}
              >
                下一步
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Industry Selection */}
        {step === 2 && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-xl font-semibold">選擇產業</h2>
              <div className="grid grid-cols-2 gap-3">
                {industryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`rounded-lg border-2 p-4 text-left transition-colors ${
                      industry === opt.value
                        ? 'border-neutral-900 bg-neutral-50'
                        : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                    onClick={() => setIndustry(opt.value)}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <p className="mt-2 font-medium">{opt.label}</p>
                    <p className="text-xs text-neutral-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  上一步
                </Button>
                <Button
                  disabled={!industry}
                  onClick={() => setStep(3)}
                  className="flex-1"
                >
                  下一步
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-xl font-semibold">確認生成</h2>
              <div className="space-y-2 rounded-lg bg-neutral-50 p-4 text-sm">
                <p><span className="text-neutral-500">店舖名稱：</span>{name}</p>
                <p><span className="text-neutral-500">Email：</span>{email}</p>
                <p><span className="text-neutral-500">產業類型：</span>{industryOptions.find((o) => o.value === industry)?.label}</p>
              </div>
              <p className="text-sm text-neutral-500">
                系統將自動建立商品分類、預設商品和基礎功能設定。
              </p>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  上一步
                </Button>
                <Button
                  disabled={loading}
                  onClick={handleGenerate}
                  className="flex-1"
                >
                  {loading ? '生成中...' : '一鍵生成我的 POS'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
