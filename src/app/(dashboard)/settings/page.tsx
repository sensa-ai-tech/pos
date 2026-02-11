'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getClientTenantId, getClientTenantName } from '@/hooks/use-tenant';

export default function SettingsPage() {
  const [storeName, setStoreName] = useState('');
  const [taxRate, setTaxRate] = useState('5');
  const [currency, setCurrency] = useState('TWD');
  const [tenantId, setTenantId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const tid = getClientTenantId();
    setTenantId(tid);
    setStoreName(getClientTenantName());
  }, []);

  const handleSave = () => {
    // For MVP, just show success toast
    toast({
      title: '設定已儲存',
      description: '您的變更已成功儲存',
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>店舖資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="storeName">店舖名稱</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>租戶 ID</Label>
            <Input value={tenantId} readOnly className="mt-1 bg-neutral-50" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>稅率與幣別</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="taxRate">稅率 (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="currency">幣別</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 p-2 text-sm"
            >
              <option value="TWD">TWD (新台幣)</option>
              <option value="USD">USD (美元)</option>
              <option value="JPY">JPY (日圓)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>帳號管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>目前方案</Label>
            <p className="mt-1 text-sm text-neutral-600">免費版</p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              document.cookie = 'tenant_id=; path=/; max-age=0';
              document.cookie = 'user_id=; path=/; max-age=0';
              document.cookie = 'tenant_name=; path=/; max-age=0';
              window.location.href = '/onboarding';
            }}
          >
            登出
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave}>儲存設定</Button>
    </div>
  );
}
