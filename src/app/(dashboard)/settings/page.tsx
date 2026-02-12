'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getClientTenantId } from '@/hooks/use-tenant';
import { settingsLabels, orderFlowLabels } from '@/lib/settings-schema';

// 行業中文標籤與 icon
const industryInfo: Record<string, { label: string; icon: string }> = {
  restaurant: { label: '餐飲業', icon: '🍽️' },
  cafe: { label: '咖啡/飲料', icon: '☕' },
  retail: { label: '零售業', icon: '🛍️' },
  medical: { label: '醫療業', icon: '🏥' },
  service: { label: '美髮業', icon: '💇' },
  beauty: { label: '美容SPA', icon: '💅' },
  gym: { label: '健身中心', icon: '🏋️' },
  education: { label: '教育培訓', icon: '📚' },
  petshop: { label: '寵物店', icon: '🐾' },
  repair: { label: '維修業', icon: '🔧' },
};

// 各行業的專屬設定欄位列表（不含 taxRate, currency）
const industryFields: Record<string, string[]> = {
  restaurant: ['enableTableManagement', 'enableDineInTakeout', 'enableKitchenPrint', 'orderFlow', 'tableCount'],
  cafe: ['enableCustomization', 'enableTakeout', 'enableLoyaltyStamp', 'orderFlow', 'enableKitchenPrint'],
  retail: ['enableBarcode', 'enableVariants', 'lowStockAlert'],
  medical: ['enableAppointment', 'enablePrescription', 'enableExpiryTracking'],
  service: ['enableBooking', 'enableTechnician', 'enableStoredValue'],
  beauty: ['enableBooking', 'enableTechnician', 'enableBeforeAfterPhoto'],
  gym: ['enableMembership', 'enableClassBooking', 'enableTrainerSchedule'],
  education: ['enableSchedule', 'enableAttendance', 'enableParentNotification'],
  petshop: ['enablePetProfile', 'enableGroomingBooking', 'enableBoardingCalendar'],
  repair: ['enableRepairTicket', 'enableWarrantyTracking', 'enableDeviceHistory'],
};

interface TenantData {
  id: string;
  name: string;
  industry: string;
  plan: string;
  settings: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 基本資料
  const [storeName, setStoreName] = useState('');
  const [industry, setIndustry] = useState('');

  // 通用設定
  const [taxRatePercent, setTaxRatePercent] = useState('5');
  const [currency, setCurrency] = useState('TWD');

  // 行業專屬設定（動態 key-value）
  const [industrySettings, setIndustrySettings] = useState<Record<string, unknown>>({});

  const { toast } = useToast();

  const fetchTenant = useCallback(async (tid: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tenants/${tid}`, {
        headers: { 'x-tenant-id': tid },
      });
      if (!res.ok) {
        throw new Error('無法載入店家資料');
      }
      const data: TenantData = await res.json();

      setStoreName(data.name);
      setIndustry(data.industry);

      // 解析 settings JSON
      const parsed = data.settings ? JSON.parse(data.settings) : {};
      if (parsed.taxRate !== undefined) {
        setTaxRatePercent(String(Math.round(parsed.taxRate * 100)));
      }
      if (parsed.currency) {
        setCurrency(parsed.currency);
      }

      // 行業專屬設定（排除 taxRate 和 currency）
      const { taxRate: _t, currency: _c, ...rest } = parsed;
      setIndustrySettings(rest);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tid = getClientTenantId();
    setTenantId(tid);
    if (tid) {
      fetchTenant(tid);
    } else {
      setLoading(false);
      setError('找不到租戶 ID，請重新登入');
    }
  }, [fetchTenant]);

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    try {
      const taxRateNum = parseFloat(taxRatePercent);
      if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
        toast({ title: '錯誤', description: '稅率必須在 0~100 之間', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const settings = {
        ...industrySettings,
        taxRate: taxRateNum / 100,
        currency,
      };

      const res = await fetch(`/api/tenants/${tenantId}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          name: storeName,
          settings,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '儲存失敗');
      }

