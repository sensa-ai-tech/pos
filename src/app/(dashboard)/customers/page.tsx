'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Users, Plus, Lock } from 'lucide-react';
import { getClientTenantId } from '@/hooks/use-tenant';
import type { Customer } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = getClientTenantId('tenant-a');
    fetch('/api/customers', { headers: { 'x-tenant-id': tenantId } })
      .then(async (r) => {
        if (r.status === 403) {
          setLocked(true);
          return;
        }
        if (!r.ok) throw new Error('Failed to load');
        const result = await r.json();
        setCustomers(result.data ?? result);
      })
      .catch(() => setError('無法載入客戶資料'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    const tenantId = getClientTenantId('tenant-a');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          notes: formData.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || '新增失敗');
        return;
      }
      const created = await res.json();
      setCustomers(prev => [created, ...prev]);
      setFormData({ name: '', phone: '', email: '', notes: '' });
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
        <h2 className="text-xl font-bold mb-2">顧客管理</h2>
        <p className="text-neutral-500 mb-4">此功能需要 CRM 模組（NT$299/月）</p>
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
          <Users className="h-6 w-6" />
          顧客管理
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          新增客戶
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
          <h3 className="font-semibold">新增客戶</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="姓名 *"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="電話"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
            <input
              className="rounded border px-3 py-2 text-sm"
              placeholder="備註"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
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
              <TableHead>電話</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">累計消費</TableHead>
              <TableHead className="text-right">來店次數</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-neutral-400">
                  尚無客戶資料
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || '-'}</TableCell>
                  <TableCell>{c.email || '-'}</TableCell>
                  <TableCell className="text-right">${c.totalSpent}</TableCell>
                  <TableCell className="text-right">{c.visitCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
