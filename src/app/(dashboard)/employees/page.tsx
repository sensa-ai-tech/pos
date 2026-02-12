'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { UserCog, Plus, Lock } from 'lucide-react';
import { getClientTenantId } from '@/hooks/use-tenant';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string | number;
}

const roleLabels: Record<string, string> = {
  owner: '老闆',
  manager: '店長',
  cashier: '收銀員',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'cashier' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = getClientTenantId('tenant-a');
    fetch('/api/employees', { headers: { 'x-tenant-id': tenantId } })
      .then(async (r) => {
        if (r.status === 403) {
          setLocked(true);
          return;
        }
        if (!r.ok) throw new Error('Failed to load');
        const data = await r.json();
        setEmployees(Array.isArray(data) ? data : data.data ?? []);
      })
      .catch(() => setError('無法載入員工資料'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.email.trim()) return;
    setSaving(true);
    const tenantId = getClientTenantId('tenant-a');
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || '新增失敗');
        return;
      }
      const created = await res.json();
      setEmployees(prev => [created, ...prev]);
      setFormData({ name: '', email: '', role: 'cashier' });
      setShowForm(false);
    } catch {
      setError('新增失敗');
    } finally {
      setSaving(false);
    }
  };

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Lock className="mb-4 h-12 w-12 text-neutral-300" />
        <h2 className="text-xl font-bold mb-2">員工管理</h2>
        <p className="text-neutral-500 mb-4">此功能需要員工管理模組（NT$499/月）</p>
        <Button onClick={() => window.location.href = '/subscription'}>
          查看訂閱方案
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6" />
          員工管理
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          新增員工
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>關閉</button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-semibold">新增員工</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="姓名 *"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Email *"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
            <select
              className="rounded border px-3 py-2 text-sm"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
            >
              <option value="cashier">收銀員</option>
              <option value="manager">店長</option>
              <option value="owner">老闆</option>
            </select>
          </div>
          <p className="text-xs text-neutral-500">新員工預設密碼為 changeme123，請提醒員工登入後修改</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? '儲存中...' : '儲存'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>建立時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-neutral-400">
                  尚無員工資料
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>{emp.email}</TableCell>
                  <TableCell>
                    <Badge variant={emp.role === 'owner' ? 'default' : 'secondary'}>
                      {roleLabels[emp.role] || emp.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {typeof emp.createdAt === 'number'
                      ? new Date(emp.createdAt * 1000).toLocaleDateString('zh-TW')
                      : new Date(emp.createdAt).toLocaleDateString('zh-TW')}
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
