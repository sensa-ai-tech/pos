'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Shield, Store, LogOut, AlertTriangle } from 'lucide-react';

interface TenantWithStats {
  id: string;
  name: string;
  industry: string;
  plan: string;
  createdAt: string | number;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    productCount: number;
  };
}

const industryLabels: Record<string, string> = {
  restaurant: '餐飲',
  retail: '零售',
  medical: '醫療',
  service: '服務',
  cafe: '咖啡廳',
  gym: '健身房',
  education: '教育',
  petshop: '寵物店',
  repair: '維修',
  beauty: '美容',
};

const planLabels: Record<string, string> = {
  free: '免費版',
  basic: '基礎版',
  pro: '專業版',
  enterprise: '企業版',
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/tenants')
      .then(async (r) => {
        if (r.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!r.ok) throw new Error('Failed to load');
        const data = await r.json();
        setTenants(data);
      })
      .catch(() => setError('無法載入商店資料'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    document.cookie = 'admin_id=; path=/; max-age=0';
    router.push('/admin/login');
  };

  const totalRevenue = tenants.reduce((sum, t) => sum + (t.stats?.totalRevenue ?? 0), 0);
  const totalOrders = tenants.reduce((sum, t) => sum + (t.stats?.totalOrders ?? 0), 0);
  const pendingAlerts = tenants.filter(t => (t.stats?.pendingOrders ?? 0) > 5);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-neutral-800" />
          <div>
            <h1 className="text-2xl font-bold">平台管理後台</h1>
            <p className="text-sm text-neutral-500">OneKey POS Administration</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          登出
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">商店總數</p>
          <p className="text-2xl font-bold">{tenants.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">平台總營收</p>
          <p className="text-2xl font-bold">${Math.round(totalRevenue).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500">總訂單數</p>
          <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-neutral-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            需關注商店
          </p>
          <p className="text-2xl font-bold text-amber-600">{pendingAlerts.length}</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商店名稱</TableHead>
              <TableHead>行業</TableHead>
              <TableHead>方案</TableHead>
              <TableHead className="text-right">訂單數</TableHead>
              <TableHead className="text-right">營收</TableHead>
              <TableHead className="text-right">商品數</TableHead>
              <TableHead className="text-right">待處理</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-neutral-400">
                  載入中...
                </TableCell>
              </TableRow>
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-neutral-400">
                  尚無商店
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-neutral-400" />
                      {t.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{industryLabels[t.industry] || t.industry}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.plan === 'free' ? 'secondary' : 'default'}>
                      {planLabels[t.plan] || t.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{t.stats.totalOrders}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${Math.round(t.stats.totalRevenue).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{t.stats.productCount}</TableCell>
                  <TableCell className="text-right">
                    {t.stats.pendingOrders > 0 ? (
                      <Badge variant="destructive">{t.stats.pendingOrders}</Badge>
                    ) : (
                      <span className="text-neutral-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/admin/tenants/${t.id}`)}
                    >
                      查看
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
