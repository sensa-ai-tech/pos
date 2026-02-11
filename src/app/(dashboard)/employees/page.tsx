'use client';

import { useEffect, useState } from 'react';
import { FeatureGate } from '@/components/feature-gate';
import { FEATURES } from '@/lib/feature-ids';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
  status: 'active' | 'inactive';
}

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie.split(';').reduce((acc, c) => {
    const [key, val] = c.trim().split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);
  return cookies['tenant_id'] || '';
}

function EmployeesContent() {
  const [employees] = useState<Employee[]>([
    { id: '1', name: '張經理', role: 'manager', email: 'zhang@store.com', status: 'active' },
    { id: '2', name: '王店員', role: 'cashier', email: 'wang@store.com', status: 'active' },
    { id: '3', name: '李助理', role: 'cashier', email: 'li@store.com', status: 'inactive' },
  ]);

  const roleLabels: Record<string, string> = {
    owner: '店主',
    manager: '經理',
    cashier: '店員',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">員工管理</h1>
        <Button>新增員工</Button>
      </div>
      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-neutral-50 text-left text-sm">
              <th className="p-3">姓名</th>
              <th className="p-3">職位</th>
              <th className="p-3">Email</th>
              <th className="p-3">狀態</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b text-sm">
                <td className="p-3 font-medium">{e.name}</td>
                <td className="p-3">{roleLabels[e.role] || e.role}</td>
                <td className="p-3">{e.email}</td>
                <td className="p-3">
                  <Badge variant={e.status === 'active' ? 'default' : 'secondary'}>
                    {e.status === 'active' ? '在職' : '離職'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    setTenantId(getTenantId());
  }, []);

  if (!tenantId) return null;

  return (
    <FeatureGate
      tenantId={tenantId}
      featureId={FEATURES.EMPLOYEE_MGMT}
      featureName="員工管理"
      description="管理員工帳號、權限設定、班表排班、業績追蹤"
      priceMonthly={499}
    >
      <EmployeesContent />
    </FeatureGate>
  );
}