      // 更新 cookie 中的 tenant_name
      document.cookie = `tenant_name=${encodeURIComponent(storeName)}; path=/; max-age=31536000`;

      toast({
        title: '設定已儲存',
        description: '您的變更已成功儲存',
      });
    } catch (err) {
      toast({
        title: '儲存失敗',
        description: err instanceof Error ? err.message : '請稍後再試',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    document.cookie = 'tenant_id=; path=/; max-age=0';
    document.cookie = 'user_id=; path=/; max-age=0';
    document.cookie = 'tenant_name=; path=/; max-age=0';
    window.location.href = '/onboarding';
  };

  const updateIndustrySetting = (key: string, value: unknown) => {
    setIndustrySettings((prev) => ({ ...prev, [key]: value }));
  };

  // 渲染單個行業專屬欄位
  const renderField = (fieldKey: string) => {
    const label = settingsLabels[fieldKey] || fieldKey;

    // orderFlow: Select
    if (fieldKey === 'orderFlow') {
      const currentValue = (industrySettings[fieldKey] as string) || '';
      return (
        <div key={fieldKey} className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <Select
            value={currentValue}
            onValueChange={(v) => updateIndustrySetting(fieldKey, v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="請選擇" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(orderFlowLabels).map(([value, text]) => (
                <SelectItem key={value} value={value}>
                  {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // tableCount: number input
    if (fieldKey === 'tableCount') {
      const currentValue = industrySettings[fieldKey] !== undefined ? String(industrySettings[fieldKey]) : '';
      return (
        <div key={fieldKey} className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={currentValue}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              updateIndustrySetting(fieldKey, isNaN(val) ? undefined : val);
            }}
            className="w-[200px]"
          />
        </div>
      );
    }

    // boolean toggle 按鈕
    const currentValue = industrySettings[fieldKey] === true;
    return (
      <div key={fieldKey} className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={currentValue ? 'default' : 'outline'}
            onClick={() => updateIndustrySetting(fieldKey, true)}
          >
            開啟
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!currentValue ? 'default' : 'outline'}
            onClick={() => updateIndustrySetting(fieldKey, false)}
          >
            關閉
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-neutral-500">載入中...</p>
      </div>
    );
  }

  if (error && !storeName) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          重新載入
        </Button>
      </div>
    );
  }

  const fields = industryFields[industry] || [];
  const info = industryInfo[industry] || { label: industry, icon: '🏢' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* 基本資訊 */}
      <Card>
        <CardHeader>
          <CardTitle>基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="storeName">店舖名稱</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="mt-1"
              maxLength={100}
            />
          </div>
          <div>
            <Label>租戶 ID</Label>
            <Input value={tenantId} readOnly className="mt-1 bg-neutral-50" />
          </div>
          <div className="flex items-center gap-2">
            <Label>行業類型</Label>
            <Badge variant="secondary">
              {info.icon} {info.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 通用設定 */}
      <Card>
        <CardHeader>
          <CardTitle>通用設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="taxRate">稅率 (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(e.target.value)}
              className="w-[200px]"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="currency">幣別</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TWD">TWD (新台幣)</SelectItem>
                <SelectItem value="USD">USD (美元)</SelectItem>
                <SelectItem value="JPY">JPY (日圓)</SelectItem>
                <SelectItem value="CNY">CNY (人民幣)</SelectItem>
                <SelectItem value="EUR">EUR (歐元)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 行業專屬設定 */}
      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{info.icon} {info.label}專屬設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map(renderField)}
          </CardContent>
        </Card>
      )}

      {/* 操作按鈕 */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '儲存中...' : '儲存設定'}
        </Button>
        <Button variant="destructive" onClick={handleLogout}>
          登出
        </Button>
      </div>
    </div>
  );
}
