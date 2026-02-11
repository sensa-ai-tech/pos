'use client';

import { useEffect, useState } from 'react';
import { FeatureGate } from '@/components/feature-gate';
import { FEATURES } from '@/lib/feature-ids';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Customer } from '@/types';
import { getClientTenantId } from '@/hooks/use-tenant';

function CustomersContent({ tenantId: _tenantId }: { tenantId: string }) {
  const customers: Customer[] = [
    { id: '1', name: '王先生', phone: '0912345678', email: 'wang@test.com', totalSpent: 5600, visitCount: 12 },
    { id: '2', name: '李小姐', phone: '0923456789', email: 'li@test.com', totalSpent: 3200, visitCount: 8 },
    { id: '3', name: '陳先生', phone: '0934567890', email: null, totalSpent: 1800, visitCount: 4 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <Button>新增顧客</Button>
      </div>
      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-neutral-50 text-left text-sm">
              <th className="p-3">姓名</th>
              <th className="p-3">電話</th>
              <th className="p-3">Email</th>
              <th className="p-3">消費總額</th>
              <th className="p-3">來店次數</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b text-sm">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone || '-'}</td>
                <td className="p-3">{c.email || '-'}</td>
                <td className="p-3">${c.totalSpent.toLocaleString()}</td>
                <td className="p-3">
                  <Badge variant="secondary">{c.visitCount} 次</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    setTenantId(getClientTenantId());
  }, []);

  if (!tenantId) return null;

  return (
    <FeatureGate
      tenantId={tenantId}
      featureId={FEATURES.CRM}
      featureName="顧客管理 (CRM)"
      description="管理顧客資料、消費紀錄、會員等級，提升顧客回訪率"
      priceMonthly={299}
    >
      <CustomersContent tenantId={tenantId} />
    </FeatureGate>
  );
}
