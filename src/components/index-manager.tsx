'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3, Database, Download, RefreshCw, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Play, Square, ArrowUpDown, Clock, Search,
  ChevronDown, ChevronUp, Filter, Server, HardDrive, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface IndexDef {
  id: string;
  code: string;
  name: string;
  webId: string;
  category: string;
  status: string;
  candleCount: number;
  fetchedAt: string | null;
  errorMsg: string | null;
}

interface BulkStatus {
  is_running: boolean;
  current: number;
  total: number;
  done: number;
  success: number;
  errors: number;
  elapsed_seconds: number;
  error: string | null;
  progress: Array<{ code: string; name: string; count: number; status: string; error?: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:    { label: 'در انتظار',  color: 'text-gray-500', bg: 'bg-gray-100 border-gray-200', icon: Clock },
  fetching:   { label: 'در حال دریافت', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Loader2 },
  done:       { label: 'آماده',      color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  error:      { label: 'خطا',        color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: XCircle },
};

export default function IndexManager({ onBack }: { onBack: () => void }) {
  const [indices, setIndices] = useState<IndexDef[]>([]);
  const [bulkStatus, setBulkStatus] = useState<BulkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'main' | 'sector'>('all');
  const [sortField, setSortField] = useState<'name' | 'status' | 'candleCount'>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  // Fetch indices list
  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch('/api/index-management?action=list');
      if (res.ok) {
        const data = await res.json();
        if (data.indices) setIndices(data.indices);
      }
    } catch {
      // try fetching from Python service directly
      try {
        const res = await fetch('/api/index-management?action=list');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setIndices(data);
          else if (data.indices) setIndices(data.indices);
        }
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBulkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/index-management?action=bulk-status');
      if (res.ok) {
        const data = await res.json();
        setBulkStatus(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchIndices();
    fetchBulkStatus();
  }, [fetchIndices, fetchBulkStatus]);

  // Poll bulk status while running
  useEffect(() => {
    if (bulkStatus?.is_running) {
      pollRef.current = setInterval(fetchBulkStatus, 3000);
      return () => clearInterval(pollRef.current);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      // Refresh indices list when bulk fetch completes
      if (bulkStatus && !bulkStatus.is_running && bulkStatus.done > 0) {
        fetchIndices();
      }
    }
  }, [bulkStatus?.is_running, fetchBulkStatus, fetchIndices, bulkStatus?.done]);

  const handleBulkStart = async (category: 'all' | 'main' | 'sector' = 'all') => {
    try {
      const res = await fetch(`/api/index-management?action=bulk-start&category=${category}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.error) alert(data.error);
        else fetchBulkStatus();
      } else {
        const data = await res.json();
        alert(data.error || 'خطا در شروع دریافت داده‌ها');
      }
    } catch (err) {
      alert('خطا در ارتباط با سرویس دریافت. آیا سرویس Python فعال است؟');
    }
  };

  const handleBulkStop = async () => {
    try {
      await fetch('/api/index-management?action=bulk-stop', { method: 'POST' });
      fetchBulkStatus();
    } catch { /* ignore */ }
  };

  const handleFetchOne = async (code: string) => {
    try {
      const res = await fetch(`/api/index-management?action=fetch-one&code=${code}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'done') {
          fetchIndices();
        } else {
          alert(`خطا: ${data.error || 'نامشخص'}`);
        }
      }
    } catch {
      alert('خطا در ارتباط با سرویس');
    }
  };

  // Filter and sort
  const filtered = indices.filter((idx) => {
    if (categoryFilter !== 'all' && idx.category !== categoryFilter) return false;
    if (filter && !idx.name.includes(filter) && !idx.code.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'name') return dir * a.name.localeCompare(b.name, 'fa');
    if (sortField === 'status') {
      const order = { fetching: 0, done: 1, pending: 2, error: 3 };
      return dir * ((order[a.status] ?? 4) - (order[b.status] ?? 4));
    }
    return dir * (a.candleCount - b.candleCount);
  });

  const mainCount = indices.filter((i) => i.category === 'main').length;
  const sectorCount = indices.filter((i) => i.category === 'sector').length;
  const doneCount = indices.filter((i) => i.status === 'done').length;
  const totalCount = indices.length;
  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors">
            <ArrowUpDown className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600" />
              مدیریت شاخص‌های بورس
            </h2>
            <p className="text-xs text-gray-500">دریافت و ذخیره داده‌های تاریخی ۵۰ شاخص بورس (finpy-tse + z-ai SDK)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 px-2.5 py-1">
            <HardDrive className="w-3 h-3" />
            {doneCount}/{totalCount} ذخیره شده
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 px-2.5 py-1">
            <BarChart3 className="w-3 h-3" />
            {mainCount} اصلی + {sectorCount} صنعت
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600">پیشرفت ذخیره‌سازی</span>
          <span className="text-xs text-gray-500">{progressPercent.toFixed(0)}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between mt-2 text-[10px] text-gray-400">
          <span>{doneCount} شاخص آماده</span>
          <span>{totalCount - doneCount} باقی‌مانده</span>
        </div>
      </div>

      {/* Bulk Fetch Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {bulkStatus?.is_running ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-bold">در حال دریافت... {bulkStatus.current}/{bulkStatus.total}</span>
              <span className="text-xs">({bulkStatus.elapsed_seconds}s)</span>
            </div>
            <Button variant="destructive" size="sm" onClick={handleBulkStop} className="gap-1.5">
              <Square className="w-3.5 h-3.5" /> توقف
            </Button>
            {bulkStatus.progress.length > 0 && (
              <div className="text-xs text-gray-500">
                آخرین: <span className={bulkStatus.progress[bulkStatus.progress.length - 1].status === 'done' ? 'text-emerald-600' : 'text-red-600'}>
                  {bulkStatus.progress[bulkStatus.progress.length - 1].name}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <Button onClick={() => handleBulkStart('all')} className="gap-1.5 bg-amber-500 hover:bg-amber-600">
              <Play className="w-3.5 h-3.5" /> دریافت همه (۵۰ شاخص)
            </Button>
            <Button onClick={() => handleBulkStart('main')} variant="outline" size="sm" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" /> ۱۰ شاخص اصلی
            </Button>
            <Button onClick={() => handleBulkStart('sector')} variant="outline" size="sm" className="gap-1.5">
              <Server className="w-3.5 h-3.5" /> ۴۰ شاخص صنعت
            </Button>
            <Button onClick={() => { fetchIndices(); fetchBulkStatus(); }} variant="ghost" size="sm" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> بروزرسانی
            </Button>
          </>
        )}
      </div>

      {/* Bulk Error */}
      {bulkStatus?.error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{bulkStatus.error}</span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="جستجوی شاخص..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pr-9 text-sm"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['all', 'main', 'sector'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                categoryFilter === cat ? 'bg-amber-50 text-amber-700' : 'bg-white text-gray-500 hover:bg-gray-50'
              )}
            >
              {cat === 'all' ? `همه (${totalCount})` : cat === 'main' ? `اصلی (${mainCount})` : `صنعت (${sectorCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Indices Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-sm text-gray-500">در حال بارگذاری لیست شاخص‌ها...</span>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_60px] sm:grid-cols-[1fr_80px_100px_100px_80px] gap-1 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500">
            <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
              نام شاخص {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <span>دسته</span>
            <button onClick={() => toggleSort('status')} className="flex items-center gap-1 hover:text-gray-700">
              وضعیت {sortField === 'status' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <button onClick={() => toggleSort('candleCount')} className="flex items-center gap-1 hover:text-gray-700">
              تعداد {sortField === 'candleCount' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
            <span>عملیات</span>
          </div>

          {/* Table Body */}
          <ScrollArea className="max-h-[500px]">
            {filtered.map((idx) => {
              const cfg = STATUS_CONFIG[idx.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const isExpanded = expandedCode === idx.code;

              return (
                <div key={idx.code} className="border-b border-gray-100 last:border-b-0">
                  <div className="grid grid-cols-[1fr_80px_80px_80px_60px] sm:grid-cols-[1fr_80px_100px_100px_80px] gap-1 px-4 py-2.5 items-center hover:bg-gray-50/50 transition-colors">
                    <button
                      onClick={() => setExpandedCode(isExpanded ? null : idx.code)}
                      className="text-right text-sm font-medium text-gray-800 truncate hover:text-amber-700 transition-colors"
                      title={idx.name}
                    >
                      {idx.name}
                    </button>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 justify-center">
                      {idx.category === 'main' ? 'اصلی' : 'صنعت'}
                    </Badge>
                    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border', cfg.bg)}>
                      <StatusIcon className={cn('w-3.5 h-3.5', cfg.color, idx.status === 'fetching' && 'animate-spin')} />
                      <span className={cn('text-[11px] font-medium', cfg.color)}>{cfg.label}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-700">
                      {idx.candleCount > 0 ? idx.candleCount.toLocaleString('fa-IR') : '—'}
                    </div>
                    <div className="flex items-center justify-center">
                      {idx.status !== 'fetching' && (
                        <button
                          onClick={() => handleFetchOne(idx.code)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                          title="دریافت مجدد"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-gray-50/50 border-t border-gray-100">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                        <div>
                          <span className="text-gray-400">کد:</span>
                          <span className="font-mono text-gray-700 mr-1">{idx.code}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">WebID:</span>
                          <span className="font-mono text-gray-700 mr-1" dir="ltr">{idx.webId.slice(-8)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">آخرین بروزرسانی:</span>
                          <span className="text-gray-700 mr-1">{idx.fetchedAt ? new Date(idx.fetchedAt).toLocaleString('fa-IR') : '—'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">منبع:</span>
                          <span className="text-gray-700 mr-1">finpy-tse + z-ai SDK</span>
                        </div>
                      </div>
                      {idx.errorMsg && (
                        <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                          <strong>خطا:</strong> {idx.errorMsg}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                شاخصی یافت نشد
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
